import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { savingPlans, studentSavings, ledgerEntries, students } from '$lib/server/db/schema';
import { eq, and, sql, gte, lt, desc, isNull } from 'drizzle-orm';

export const load: PageServerLoad = async ({ locals }) => {

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

	const [
		[totalBalanceRow],
		grossStats,
		[todayYesterdayRow],
		[studentStatsRow],
		[periodStatsRow],
		weeklyRaw,
		yearlyRaw,
		recentTx,
		programRows,
	] = await Promise.all([
		// Total current savings balance (1)
		db
			.select({ total: sql<string>`COALESCE(SUM(${studentSavings.currentAmount}::numeric), 0)` })
			.from(studentSavings)
			.where(isNull(studentSavings.deletedAt)),

		// All-time gross deposits & withdrawals (2)
		db
			.select({
				type: ledgerEntries.type,
				total: sql<string>`COALESCE(SUM(${ledgerEntries.amount}::numeric), 0)`
			})
			.from(ledgerEntries)
			.where(eq(ledgerEntries.isReversed, false))
			.groupBy(ledgerEntries.type),

		// Today & Yesterday's deposits (3)
		db
			.select({
				todayTotal: sql<string>`COALESCE(SUM(CASE WHEN ${ledgerEntries.createdAt} >= ${todayStart} AND ${ledgerEntries.createdAt} < ${tomorrowStart} THEN ${ledgerEntries.amount}::numeric END), 0)`,
				todayCount: sql<string>`COUNT(CASE WHEN ${ledgerEntries.createdAt} >= ${todayStart} AND ${ledgerEntries.createdAt} < ${tomorrowStart} THEN 1 END)`,
				yesterdayTotal: sql<string>`COALESCE(SUM(CASE WHEN ${ledgerEntries.createdAt} >= ${yesterday} AND ${ledgerEntries.createdAt} < ${todayStart} THEN ${ledgerEntries.amount}::numeric END), 0)`
			})
			.from(ledgerEntries)
			.where(
				and(
					eq(ledgerEntries.type, 'DEPOSIT'),
					eq(ledgerEntries.isReversed, false),
					gte(ledgerEntries.createdAt, yesterday),
					lt(ledgerEntries.createdAt, tomorrowStart)
				)
			),

		// Active & Total students (4)
		db
			.select({
				activeCount: sql<string>`COUNT(DISTINCT CASE WHEN ${studentSavings.status} = 'ACTIVE' THEN ${studentSavings.studentId} END)`,
				totalCount: sql<string>`COUNT(DISTINCT ${studentSavings.studentId})`
			})
			.from(studentSavings)
			.where(isNull(studentSavings.deletedAt)),

		// Period stats: This week, Prev week, and This month's deposits (5)
		db
			.select({
				thisWeekTotal: sql<string>`COALESCE(SUM(CASE WHEN ${ledgerEntries.createdAt} >= ${weekStart} AND ${ledgerEntries.createdAt} < ${weekEnd} THEN ${ledgerEntries.amount}::numeric END), 0)`,
				prevWeekTotal: sql<string>`COALESCE(SUM(CASE WHEN ${ledgerEntries.createdAt} >= ${prevWeekStart} AND ${ledgerEntries.createdAt} < ${weekStart} THEN ${ledgerEntries.amount}::numeric END), 0)`,
				thisMonthTotal: sql<string>`COALESCE(SUM(CASE WHEN ${ledgerEntries.createdAt} >= ${monthStart} THEN ${ledgerEntries.amount}::numeric END), 0)`
			})
			.from(ledgerEntries)
			.where(
				and(
					eq(ledgerEntries.type, 'DEPOSIT'),
					eq(ledgerEntries.isReversed, false),
					gte(ledgerEntries.createdAt, prevWeekStart < monthStart ? prevWeekStart : monthStart)
				)
			),

		// Weekly chart: Mon–Sun, deposit + withdraw per day (6)
		db
			.select({
				day: sql<string>`TO_CHAR(DATE_TRUNC('day', ${ledgerEntries.createdAt}), 'YYYY-MM-DD')`,
				type: ledgerEntries.type,
				total: sql<string>`COALESCE(SUM(${ledgerEntries.amount}::numeric), 0)`,
			})
			.from(ledgerEntries)
			.where(and(eq(ledgerEntries.isReversed, false), gte(ledgerEntries.createdAt, weekStart), lt(ledgerEntries.createdAt, weekEnd)))
			.groupBy(sql`DATE_TRUNC('day', ${ledgerEntries.createdAt})`, ledgerEntries.type)
			.orderBy(sql`DATE_TRUNC('day', ${ledgerEntries.createdAt})`),

		// Yearly chart: Jan–Dec, deposit + withdraw per month (7)
		db
			.select({
				month: sql<string>`TO_CHAR(DATE_TRUNC('month', ${ledgerEntries.createdAt}), 'YYYY-MM')`,
				type: ledgerEntries.type,
				total: sql<string>`COALESCE(SUM(${ledgerEntries.amount}::numeric), 0)`,
			})
			.from(ledgerEntries)
			.where(and(eq(ledgerEntries.isReversed, false), gte(ledgerEntries.createdAt, yearStart), lt(ledgerEntries.createdAt, yearEnd)))
			.groupBy(sql`DATE_TRUNC('month', ${ledgerEntries.createdAt})`, ledgerEntries.type)
			.orderBy(sql`DATE_TRUNC('month', ${ledgerEntries.createdAt})`),

		// Recent transactions with student and plan info (8)
		db
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
			.limit(8),

		// Active programs with student count and collected balance (9)
		db
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
			.limit(4),
	]);

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

	return {
		user: locals.user,
		totalBalance: Number(totalBalanceRow?.total ?? 0),
		totalDeposits: Number(grossStats.find((r) => r.type === 'DEPOSIT')?.total ?? 0),
		totalWithdrawals: Number(grossStats.find((r) => r.type === 'WITHDRAW')?.total ?? 0),
		todayDeposits: Number(todayYesterdayRow?.todayTotal ?? 0),
		todayCount: Number(todayYesterdayRow?.todayCount ?? 0),
		yesterdayDeposits: Number(todayYesterdayRow?.yesterdayTotal ?? 0),
		activeStudents: Number(studentStatsRow?.activeCount ?? 0),
		totalStudents: Number(studentStatsRow?.totalCount ?? 0),
		thisWeekDeposits: Number(periodStatsRow?.thisWeekTotal ?? 0),
		prevWeekDeposits: Number(periodStatsRow?.prevWeekTotal ?? 0),
		thisMonthDeposits: Number(periodStatsRow?.thisMonthTotal ?? 0),
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
