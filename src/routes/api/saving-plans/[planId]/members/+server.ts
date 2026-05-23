// Import tipe data RequestHandler bawaan SvelteKit untuk handle request API
import type { RequestHandler } from './$types';
// Import koneksi database postgres
import { db } from '$lib/server/db';
// Import tabel studentSavings dan students
import { studentSavings, students } from '$lib/server/db/schema';
// Import fungsi operator query Drizzle ORM
import { eq, and, isNull, sql, or, ilike } from 'drizzle-orm';
// Import helper 'json' dari SvelteKit buat balikin data format JSON
import { json } from '@sveltejs/kit';

// Handler request GET untuk mengambil daftar anggota tabungan dengan saldo aktif
export const GET: RequestHandler = async ({ params, url, locals }) => {
	// Validasi: Kalau belum login, tolak request
	if (!locals.user) return json({ error: 'Unauthorized' }, { status: 401 });

	// Ambil ID program tabungan dari URL parameter [planId]
	const { planId } = params;
	// Ambil kata kunci pencarian nama/NIS siswa dari URL (opsional)
	const q = url.searchParams.get('q')?.trim() ?? '';

	// Query pencarian anggota tabungan yang aktif dan punya saldo lebih dari 0
	const results = await db
		.select({
			// ID dari tabel simpanan
			savingsId: studentSavings.id,
			// Jumlah uang di tabungan
			currentAmount: studentSavings.currentAmount,
			// Nama siswa yang punya tabungan
			studentName: students.name,
			// Nomor Induk Siswa
			studentNis: students.nis,
			// Kelas si siswa
			studentClass: students.class,
		})
		.from(studentSavings)
		// Hubungkan data rekening ke data siswa
		.innerJoin(students, eq(studentSavings.studentId, students.id))
		.where(
			and(
				// Filter hanya untuk program tabungan ini
				eq(studentSavings.savingPlanId, planId),
				// Pastikan datanya belum dihapus (soft delete)
				isNull(studentSavings.deletedAt),
				// Saldo tabungannya wajib lebih dari Rp 0
				sql`${studentSavings.currentAmount}::numeric > 0`,
				// Kalau user mengetik minimal 2 karakter, filter berdasarkan nama atau NIS. Kalau tidak, abaikan filter pencarian.
				q.length >= 2
					? or(ilike(students.nis, `%${q}%`), ilike(students.name, `%${q}%`))
					: sql`true`,
			),
		)
		// Urutkan alfabet nama siswa
		.orderBy(students.name)
		// Batasi hasil query maksimal 20 data teratas agar ringan
		.limit(20);

	// Balikin hasil query dalam format JSON ke frontend setelah angka dikonversi jadi Number
	return json(results.map((r) => ({ ...r, currentAmount: Number(r.currentAmount) })));
};
