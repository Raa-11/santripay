// Import tipe data RequestHandler bawaan SvelteKit untuk handle request API
import type { RequestHandler } from './$types';
// Import koneksi database postgres
import { db } from '$lib/server/db';
// Import skema tabel students
import { students } from '$lib/server/db/schema';
// Import fungsi operator query Drizzle ORM
import { and, or, ilike, isNull } from 'drizzle-orm';
// Import helper 'json' dari SvelteKit buat balikin data format JSON
import { json } from '@sveltejs/kit';

// Handler request GET untuk pencarian siswa
export const GET: RequestHandler = async ({ url, locals }) => {
	// Validasi: Kalau belum login, balikin error Unauthorized (401)
	if (!locals.user) return json({ error: 'Unauthorized' }, { status: 401 });

	// Ambil kata kunci pencarian 'q' dari URL query params (misal: /api/students/search?q=ahmad)
	const q = url.searchParams.get('q')?.trim() ?? '';
	// Validasi: Minimal ketik 2 karakter baru mulai mencari, kalau kurang balikin array kosong
	if (q.length < 2) return json([]);

	// Query pencarian ke tabel students
	const results = await db
		.select({
			id: students.id,
			nis: students.nis,
			name: students.name,
			class: students.class,
			gender: students.gender,
		})
		.from(students)
		.where(
			and(
				// Pastikan data siswa belum dihapus (soft-delete)
				isNull(students.deletedAt),
				// Cari yang NIS atau namanya mirip dengan kata kunci 'q' (ilike = tidak sensitif huruf kapital)
				or(ilike(students.nis, `%${q}%`), ilike(students.name, `%${q}%`)),
			),
		)
		// Urutkan alfabet nama siswa
		.orderBy(students.name)
		// Batasi hanya mengambil maksimal 10 hasil pencarian teratas
		.limit(10);

	// Balikin hasil pencarian dalam bentuk format JSON ke frontend
	return json(results);
};
