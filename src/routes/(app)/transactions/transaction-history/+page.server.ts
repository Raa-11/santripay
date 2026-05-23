// Import tipe data load server bawaan SvelteKit
import type { PageServerLoad } from './$types';
// Import koneksi database postgres
import { db } from '$lib/server/db';
// Import skema tabel: ledgerEntries, studentSavings, students, savingPlans, userTable (operator), dan reversals
import { ledgerEntries, studentSavings, students, savingPlans, user as userTable, reversals } from '$lib/server/db/schema';
// Import pembanding Drizzle ORM
import { eq, desc, isNull } from 'drizzle-orm';
// Import fungsionalitas Effect untuk flow asinkron
import { Effect } from 'effect';

// Fungsi load server untuk mengambil data riwayat transaksi saat halaman dibuka
export const load: PageServerLoad = ({ locals }) => {
	// Kalau belum login, kembalikan daftar transaksi kosong
	if (!locals.user) return { transactions: [] };

	// Jalankan promise dalam format generator Effect
	return Effect.runPromise(
		Effect.gen(function* () {
			// Query gabungan (join) untuk mengambil data transaksi buku besar lengkap dengan detail siswa, program, operator, dan info pembatalan
			const rows = yield* Effect.promise(() =>
				db
					.select({
						referenceNo: ledgerEntries.referenceNo, // Nomor referensi transaksi
						entryId: ledgerEntries.id,             // ID transaksi
						createdAt: ledgerEntries.createdAt,     // Waktu transaksi dibuat
						type: ledgerEntries.type,               // Jenis transaksi (DEPOSIT/WITHDRAW)
						amount: ledgerEntries.amount,           // Nominal uang
						description: ledgerEntries.description, // Catatan keterangan
						isReversed: ledgerEntries.isReversed,   // Status dibatalkan atau tidak
						studentName: students.name,             // Nama santri
						studentNis: students.nis,               // NIS santri
						studentClass: students.class,           // Kelas santri
						planName: savingPlans.name,             // Nama program tabungan
						planCode: savingPlans.code,             // Kode program tabungan
						operatorName: userTable.name,           // Nama admin yang melayani
						reversalReason: reversals.reason,       // Alasan pembatalan (jika ada)
					})
					.from(ledgerEntries)
					// Hubungkan tabel ledger entries ke tabungan siswa
					.innerJoin(studentSavings, eq(ledgerEntries.studentSavingsId, studentSavings.id))
					// Hubungkan tabungan ke data siswa
					.innerJoin(students, eq(studentSavings.studentId, students.id))
					// Hubungkan tabungan ke data program tabungan
					.innerJoin(savingPlans, eq(studentSavings.savingPlanId, savingPlans.id))
					// Hubungkan pencipta transaksi ke data user (admin) sebagai operator
					.leftJoin(userTable, eq(ledgerEntries.createdBy, userTable.id))
					// Hubungkan transaksi ke tabel pembatalan (reversals) jika statusnya dibatalkan
					.leftJoin(reversals, eq(reversals.transferId, ledgerEntries.id))
					// Hanya ambil data transaksi yang belum dihapus secara soft-delete
					.where(isNull(ledgerEntries.deletedAt))
					// Urutkan berdasarkan waktu transaksi terbaru dahulu
					.orderBy(desc(ledgerEntries.createdAt))
					// Batasi hanya mengambil maksimal 200 transaksi terbaru
					.limit(200),
			);

			// Kembalikan daftar transaksi hasil query ke frontend
			return {
				transactions: rows.map((r) => ({
					referenceNo: r.referenceNo,
					entryId: r.entryId,
					createdAt: r.createdAt.toISOString(),
					type: r.type,
					amount: Number(r.amount),
					description: r.description,
					isReversed: r.isReversed,
					studentName: r.studentName,
					studentNis: r.studentNis,
					studentClass: r.studentClass,
					planName: r.planName,
					planCode: r.planCode,
					operatorName: r.operatorName,
					reversalReason: r.reversalReason,
				})),
			};
		}),
	);
};
