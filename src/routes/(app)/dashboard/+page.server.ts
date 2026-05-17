import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { savingPlans, studentSavings, ledgerEntries, students } from '$lib/server/db/schema';
import { auth } from '$lib/server/auth';
import { eq, and, sql, gte, lt, desc, isNull } from 'drizzle-orm';

export const load: PageServerLoad = async ({ request }) => {
	const session = await auth.api.getSession({ headers: request.headers });

	const now = new Date();
	// Use UTC throughout so Date.UTC keys match PostgreSQL DATE_TRUNC output
	const utcY = now.getUTCFullYear();
	const utcM = now.getUTCMonth();
	const utcD = now.getUTCDate();

	const todayStart    = new Date(Date.UTC(utcY, utcM, utcD));
	const tomorrowStart = new Date(Date.UTC(utcY, utcM, utcD + 1));
	const yesterday     = new Date(Date.UTC(utcY, utcM, utcD - 1));
	const monthStart    = new Date(Date.UTC(utcY, utcM, 1));

	// Current week Mon–Sun
	const dow = now.getUTCDay(); // 0=Sun … 6=Sat
	const daysFromMon = dow === 0 ? 6 : dow - 1;
	const weekStart     = new Date(Date.UTC(utcY, utcM, utcD - daysFromMon));     // this Monday
	const weekEnd       = new Date(Date.UTC(utcY, utcM, utcD - daysFromMon + 7)); // next Monday
	const prevWeekStart = new Date(Date.UTC(utcY, utcM, utcD - daysFromMon - 7)); // prev Monday

	// Current year
	const yearStart = new Date(Date.UTC(utcY, 0, 1));
	const yearEnd   = new Date(Date.UTC(utcY + 1, 0, 1));

	// Total current savings balance
	const [totalBalanceRow] = await db
		.select({ total: sql<string>`COALESCE(SUM(${studentSavings.currentAmount}::numeric), 0)` })
		.from(studentSavings)
		.where(isNull(studentSavings.deletedAt));

	// All-time gross deposits
	const [totalDepositsRow] = await db
		.select({ total: sql<string>`COALESCE(SUM(${ledgerEntries.amount}::numeric), 0)` })
		.from(ledgerEntries)
		.where(and(eq(ledgerEntries.type, 'DEPOSIT'), eq(ledgerEntries.isReversed, false)));

	// All-time gross withdrawals
	const [totalWithdrawalsRow] = await db
		.select({ total: sql<string>`COALESCE(SUM(${ledgerEntries.amount}::numeric), 0)` })
		.from(ledgerEntries)
		.where(and(eq(ledgerEntries.type, 'WITHDRAW'), eq(ledgerEntries.isReversed, false)));

	// Today's deposits
	const [todayRow] = await db
		.select({
			total: sql<string>`COALESCE(SUM(${ledgerEntries.amount}::numeric), 0)`,
			count: sql<string>`COUNT(*)`,
		})
		.from(ledgerEntries)
		.where(
			and(
				eq(ledgerEntries.type, 'DEPOSIT'),
				eq(ledgerEntries.isReversed, false),
				gte(ledgerEntries.createdAt, todayStart),
				lt(ledgerEntries.createdAt, tomorrowStart),
			),
		);

	// Yesterday's deposits (for change indicator)
	const [yesterdayRow] = await db
		.select({ total: sql<string>`COALESCE(SUM(${ledgerEntries.amount}::numeric), 0)` })
		.from(ledgerEntries)
		.where(
			and(
				eq(ledgerEntries.type, 'DEPOSIT'),
				eq(ledgerEntries.isReversed, false),
				gte(ledgerEntries.createdAt, yesterday),
				lt(ledgerEntries.createdAt, todayStart),
			),
		);

	// Active students
	const [activeStudentsRow] = await db
		.select({ count: sql<string>`COUNT(DISTINCT ${studentSavings.studentId})` })
		.from(studentSavings)
		.where(and(isNull(studentSavings.deletedAt), eq(studentSavings.status, 'ACTIVE')));

	// Total students (active + inactive)
	const [totalStudentsRow] = await db
		.select({ count: sql<string>`COUNT(DISTINCT ${studentSavings.studentId})` })
		.from(studentSavings)
		.where(isNull(studentSavings.deletedAt));

	// This week Mon–Sun deposits
	const [thisWeekRow] = await db
		.select({ total: sql<string>`COALESCE(SUM(${ledgerEntries.amount}::numeric), 0)` })
		.from(ledgerEntries)
		.where(
			and(
				eq(ledgerEntries.type, 'DEPOSIT'),
				eq(ledgerEntries.isReversed, false),
				gte(ledgerEntries.createdAt, weekStart),
				lt(ledgerEntries.createdAt, weekEnd),
			),
		);

	// Previous week Mon–Sun deposits (for comparison)
	const [prevWeekRow] = await db
		.select({ total: sql<string>`COALESCE(SUM(${ledgerEntries.amount}::numeric), 0)` })
		.from(ledgerEntries)
		.where(
			and(
				eq(ledgerEntries.type, 'DEPOSIT'),
				eq(ledgerEntries.isReversed, false),
				gte(ledgerEntries.createdAt, prevWeekStart),
				lt(ledgerEntries.createdAt, weekStart),
			),
		);

	// This month's deposits (for overview stats)
	const [thisMonthRow] = await db
		.select({ total: sql<string>`COALESCE(SUM(${ledgerEntries.amount}::numeric), 0)` })
		.from(ledgerEntries)
		.where(
			and(
				eq(ledgerEntries.type, 'DEPOSIT'),
				eq(ledgerEntries.isReversed, false),
				gte(ledgerEntries.createdAt, monthStart),
			),
		);

	// Weekly chart: Mon–Sun, deposit + withdraw per day
	const weeklyRaw = await db
		.select({
			day: sql<string>`TO_CHAR(DATE_TRUNC('day', ${ledgerEntries.createdAt}), 'YYYY-MM-DD')`,
			type: ledgerEntries.type,
			total: sql<string>`COALESCE(SUM(${ledgerEntries.amount}::numeric), 0)`,
		})
		.from(ledgerEntries)
		.where(and(eq(ledgerEntries.isReversed, false), gte(ledgerEntries.createdAt, weekStart), lt(ledgerEntries.createdAt, weekEnd)))
		.groupBy(sql`DATE_TRUNC('day', ${ledgerEntries.createdAt})`, ledgerEntries.type)
		.orderBy(sql`DATE_TRUNC('day', ${ledgerEntries.createdAt})`);

	const weeklyDepMap = new Map<string, number>();
	const weeklyWthMap = new Map<string, number>();
	for (const r of weeklyRaw) {
		if (r.type === 'DEPOSIT') weeklyDepMap.set(r.day, Number(r.total));
		else weeklyWthMap.set(r.day, Number(r.total));
	}

	const dailyData = Array.from({ length: 7 }, (_, i) => {
		const d = new Date(Date.UTC(utcY, utcM, utcD - daysFromMon + i));
		const key = d.toISOString().slice(0, 10);
		return {
			day: key,
			label: d.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' }),
			deposit: weeklyDepMap.get(key) ?? 0,
			withdraw: weeklyWthMap.get(key) ?? 0,
		};
	});

	// Yearly chart: Jan–Dec, deposit + withdraw per month
	const yearlyRaw = await db
		.select({
			month: sql<string>`TO_CHAR(DATE_TRUNC('month', ${ledgerEntries.createdAt}), 'YYYY-MM')`,
			type: ledgerEntries.type,
			total: sql<string>`COALESCE(SUM(${ledgerEntries.amount}::numeric), 0)`,
		})
		.from(ledgerEntries)
		.where(and(eq(ledgerEntries.isReversed, false), gte(ledgerEntries.createdAt, yearStart), lt(ledgerEntries.createdAt, yearEnd)))
		.groupBy(sql`DATE_TRUNC('month', ${ledgerEntries.createdAt})`, ledgerEntries.type)
		.orderBy(sql`DATE_TRUNC('month', ${ledgerEntries.createdAt})`);

	const yearlyDepMap = new Map<string, number>();
	const yearlyWthMap = new Map<string, number>();
	for (const r of yearlyRaw) {
		if (r.type === 'DEPOSIT') yearlyDepMap.set(r.month, Number(r.total));
		else yearlyWthMap.set(r.month, Number(r.total));
	}

	const monthlyData = Array.from({ length: 12 }, (_, i) => {
		const d = new Date(Date.UTC(utcY, i, 1));
		const key = `${utcY}-${String(i + 1).padStart(2, '0')}`;
		return {
			month: key,
			label: d.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' }),
			deposit: yearlyDepMap.get(key) ?? 0,
			withdraw: yearlyWthMap.get(key) ?? 0,
		};
	});

	// Recent transactions with student and plan info
	const recentTx = await db
		.select({
			id: ledgerEntries.id,
			type: ledgerEntries.type,
			amount: ledgerEntries.amount,
			isReversed: ledgerEntries.isReversed,
			referenceNo: ledgerEntries.referenceNo,
			createdAt: ledgerEntries.createdAt,
			studentName: students.name,
			planName: savingPlans.name,
		})
		.from(ledgerEntries)
		.innerJoin(studentSavings, eq(ledgerEntries.studentSavingsId, studentSavings.id))
		.innerJoin(students, eq(studentSavings.studentId, students.id))
		.innerJoin(savingPlans, eq(studentSavings.savingPlanId, savingPlans.id))
		.orderBy(desc(ledgerEntries.createdAt))
		.limit(8);

	// Active programs with student count and collected balance
	const programRows = await db
		.select({
			id: savingPlans.id,
			name: savingPlans.name,
			code: savingPlans.code,
			savingType: savingPlans.savingType,
			defaultTargetAmount: savingPlans.defaultTargetAmount,
			studentCount: sql<string>`COUNT(DISTINCT ${studentSavings.id})`,
			totalCollected: sql<string>`COALESCE(SUM(${studentSavings.currentAmount}::numeric), 0)`,
		})
		.from(savingPlans)
		.leftJoin(
			studentSavings,
			and(eq(studentSavings.savingPlanId, savingPlans.id), isNull(studentSavings.deletedAt)),
		)
		.where(and(eq(savingPlans.isActive, true), isNull(savingPlans.deletedAt)))
		.groupBy(savingPlans.id)
		.orderBy(savingPlans.createdAt)
		.limit(4);

	return {
		user: session?.user ?? null,
		totalBalance: Number(totalBalanceRow?.total ?? 0),
		totalDeposits: Number(totalDepositsRow?.total ?? 0),
		totalWithdrawals: Number(totalWithdrawalsRow?.total ?? 0),
		todayDeposits: Number(todayRow?.total ?? 0),
		todayCount: Number(todayRow?.count ?? 0),
		yesterdayDeposits: Number(yesterdayRow?.total ?? 0),
		activeStudents: Number(activeStudentsRow?.count ?? 0),
		totalStudents: Number(totalStudentsRow?.count ?? 0),
		thisWeekDeposits: Number(thisWeekRow?.total ?? 0),
		prevWeekDeposits: Number(prevWeekRow?.total ?? 0),
		thisMonthDeposits: Number(thisMonthRow?.total ?? 0),
		dailyData,
		monthlyData,
		recentTx: recentTx.map((tx) => ({
			...tx,
			amount: Number(tx.amount),
			createdAt: tx.createdAt.toISOString(),
		})),
		programs: programRows.map((p) => ({
			...p,
			defaultTargetAmount: p.defaultTargetAmount ? Number(p.defaultTargetAmount) : null,
			studentCount: Number(p.studentCount),
			totalCollected: Number(p.totalCollected),
		})),
	};
};
