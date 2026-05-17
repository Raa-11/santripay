import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { savingPlans, studentSavings, ledgerEntries } from '$lib/server/db/schema';
import { auth } from '$lib/server/auth';
import { eq, and, sql, gte, lt, inArray } from 'drizzle-orm';

function monthsBetween(from: Date, to: Date): number {
	return (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth()) + 1;
}

function buildMonthArray(from: Date, to: Date): { month: string; label: string; total: number }[] {
	const start = new Date(from.getFullYear(), from.getMonth(), 1);
	const end = new Date(to.getFullYear(), to.getMonth(), 1);
	const result = [];
	const cur = new Date(start);
	while (cur <= end) {
		const key = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}`;
		result.push({ month: key, label: cur.toLocaleString('en-US', { month: 'short' }), total: 0 });
		cur.setMonth(cur.getMonth() + 1);
	}
	return result;
}

function aggregateToQuarters(monthly: { month: string; label: string; total: number }[]) {
	const map = new Map<string, { label: string; total: number }>();
	for (const m of monthly) {
		const [year, mo] = m.month.split('-').map(Number);
		const q = Math.ceil(mo / 3);
		const key = `${year}-Q${q}`;
		if (!map.has(key)) map.set(key, { label: `Q${q} '${String(year).slice(2)}`, total: 0 });
		map.get(key)!.total += m.total;
	}
	return Array.from(map.entries()).map(([month, v]) => ({ month, ...v }));
}

function aggregateToYears(monthly: { month: string; label: string; total: number }[]) {
	const map = new Map<string, { label: string; total: number }>();
	for (const m of monthly) {
		const year = m.month.slice(0, 4);
		if (!map.has(year)) map.set(year, { label: year, total: 0 });
		map.get(year)!.total += m.total;
	}
	return Array.from(map.entries()).map(([month, v]) => ({ month, ...v }));
}

function getGrouping(months: number): 'month' | 'quarter' | 'year' {
	if (months <= 12) return 'month';
	if (months <= 36) return 'quarter';
	return 'year';
}

export const load: PageServerLoad = async ({ url, request }) => {
	const session = await auth.api.getSession({ headers: request.headers });

	const plans = await db
		.select({
			id: savingPlans.id,
			code: savingPlans.code,
			name: savingPlans.name,
			savingType: savingPlans.savingType,
			isActive: savingPlans.isActive,
			defaultTargetAmount: savingPlans.defaultTargetAmount,
			startDate: savingPlans.startDate,
			createdAt: savingPlans.createdAt,
		})
		.from(savingPlans)
		.orderBy(savingPlans.createdAt);

	const planId = url.searchParams.get('planId') ?? plans[0]?.id ?? null;
	const plan = plans.find((p) => p.id === planId) ?? null;

	if (!plan) return { plans, report: null, user: session?.user ?? null };

	// Date range (chart filter)
	const now = new Date();
	const defaultFrom = new Date(now.getFullYear(), now.getMonth() - 11, 1);
	const defaultTo = new Date(now.getFullYear(), now.getMonth() + 1, 0); // last day of current month

	const fromParam = url.searchParams.get('from');
	const toParam = url.searchParams.get('to');
	const rangeFrom = fromParam ? new Date(fromParam) : defaultFrom;
	const rangeTo = toParam ? new Date(toParam) : defaultTo;
	// start of next month after rangeTo for lt() comparison
	const rangeToExclusive = new Date(rangeTo.getFullYear(), rangeTo.getMonth() + 1, 1);

	// Stat dates (always current month, unaffected by range)
	const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
	const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

	// All student_savings entries for this plan
	const enrolled = await db
		.select({ id: studentSavings.id, createdAt: studentSavings.createdAt })
		.from(studentSavings)
		.where(eq(studentSavings.savingPlanId, planId));

	const ssIds = enrolled.map((s) => s.id);

	if (ssIds.length === 0) {
		const emptyMonthly = buildMonthArray(rangeFrom, rangeTo);
		const emptyGrouping = getGrouping(monthsBetween(rangeFrom, rangeTo));
		const emptyData =
			emptyGrouping === 'year' ? aggregateToYears(emptyMonthly) :
			emptyGrouping === 'quarter' ? aggregateToQuarters(emptyMonthly) :
			emptyMonthly;
		return {
			plans,
			report: {
				plan,
				totalCollected: 0,
				studentCount: 0,
				newStudentsThisMonth: 0,
				currentMonthTotal: 0,
				prevMonthTotal: 0,
				avgPerStudent: 0,
				reversalCount: 0,
				totalTransactions: 0,
				monthlyData: emptyData,
				rangeFrom: rangeFrom.toISOString().slice(0, 10),
				rangeTo: rangeTo.toISOString().slice(0, 10),
			},
			user: session?.user ?? null,
		};
	}

	// Total collected (DEPOSIT - WITHDRAW, non-reversed) — cumulative, no range filter
	const [totalRow] = await db
		.select({
			total: sql<string>`COALESCE(SUM(CASE WHEN type = 'DEPOSIT' THEN amount::numeric ELSE -amount::numeric END), 0)`,
		})
		.from(ledgerEntries)
		.where(and(inArray(ledgerEntries.studentSavingsId, ssIds), eq(ledgerEntries.isReversed, false)));

	// Current month deposits
	const [curRow] = await db
		.select({ total: sql<string>`COALESCE(SUM(amount::numeric), 0)` })
		.from(ledgerEntries)
		.where(
			and(
				inArray(ledgerEntries.studentSavingsId, ssIds),
				eq(ledgerEntries.type, 'DEPOSIT'),
				eq(ledgerEntries.isReversed, false),
				gte(ledgerEntries.createdAt, monthStart),
			),
		);

	// Previous month deposits
	const [prevRow] = await db
		.select({ total: sql<string>`COALESCE(SUM(amount::numeric), 0)` })
		.from(ledgerEntries)
		.where(
			and(
				inArray(ledgerEntries.studentSavingsId, ssIds),
				eq(ledgerEntries.type, 'DEPOSIT'),
				eq(ledgerEntries.isReversed, false),
				gte(ledgerEntries.createdAt, prevMonthStart),
				lt(ledgerEntries.createdAt, monthStart),
			),
		);

	// Reversals count
	const [revRow] = await db
		.select({ cnt: sql<string>`COUNT(*)` })
		.from(ledgerEntries)
		.where(and(inArray(ledgerEntries.studentSavingsId, ssIds), eq(ledgerEntries.isReversed, true)));

	// Total transactions
	const [txRow] = await db
		.select({ cnt: sql<string>`COUNT(*)` })
		.from(ledgerEntries)
		.where(inArray(ledgerEntries.studentSavingsId, ssIds));

	// Always fetch monthly, then aggregate to quarters in JS if range > 12 months
	const chartRaw = await db
		.select({
			month: sql<string>`TO_CHAR(DATE_TRUNC('month', ${ledgerEntries.createdAt}), 'YYYY-MM')`,
			total: sql<string>`COALESCE(SUM(${ledgerEntries.amount}::numeric), 0)`,
		})
		.from(ledgerEntries)
		.where(
			and(
				inArray(ledgerEntries.studentSavingsId, ssIds),
				eq(ledgerEntries.type, 'DEPOSIT'),
				eq(ledgerEntries.isReversed, false),
				gte(ledgerEntries.createdAt, rangeFrom),
				lt(ledgerEntries.createdAt, rangeToExclusive),
			),
		)
		.groupBy(sql`DATE_TRUNC('month', ${ledgerEntries.createdAt})`)
		.orderBy(sql`DATE_TRUNC('month', ${ledgerEntries.createdAt})`);

	const chartMap = new Map(chartRaw.map((r) => [r.month, Number(r.total)]));
	const monthlyFull = buildMonthArray(rangeFrom, rangeTo).map((m) => ({
		...m,
		total: chartMap.get(m.month) ?? 0,
	}));
	const grouping = getGrouping(monthsBetween(rangeFrom, rangeTo));
	const monthlyData =
		grouping === 'year' ? aggregateToYears(monthlyFull) :
		grouping === 'quarter' ? aggregateToQuarters(monthlyFull) :
		monthlyFull;

	const studentCount = enrolled.length;
	const newStudentsThisMonth = enrolled.filter((s) => new Date(s.createdAt) >= monthStart).length;
	const totalCollected = Number(totalRow?.total ?? 0);
	const currentMonthTotal = Number(curRow?.total ?? 0);
	const prevMonthTotal = Number(prevRow?.total ?? 0);
	const reversalCount = Number(revRow?.cnt ?? 0);
	const totalTransactions = Number(txRow?.cnt ?? 0);
	const avgPerStudent = studentCount > 0 ? Math.round(totalCollected / studentCount) : 0;

	return {
		plans,
		report: {
			plan,
			totalCollected,
			studentCount,
			newStudentsThisMonth,
			currentMonthTotal,
			prevMonthTotal,
			avgPerStudent,
			reversalCount,
			totalTransactions,
			monthlyData,
			rangeFrom: rangeFrom.toISOString().slice(0, 10),
			rangeTo: rangeTo.toISOString().slice(0, 10),
		},
		user: session?.user ?? null,
	};
};
