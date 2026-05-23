// Import tipe data RequestHandler bawaan SvelteKit untuk handle request API GET
import type { RequestHandler } from './$types';
// Import helper 'json' dari SvelteKit buat balikin data format JSON
import { json } from '@sveltejs/kit';
// Import koneksi database postgres
import { db } from '$lib/server/db';
// Import skema tabel: savingPlans, studentSavings, ledgerEntries, dan students
import { savingPlans, studentSavings, ledgerEntries, students } from '$lib/server/db/schema';
// Import fungsi operator query Drizzle ORM
import { eq, and, sql, gte, lt, desc, isNull } from 'drizzle-orm';

// Handler request GET untuk mengambil data ringkasan statistik dasbor
export const GET: RequestHandler = async ({ locals }) => {
	// Validasi: Kalau user belum login, tolak akses dengan error 401
	if (!locals.user) return new Response('Unauthorized', { status: 401 });

	// Ambil waktu saat ini dalam UTC untuk kalkulasi filter rentang tanggal
	const now = new Date();
	const utcY = now.getUTCFullYear();
	const utcM = now.getUTCMonth();
	const utcD = now.getUTCDate();

	// Tentukan waktu awal hari ini, besok, kemarin, dan awal bulan ini
	const todayStart    = new Date(Date.UTC(utcY, utcM, utcD));
	const tomorrowStart = new Date(Date.UTC(utcY, utcM, utcD + 1));
	const yesterday     = new Date(Date.UTC(utcY, utcM, utcD - 1));
	const monthStart    = new Date(Date.UTC(utcY, utcM, 1));

	// Tentukan hari aktif dalam seminggu untuk rentang statistik mingguan (Senin-Minggu)
	const dow           = now.getUTCDay();
	const daysFromMon   = dow === 0 ? 6 : dow - 1;
	const weekStart     = new Date(Date.UTC(utcY, utcM, utcD - daysFromMon));
	const weekEnd       = new Date(Date.UTC(utcY, utcM, utcD - daysFromMon + 7));
	const prevWeekStart = new Date(Date.UTC(utcY, utcM, utcD - daysFromMon - 7));

	// Tentukan batas awal tahun ini dan awal tahun depan
	const yearStart = new Date(Date.UTC(utcY, 0, 1));
	const yearEnd   = new Date(Date.UTC(utcY + 1, 0, 1));

	// Jalankan semua query database secara paralel agar loading halaman dasbor cepat
	const [
		[savingsStatsRow], // Data total saldo dan jumlah siswa aktif
		[ledgerStatsRow],  // Data total setoran dan penarikan berdasarkan tanggal
		weeklyRaw,         // Data grafik setoran dan penarikan mingguan
		yearlyRaw,         // Data grafik setoran dan penarikan tahunan
		recentTx,          // Daftar 8 transaksi terbaru
		programRows,       // Daftar 4 program tabungan aktif terpopuler
	] = await Promise.all([
		// Query 1: Total saldo aktif dan jumlah santri yang terdaftar
		db
			.select({
				totalBalance:  sql<string>`COALESCE(SUM(${studentSavings.currentAmount}::numeric), 0)`,
				activeCount:   sql<string>`COUNT(DISTINCT CASE WHEN ${studentSavings.status} = 'ACTIVE' THEN ${studentSavings.studentId} END)`,
				totalCount:    sql<string>`COUNT(DISTINCT ${studentSavings.studentId})`,
			})
			.from(studentSavings)
			.where(isNull(studentSavings.deletedAt)),

		// Query 2: Ringkasan total setoran & penarikan untuk hari ini, kemarin, minggu ini, dan bulan ini
		db
			.select({
				grossDeposits:    sql<string>`COALESCE(SUM(CASE WHEN ${ledgerEntries.type} = 'DEPOSIT'  THEN ${ledgerEntries.amount}::numeric END), 0)`,
				grossWithdrawals: sql<string>`COALESCE(SUM(CASE WHEN ${ledgerEntries.type} = 'WITHDRAW' THEN ${ledgerEntries.amount}::numeric END), 0)`,
				todayTotal:       sql<string>`COALESCE(SUM(CASE WHEN ${ledgerEntries.type} = 'DEPOSIT' AND ${ledgerEntries.createdAt} >= ${todayStart}    AND ${ledgerEntries.createdAt} < ${tomorrowStart} THEN ${ledgerEntries.amount}::numeric END), 0)`,
				todayCount:       sql<string>`COUNT(       CASE WHEN ${ledgerEntries.type} = 'DEPOSIT' AND ${ledgerEntries.createdAt} >= ${todayStart}    AND ${ledgerEntries.createdAt} < ${tomorrowStart} THEN 1 END)`,
				yesterdayTotal:   sql<string>`COALESCE(SUM(CASE WHEN ${ledgerEntries.type} = 'DEPOSIT' AND ${ledgerEntries.createdAt} >= ${yesterday}     AND ${ledgerEntries.createdAt} < ${todayStart}    THEN ${ledgerEntries.amount}::numeric END), 0)`,
				thisWeekTotal:    sql<string>`COALESCE(SUM(CASE WHEN ${ledgerEntries.type} = 'DEPOSIT' AND ${ledgerEntries.createdAt} >= ${weekStart}     AND ${ledgerEntries.createdAt} < ${weekEnd}       THEN ${ledgerEntries.amount}::numeric END), 0)`,
				prevWeekTotal:    sql<string>`COALESCE(SUM(CASE WHEN ${ledgerEntries.type} = 'DEPOSIT' AND ${ledgerEntries.createdAt} >= ${prevWeekStart} AND ${ledgerEntries.createdAt} < ${weekStart}     THEN ${ledgerEntries.amount}::numeric END), 0)`,
				thisMonthTotal:   sql<string>`COALESCE(SUM(CASE WHEN ${ledgerEntries.type} = 'DEPOSIT' AND ${ledgerEntries.createdAt} >= ${monthStart}    THEN ${ledgerEntries.amount}::numeric END), 0)`,
			})
			.from(ledgerEntries)
			.where(eq(ledgerEntries.isReversed, false)), // Jangan hitung transaksi yang sudah dibatalkan

		// Query 3: Ambil data transaksi harian minggu ini untuk data grafik
		db
			.select({
				day:   sql<string>`TO_CHAR(DATE_TRUNC('day', ${ledgerEntries.createdAt}), 'YYYY-MM-DD')`,
				type:  ledgerEntries.type,
				total: sql<string>`COALESCE(SUM(${ledgerEntries.amount}::numeric), 0)`,
			})
			.from(ledgerEntries)
			.where(and(eq(ledgerEntries.isReversed, false), gte(ledgerEntries.createdAt, weekStart), lt(ledgerEntries.createdAt, weekEnd)))
			.groupBy(sql`DATE_TRUNC('day', ${ledgerEntries.createdAt})`, ledgerEntries.type)
			.orderBy(sql`DATE_TRUNC('day', ${ledgerEntries.createdAt})`),

		// Query 4: Ambil data transaksi bulanan tahun ini untuk data grafik
		db
			.select({
				month: sql<string>`TO_CHAR(DATE_TRUNC('month', ${ledgerEntries.createdAt}), 'YYYY-MM')`,
				type:  ledgerEntries.type,
				total: sql<string>`COALESCE(SUM(${ledgerEntries.amount}::numeric), 0)`,
			})
			.from(ledgerEntries)
			.where(and(eq(ledgerEntries.isReversed, false), gte(ledgerEntries.createdAt, yearStart), lt(ledgerEntries.createdAt, yearEnd)))
			.groupBy(sql`DATE_TRUNC('month', ${ledgerEntries.createdAt})`, ledgerEntries.type)
			.orderBy(sql`DATE_TRUNC('month', ${ledgerEntries.createdAt})`),

		// Query 5: Ambil 8 transaksi terakhir untuk daftar aktivitas terbaru di dasbor
		db
			.select({
				id:          ledgerEntries.id,
				type:        ledgerEntries.type,
				amount:      ledgerEntries.amount,
				isReversed:  ledgerEntries.isReversed,
				referenceNo: ledgerEntries.referenceNo,
				createdAt:   ledgerEntries.createdAt,
				studentName: students.name,
				planName:    savingPlans.name,
			})
			.from(ledgerEntries)
			.innerJoin(studentSavings, eq(ledgerEntries.studentSavingsId, studentSavings.id))
			.innerJoin(students, eq(studentSavings.studentId, students.id))
			.innerJoin(savingPlans, eq(studentSavings.savingPlanId, savingPlans.id))
			.orderBy(desc(ledgerEntries.createdAt))
			.limit(8),

		// Query 6: Ambil 4 program tabungan terpopuler berdasarkan keaktifan
		db
			.select({
				id:                   savingPlans.id,
				name:                 savingPlans.name,
				code:                 savingPlans.code,
				savingType:           savingPlans.savingType,
				defaultTargetAmount:  savingPlans.defaultTargetAmount,
				studentCount:         sql<string>`COUNT(DISTINCT ${studentSavings.id})`,
				totalCollected:       sql<string>`COALESCE(SUM(${studentSavings.currentAmount}::numeric), 0)`,
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

	// Susun data mingguan dari database ke dalam map (agar mudah dicari)
	const weeklyDepMap = new Map<string, number>();
	const weeklyWthMap = new Map<string, number>();
	for (const r of weeklyRaw) {
		if (r.type === 'DEPOSIT') weeklyDepMap.set(r.day, Number(r.total));
		else weeklyWthMap.set(r.day, Number(r.total));
	}

	// Buat struktur array 7 hari (Senin-Minggu) untuk disajikan ke grafik frontend
	const dailyData = Array.from({ length: 7 }, (_, i) => {
		const d = new Date(Date.UTC(utcY, utcM, utcD - daysFromMon + i));
		const key = d.toISOString().slice(0, 10);
		return {
			day:      key,
			label:    d.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' }),
			deposit:  weeklyDepMap.get(key) ?? 0,
			withdraw: weeklyWthMap.get(key) ?? 0,
		};
	});

	// Susun data bulanan tahunan ke dalam map
	const yearlyDepMap = new Map<string, number>();
	const yearlyWthMap = new Map<string, number>();
	for (const r of yearlyRaw) {
		if (r.type === 'DEPOSIT') yearlyDepMap.set(r.month, Number(r.total));
		else yearlyWthMap.set(r.month, Number(r.total));
	}

	// Buat struktur array 12 bulan (Jan-Des) untuk grafik tahunan di frontend
	const monthlyData = Array.from({ length: 12 }, (_, i) => {
		const key = `${utcY}-${String(i + 1).padStart(2, '0')}`;
		const d   = new Date(Date.UTC(utcY, i, 1));
		return {
			month:    key,
			label:    d.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' }),
			deposit:  yearlyDepMap.get(key) ?? 0,
			withdraw: yearlyWthMap.get(key) ?? 0,
		};
	});

	// Kembalikan semua data statistik dalam format JSON yang bersih dan rapi
	return json({
		totalBalance:       Number(savingsStatsRow?.totalBalance ?? 0),
		totalDeposits:      Number(ledgerStatsRow?.grossDeposits ?? 0),
		totalWithdrawals:   Number(ledgerStatsRow?.grossWithdrawals ?? 0),
		todayDeposits:      Number(ledgerStatsRow?.todayTotal ?? 0),
		todayCount:         Number(ledgerStatsRow?.todayCount ?? 0),
		yesterdayDeposits:  Number(ledgerStatsRow?.yesterdayTotal ?? 0),
		activeStudents:     Number(savingsStatsRow?.activeCount ?? 0),
		totalStudents:      Number(savingsStatsRow?.totalCount ?? 0),
		thisWeekDeposits:   Number(ledgerStatsRow?.thisWeekTotal ?? 0),
		prevWeekDeposits:   Number(ledgerStatsRow?.prevWeekTotal ?? 0),
		thisMonthDeposits:  Number(ledgerStatsRow?.thisMonthTotal ?? 0),
		dailyData,
		monthlyData,
		recentTx: recentTx.map((tx) => ({
			...tx,
			amount:    Number(tx.amount),
			createdAt: tx.createdAt.toISOString(),
		})),
		programs: programRows.map((p) => ({
			...p,
			defaultTargetAmount: p.defaultTargetAmount ? Number(p.defaultTargetAmount) : null,
			studentCount:        Number(p.studentCount),
			totalCollected:      Number(p.totalCollected),
		})),
	});
};
