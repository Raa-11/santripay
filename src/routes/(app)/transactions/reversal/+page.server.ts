// Import tipe data load server dan form actions bawaan SvelteKit
import type { PageServerLoad, Actions } from './$types';
// Import koneksi database postgres
import { db } from '$lib/server/db';
// Import skema tabel: ledgerEntries, studentSavings, students, savingPlans, dan reversals
import { ledgerEntries, studentSavings, students, savingPlans, reversals } from '$lib/server/db/schema';
// Import fungsi pembantu query Drizzle ORM
import { eq, desc, and, isNull, sql } from 'drizzle-orm';
// Import library Effect dan Schema buat validasi data fungsional
import { Effect, Schema } from 'effect';
// Import superValidate dan message dari sveltekit-superforms buat urus form validation
import { superValidate, message } from 'sveltekit-superforms';
// Import adapter effect buat superforms
import { effect } from 'sveltekit-superforms/adapters';
// Import fail untuk response error form actions
import { fail } from '@sveltejs/kit';

// Bikin skema validasi data form pembatalan transaksi (reversal)
const ReversalSchema = Schema.Struct({
	entryId: Schema.String.pipe(Schema.minLength(1)), // ID transaksi wajib ada
	reason: Schema.optional(Schema.String), // Alasan batal sifatnya opsional
});

// Daftarkan skema ke adapter superforms
const reversalAdapter = effect(ReversalSchema);

// Fungsi load server untuk mengambil data transaksi yang bisa dibatalkan sebelum halaman dibuka
export const load: PageServerLoad = ({ locals }) => {
	// Jalankan promise dalam format generator Effect
	return Effect.runPromise(
		Effect.gen(function* () {
			// Siapkan data form kosong untuk validasi input pembatalan di frontend
			const reversalForm = yield* Effect.promise(() =>
				superValidate(reversalAdapter, { id: 'reversal' }),
			);

			// Kalau user belum login, balikin list transaksi kosong
			if (!locals.user) return { transactions: [], reversalForm };

			// Ambil daftar transaksi aktif (yang belum dibatalkan/dihapus)
			const rows = yield* Effect.promise(() =>
				db
					.select({
						entryId: ledgerEntries.id,
						referenceNo: ledgerEntries.referenceNo,
						createdAt: ledgerEntries.createdAt,
						type: ledgerEntries.type,
						amount: ledgerEntries.amount,
						description: ledgerEntries.description,
						studentName: students.name,
						studentNis: students.nis,
						studentClass: students.class,
						planName: savingPlans.name,
						planCode: savingPlans.code,
					})
					.from(ledgerEntries)
					.innerJoin(studentSavings, eq(ledgerEntries.studentSavingsId, studentSavings.id))
					.innerJoin(students, eq(studentSavings.studentId, students.id))
					.innerJoin(savingPlans, eq(studentSavings.savingPlanId, savingPlans.id))
					.where(and(eq(ledgerEntries.isReversed, false), isNull(ledgerEntries.deletedAt)))
					.orderBy(desc(ledgerEntries.createdAt))
					.limit(500), // Ambil maksimal 500 transaksi terbaru
			);

			// Balikin data transaksi dan form ke frontend
			return {
				transactions: rows.map((r) => ({
					entryId: r.entryId,
					referenceNo: r.referenceNo,
					createdAt: r.createdAt.toISOString(),
					type: r.type,
					amount: Number(r.amount),
					description: r.description,
					studentName: r.studentName,
					studentNis: r.studentNis,
					studentClass: r.studentClass,
					planName: r.planName,
					planCode: r.planCode,
				})),
				reversalForm,
			};
		}),
	);
};

// Aksi form untuk memproses pembatalan transaksi
export const actions: Actions = {
	// Aksi pembatalan transaksi
	reverse: async ({ request, locals }) => {
		// Validasi input data form yang masuk
		const form = await superValidate(request, reversalAdapter);
		if (!form.valid) return fail(400, { form });

		// Jalankan logika pembatalan dalam generator Effect
		return Effect.runPromise(
			Effect.gen(function* () {
				// Validasi: Harus login
				if (!locals.user) return message(form, 'Unauthorized', { status: 401 });

				// Ambil data transaksi lama yang mau dibatalkan berdasarkan ID
				const [entry] = yield* Effect.promise(() =>
					db
						.select({
							id: ledgerEntries.id,
							type: ledgerEntries.type,
							amount: ledgerEntries.amount,
							isReversed: ledgerEntries.isReversed,
							studentSavingsId: ledgerEntries.studentSavingsId,
						})
						.from(ledgerEntries)
						.where(eq(ledgerEntries.id, form.data.entryId)),
				);

				// Validasi: Transaksi harus terdaftar di database
				if (!entry) return message(form, 'Transaction not found', { status: 404 });
				// Validasi: Transaksi belum dibatalkan sebelumnya
				if (entry.isReversed) return message(form, 'Transaction is already reversed', { status: 400 });

				const amount = Number(entry.amount);

				// Jika transaksi yang mau dibatalkan adalah SETORAN (DEPOSIT):
				if (entry.type === 'DEPOSIT') {
					// Cari saldo santri sekarang
					const [ss] = yield* Effect.promise(() =>
						db
							.select({ currentAmount: studentSavings.currentAmount })
							.from(studentSavings)
							.where(eq(studentSavings.id, entry.studentSavingsId)),
					);
					// Validasi: Saldo santri saat ini tidak boleh kurang dari uang setoran yang mau dibatalkan
					// (mencegah saldo minus jika uangnya sudah ditarik duluan)
					if (Number(ss?.currentAmount ?? 0) < amount) {
						return message(
							form,
							`Insufficient balance — student has already withdrawn part of this deposit. Current balance: Rp ${new Intl.NumberFormat('id-ID').format(Number(ss?.currentAmount ?? 0))}`,
							{ status: 400 },
						);
					}
				}

				// 1. Simpan catatan baru ke tabel reversals (alasan batal, siapa yang membatalkan)
				yield* Effect.promise(() =>
					db.insert(reversals).values({
						transferId: entry.id,
						reason: form.data.reason || null,
						reversedBy: locals.user!.id,
					}),
				);

				// 2. Tandai kolom isReversed menjadi true di tabel transaksi lama (ledgerEntries)
				yield* Effect.promise(() =>
					db.update(ledgerEntries).set({ isReversed: true }).where(eq(ledgerEntries.id, entry.id)),
				);

				// 3. Sesuaikan kembali saldo tabungan santri di database (di-rollback)
				yield* Effect.promise(() =>
					db
						.update(studentSavings)
						.set({
							// Kalau batalin DEPOSIT, saldonya dikurangi. Kalau batalin WITHDRAW, saldonya ditambah balik.
							currentAmount:
								entry.type === 'DEPOSIT'
									? sql`${studentSavings.currentAmount}::numeric - ${amount}`
									: sql`${studentSavings.currentAmount}::numeric + ${amount}`,
							updatedBy: locals.user!.id,
						})
						.where(eq(studentSavings.id, entry.studentSavingsId)),
				);

				// Balikin pesan sukses
				return message(form, 'Transaction reversed successfully');
			}).pipe(
				// Tangani error sistem jika query gagal
				Effect.catchAll((err: any) => {
					if (err && typeof err === 'object' && 'type' in err) return Effect.succeed(err);
					console.error('Reversal error:', err);
					return Effect.succeed(message(form, 'Reversal failed', { status: 500 }));
				}),
			),
		);
	},
};
