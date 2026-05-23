// Import tipe data load server dan form actions dari SvelteKit
import type { PageServerLoad, Actions } from './$types';
// Import koneksi database
import { db } from '$lib/server/db';
// Import skema tabel siswa (students)
import { students } from '$lib/server/db/schema';
// Import modul autentikasi better-auth
import { auth } from '$lib/server/auth';
// Import fail untuk response error
import { fail } from '@sveltejs/kit';
// Import fungsi operator Drizzle ORM
import { desc, eq, inArray } from 'drizzle-orm';
// Import library Effect dan Schema untuk validasi data fungsional
import { Effect, Schema } from 'effect';
// Import superValidate dan message dari sveltekit-superforms
import { superValidate, message } from 'sveltekit-superforms';
// Import adapter effect untuk superforms
import { effect } from 'sveltekit-superforms/adapters';

// Skema validasi data siswa (tambah & edit)
const StudentSchema = Schema.Struct({
	id: Schema.optional(Schema.String), // ID siswa (opsional, diisi pas edit)
	nis: Schema.String.pipe(Schema.minLength(1)), // NIS wajib diisi
	name: Schema.String.pipe(Schema.minLength(2)), // Nama minimal 2 huruf
	gender: Schema.optional(Schema.String), // Jenis kelamin (opsional)
	class: Schema.optional(Schema.String), // Kelas (opsional)
	address: Schema.optional(Schema.String), // Alamat (opsional)
	isActive: Schema.optional(Schema.Boolean) // Status aktif/nonaktif
});

// Skema validasi buat hapus siswa (bisa hapus banyak sekaligus pakai array ID)
const DeleteSchema = Schema.Struct({ ids: Schema.Array(Schema.String) });

// Daftarkan skema ke adapter superforms
const studentAdapter = effect(StudentSchema);
const deleteAdapter = effect(DeleteSchema);

// Skema validasi buat ubah status aktif/nonaktif banyak siswa sekaligus
const BulkStatusSchema = Schema.Struct({ ids: Schema.Array(Schema.String), isActive: Schema.Boolean });
const bulkStatusAdapter = effect(BulkStatusSchema);

// Fungsi load server untuk mengambil list siswa dan inisialisasi form-form saat halaman dibuka
export const load: PageServerLoad = ({ locals }) => {
	return Effect.runPromise(Effect.gen(function* () {
		// Jalankan query secara paralel agar loading data cepat
		const [items, addForm, editForm, deleteForm, bulkStatusForm] = yield* Effect.all([
			// Ambil 1000 data siswa terbaru terurut dari yang baru dibuat
			Effect.promise(() => db.select().from(students).orderBy(desc(students.createdAt)).limit(1000)),
			// Form tambah siswa baru (default isActive = true)
			Effect.promise(() => superValidate({ isActive: true }, studentAdapter, { id: 'add' })),
			// Form edit siswa
			Effect.promise(() => superValidate({ isActive: true }, studentAdapter, { id: 'edit' })),
			// Form hapus siswa
			Effect.promise(() => superValidate(deleteAdapter, { id: 'delete' })),
			// Form ubah status massal
			Effect.promise(() => superValidate(bulkStatusAdapter, { id: 'bulkStatus' }))
		]);

		// Balikin data ke frontend
		return { items, addForm, editForm, deleteForm, bulkStatusForm, currentUserId: locals.user?.id };
	}));
};

// Kumpulan aksi form untuk CRUD siswa
export const actions: Actions = {
	// 1. Aksi tambah siswa baru
	create: async ({ request }) => {
		// Validasi input form tambah siswa
		const form = await superValidate(request, studentAdapter);
		if (!form.valid) return fail(400, { form });

		return Effect.runPromise(
			Effect.gen(function* () {
				// Simpan data siswa baru ke database
				yield* Effect.promise(() =>
					db.insert(students).values({
						nis: form.data.nis,
						name: form.data.name,
						gender: form.data.gender || null,
						class: form.data.class || null,
						address: form.data.address || null,
						isActive: form.data.isActive ?? true
					})
				);

				return message(form, 'Student created successfully');
			}).pipe(
				// Tangani error, misalnya NIS sudah terdaftar (harus unik)
				Effect.catchAll((err: any) => {
					console.error('Create Error:', err);
					const isUnique = err?.message?.includes('23505') || err?.message?.includes('unique');
					return Effect.succeed(
						fail(isUnique ? 400 : 500, {
							form,
							message: isUnique ? 'NIS must be unique' : 'Failed to create student'
						})
					);
				})
			)
		);
	},

	// 2. Aksi edit/update data siswa
	update: async ({ request }) => {
		// Validasi input form edit siswa
		const form = await superValidate(request, studentAdapter);
		if (!form.valid || !form.data.id) return fail(400, { form });

		return Effect.runPromise(
			Effect.gen(function* () {
				// Update data siswa berdasarkan ID
				yield* Effect.promise(() =>
					db
						.update(students)
						.set({ 
                            nis: form.data.nis,
                            name: form.data.name,
                            gender: form.data.gender || null,
                            class: form.data.class || null,
                            address: form.data.address || null,
                            isActive: form.data.isActive ?? true 
                        })
						.where(eq(students.id, form.data.id as string))
				);
				return message(form, 'Student updated successfully');
			}).pipe(
				// Tangani error saat update
				Effect.catchAll((err: any) => {
					console.error('Update Error:', err);
					const isUnique = err?.message?.includes('23505') || err?.message?.includes('unique');
					return Effect.succeed(
						fail(isUnique ? 400 : 500, {
							form,
							message: isUnique ? 'NIS must be unique' : 'Update failed'
						})
					);
				})
			)
		);
	},

	// 3. Aksi hapus data siswa (bisa satu atau banyak sekaligus)
	delete: async ({ request }) => {
		// Validasi ID siswa yang mau dihapus
		const form = await superValidate(request, deleteAdapter);
		if (!form.valid) return fail(400, { form });

		return Effect.runPromise(
			Effect.gen(function* () {
				// Pastikan user admin sudah login
				const session = yield* Effect.promise(() =>
					auth.api.getSession({ headers: request.headers })
				);
				if (!session) return yield* Effect.fail(fail(401, { form, message: 'Unauthorized' }));

				const idsToDelete = form.data.ids;
				// Hapus data siswa dari database berdasarkan kumpulan ID
				if (idsToDelete.length > 0) {
					yield* Effect.promise(() => db.delete(students).where(inArray(students.id, idsToDelete)));
				}

				return message(form, 'Deleted successfully');
			}).pipe(
				Effect.catchAll((err) => {
					if (err && typeof err === 'object' && 'type' in err) return Effect.succeed(err);
					return Effect.succeed(fail(500, { form, message: 'Deletion failed' }));
				})
			)
		);
	},

	// 4. Aksi ubah status aktif/nonaktif secara massal
	bulkStatus: async ({ request }) => {
		// Validasi input status dan ID
		const form = await superValidate(request, bulkStatusAdapter);
		if (!form.valid) return fail(400, { form });

		return Effect.runPromise(
			Effect.gen(function* () {
				// Pastikan user admin sudah login
				const session = yield* Effect.promise(() =>
					auth.api.getSession({ headers: request.headers })
				);
				if (!session) return yield* Effect.fail(fail(401, { form, message: 'Unauthorized' }));

				const idsToUpdate = form.data.ids;
				// Update status aktif/nonaktif siswa secara sekaligus (massal)
				if (idsToUpdate.length > 0) {
					yield* Effect.promise(() => db.update(students).set({ isActive: form.data.isActive }).where(inArray(students.id, idsToUpdate)));
				}

				return message(form, 'Status updated successfully');
			}).pipe(
				Effect.catchAll((err) => {
					if (err && typeof err === 'object' && 'type' in err) return Effect.succeed(err);
					return Effect.succeed(fail(500, { form, message: 'Update failed' }));
				})
			)
		);
	}
};
