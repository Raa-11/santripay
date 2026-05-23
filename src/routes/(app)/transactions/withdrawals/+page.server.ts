// Import tipe data bawaan SvelteKit untuk load page server dan handle form actions
import type { PageServerLoad, Actions } from './$types';
// Import koneksi database
import { db } from '$lib/server/db';
// Import tabel-tabel database: ledgerEntries, studentSavings, dan savingPlans
import { ledgerEntries, studentSavings, savingPlans } from '$lib/server/db/schema';
// Import fungsi pembantu query dari Drizzle ORM
import { eq, sql, and, isNull } from 'drizzle-orm';
// Import fail untuk kirim respon error kalau ada input form yang salah
import { fail } from '@sveltejs/kit';
// Import Decimal.js biar hitungan desimal uang/pembagian nominal tetap pas dan presisi
import Decimal from 'decimal.js';

// Fungsi bikin nomor referensi transaksi unik (contoh: WTH-20260523-ABCDE)
function generateRefNo(prefix: string): string {
	const now = new Date();
	// Ambil tanggal format YYYYMMDD
	const date = now.toISOString().slice(0, 10).replace(/-/g, '');
	// Bikin kode acak 5 karakter huruf kapital
	const rand = Math.random().toString(36).slice(2, 7).toUpperCase();
	return `${prefix}-${date}-${rand}`;
}

// Fungsi load server untuk mengambil data program tabungan aktif sebelum halaman dibuka
export const load: PageServerLoad = async ({ locals }) => {
	// Query data program tabungan yang statusnya aktif dan belum dihapus
	const plans = await db
		.select({ id: savingPlans.id, name: savingPlans.name, code: savingPlans.code })
		.from(savingPlans)
		.where(and(eq(savingPlans.isActive, true), isNull(savingPlans.deletedAt)))
		.orderBy(savingPlans.name);

	// Kirim data user yang sedang login dan daftar program tabungan ke frontend
	return { user: locals.user ?? null, plans };
};

// Kumpulan aksi form untuk memproses penarikan uang
export const actions: Actions = {
	// 1. Aksi penarikan tunggal untuk satu orang santri
	withdraw: async ({ request, locals }) => {
		// Validasi: Harus login dulu
		if (!locals.user) return fail(401, { error: 'Unauthorized' });

		// Ambil data form yang diisi user di browser
		const data = await request.formData();
		const studentSavingsId = data.get('studentSavingsId') as string; // Rekening tabungan santri
		const amountRaw = data.get('amount') as string; // Uang yang mau ditarik
		const description = (data.get('description') as string) || null; // Catatan tambahan (opsional)

		const amount = Number(amountRaw);
		// Validasi: Rekening santri tidak boleh kosong
		if (!studentSavingsId) return fail(400, { error: 'Missing savings account' });
		// Validasi: Jumlah penarikan harus lebih besar dari nol
		if (!amount || amount <= 0) return fail(400, { error: 'Amount must be greater than zero' });

		// Cari data tabungan siswa terkait di database
		const [ss] = await db
			.select({ currentAmount: studentSavings.currentAmount })
			.from(studentSavings)
			.where(eq(studentSavings.id, studentSavingsId));

		// Validasi: Rekening tidak ditemukan
		if (!ss) return fail(400, { error: 'Savings account not found' });

		// Validasi saldo: Saldo santri harus cukup untuk ditarik
		const currentBalance = Number(ss.currentAmount);
		if (amount > currentBalance) {
			return fail(400, {
				error: `Insufficient balance. Available: Rp ${new Intl.NumberFormat('id-ID').format(currentBalance)}`,
			});
		}

		// Bikin nomor referensi penarikan (Prefix: WTH)
		const referenceNo = generateRefNo('WTH');

		// Masukkan riwayat penarikan ke tabel buku besar (ledger)
		await db.insert(ledgerEntries).values({
			studentSavingsId,
			referenceNo,
			type: 'WITHDRAW', // Tipe: Penarikan
			amount: String(amount),
			description,
			isReversed: false,
			createdBy: locals.user.id,
		});

		// Potong saldo tabungan santri di database
		await db
			.update(studentSavings)
			.set({
				currentAmount: sql`${studentSavings.currentAmount}::numeric - ${amount}`,
				updatedBy: locals.user.id,
			})
			.where(eq(studentSavings.id, studentSavingsId));

		// Kirim status sukses dan nomor referensi ke frontend
		return { success: true, referenceNo };
	},

	// 2. Aksi penarikan massal (membagi rata nominal penarikan ke semua anggota program tabungan)
	bulkWithdraw: async ({ request, locals }) => {
		// Validasi: Harus login dulu
		if (!locals.user) return fail(401, { error: 'Unauthorized' });

		// Ambil data form
		const data = await request.formData();
		const savingPlanId = data.get('savingPlanId') as string; // ID program tabungan
		const totalAmountRaw = data.get('totalAmount') as string; // Total uang yang mau ditarik massal

		// Validasi: Program tabungan harus dipilih
		if (!savingPlanId) return fail(400, { error: 'Missing saving plan' });

		// Pakai Decimal.js buat ngehindari bug koma/desimal javascript
		const totalAmount = new Decimal(totalAmountRaw || '0');
		// Validasi: Nominal penarikan harus lebih dari 0
		if (totalAmount.lte(0)) return fail(400, { error: 'Amount must be greater than zero' });

		// Ambil semua rekening santri yang terdaftar di program ini dan punya saldo lebih dari 0
		const savings = await db
			.select({ id: studentSavings.id, currentAmount: studentSavings.currentAmount })
			.from(studentSavings)
			.where(
				and(
					eq(studentSavings.savingPlanId, savingPlanId),
					isNull(studentSavings.deletedAt),
					sql`${studentSavings.currentAmount}::numeric > 0`,
				),
			)
			.orderBy(studentSavings.id);

		// Validasi: Minimal ada satu santri yang punya saldo di program ini
		if (savings.length === 0) return fail(400, { error: 'No students with balance in this saving plan' });

		const count = savings.length;
		// Bagi rata nominal total penarikan ke jumlah santri
		const base = totalAmount.divToInt(count);
		// Ambil sisa pembagian desimalnya
		const remainderCount = totalAmount.mod(count).toNumber();

		// Susun distribusi nominal penarikan untuk tiap santri
		const distributions = savings
			.map((s, i) => {
				const balance = new Decimal(s.currentAmount);
				// Santri di urutan awal (sebanyak sisa bagi) dapat tambahan Rp 1 biar totalnya pas presisi
				let share = i < remainderCount ? base.plus(1) : base;
				// Nominal ditarik tidak boleh melebihi saldo yang dimiliki santri tersebut
				if (share.greaterThan(balance)) share = balance;
				return { id: s.id, share };
			})
			.filter((d) => d.share.greaterThan(0)); // Filter santri yang nominal penarikannya di atas 0

		// Validasi: Harus ada santri yang bisa diproses penarikannya
		if (distributions.length === 0) return fail(400, { error: 'No eligible students to process' });

		// Bikin nomor referensi penarikan massal (Prefix: BWTH)
		const referenceNo = generateRefNo('BWTH');
		// Hitung total akhir dari akumulasi pembagian uang
		const actualTotal = distributions.reduce((s, d) => s.plus(d.share), new Decimal(0));

		// Catat semua transaksi penarikan santri tersebut ke tabel buku besar (ledger) sekaligus
		await db.insert(ledgerEntries).values(
			distributions.map((d) => ({
				studentSavingsId: d.id,
				referenceNo,
				type: 'WITHDRAW' as const,
				amount: d.share.toString(),
				isReversed: false,
				createdBy: locals.user!.id,
			})),
		);

		// Gunakan query kustom SQL massal untuk update saldo di database sekaligus (menghindari lambatnya server Neon)
		const valueChunks = distributions.map((d) => sql`(${d.id}::uuid, ${d.share.toString()}::numeric)`);
		await db.execute(sql`
			UPDATE student_savings ss
			SET current_amount = ss.current_amount::numeric - updates.amount,
			    updated_by = ${locals.user!.id},
			    updated_at = now()
			FROM (VALUES ${sql.join(valueChunks, sql`, `)}) AS updates(id, amount)
			WHERE ss.id = updates.id
		`);

		// Balikin data sukses beserta rekap penarikan
		return {
			success: true,
			referenceNo,
			processedCount: distributions.length, // Berapa santri yang berhasil dipotong saldonya
			actualTotal: actualTotal.toString(), // Total uang yang berhasil ditarik
		};
	},
};
