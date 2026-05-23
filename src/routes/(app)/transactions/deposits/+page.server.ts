// Import tipe data bawaan SvelteKit untuk load page dan handle form
import type { PageServerLoad, Actions } from './$types';
// Import koneksi ke database postgres
import { db } from '$lib/server/db';
// Import tabel ledgerEntries (catatan transaksi) dan studentSavings (tabungan siswa)
import { ledgerEntries, studentSavings } from '$lib/server/db/schema';
// Import fungsi query pembanding (eq) dan fungsi buat nulis SQL manual (sql) dari Drizzle ORM
import { eq, sql } from 'drizzle-orm';
// Import fail buat balikin respon error kalau form inputan salah
import { fail } from '@sveltejs/kit';

// Fungsi buat bikin nomor referensi unik otomatis (contoh: DEP-20260523-XYZ12)
function generateRefNo(): string {
	const now = new Date();
	// Ambil tanggal hari ini formatnya YYYYMMDD
	const date = now.toISOString().slice(0, 10).replace(/-/g, '');
	// Bikin kode acak 5 karakter huruf kapital
	const rand = Math.random().toString(36).slice(2, 7).toUpperCase();
	return `DEP-${date}-${rand}`;
}

// Fungsi load untuk kirim data awal ke frontend sebelum halaman dibuka
export const load: PageServerLoad = ({ locals }) => {
	// Kirim data user yang lagi login ke halaman web
	return { user: locals.user ?? null };
};

// Kumpulan aksi form (Form Actions) buat proses input dari user
export const actions: Actions = {
	// Aksi setoran tabungan (deposit)
	deposit: async ({ request, locals }) => {
		// Kalau user belum login, tolak akses dan balikin error 401
		if (!locals.user) return fail(401, { error: 'Unauthorized' });

		// Ambil data form yang dikirim dari browser
		const data = await request.formData();
		const studentSavingsId = data.get('studentSavingsId') as string; // ID rekening tabungan siswa
		const amountRaw = data.get('amount') as string; // Nominal setoran
		const description = (data.get('description') as string) || null; // Keterangan tambahan (opsional)

		// Ubah nominal setoran jadi tipe angka
		const amount = Number(amountRaw);
		// Validasi: ID rekening wajib diisi
		if (!studentSavingsId) return fail(400, { error: 'Missing savings account' });
		// Validasi: Nominal setoran harus lebih dari 0
		if (!amount || amount <= 0) return fail(400, { error: 'Amount must be greater than zero' });

		// Buat nomor referensi unik
		const referenceNo = generateRefNo();

		// Masukkan catatan transaksi setoran baru ke tabel buku besar (ledger)
		await db.insert(ledgerEntries).values({
			studentSavingsId,
			referenceNo,
			type: 'DEPOSIT',
			amount: String(amount),
			description,
			isReversed: false,
			createdBy: locals.user.id, // Catat siapa admin yang input
		});

		// Tambahkan saldo tabungan siswa di database
		await db
			.update(studentSavings)
			.set({
				// Saldo lama ditambah nominal setoran baru secara presisi desimal
				currentAmount: sql`${studentSavings.currentAmount}::numeric + ${amount}`,
				updatedBy: locals.user.id, // Catat siapa admin yang update saldo ini
			})
			.where(eq(studentSavings.id, studentSavingsId)); // Update khusus untuk siswa ini saja

		// Kirim tanda sukses dan nomor referensi ke frontend
		return { success: true, referenceNo };
	},
};
