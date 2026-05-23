// Mengimpor fungsi 'fail' (mengembalikan kegagalan form) dan 'redirect' (mengalihkan halaman) dari SvelteKit
import { fail, redirect } from '@sveltejs/kit';
// Mengimpor tipe data Actions dan PageServerLoad dari folder $types buatan SvelteKit
import type { Actions, PageServerLoad } from './$types';
// Mengimpor pustaka autentikasi 'auth' (Better-Auth) dari server backend
import { auth } from '$lib/server/auth';
// Mengimpor kelas APIError dari better-auth/api untuk menangani error API autentikasi
import { APIError } from 'better-auth/api';

// Fungsi load server yang berjalan di server sebelum halaman login dirender di browser
export const load: PageServerLoad = (event) => {
	// Jika user ternyata SUDAH memiliki session aktif (sudah login),
	// langsung alihkan (redirect) ke halaman dasbor
	if (event.locals.user) {
		return redirect(302, '/dashboard');
	}
	// Jika belum login, kembalikan objek kosong agar halaman login dirender normal
	return {};
};

// Mengekspor sekumpulan aksi form (Form Actions) untuk menangani form submission
export const actions: Actions = {
	// Aksi bernama 'signIn' untuk menangani proses login
	signIn: async (event) => {
		// Mengambil seluruh data form yang dikirim oleh pengguna
		const formData = await event.request.formData();
		// Mengambil isian email dari form dan mengonversinya ke string
		const email = formData.get('email')?.toString() ?? '';
		// Mengambil isian password dari form dan mengonversinya ke string
		const password = formData.get('password')?.toString() ?? '';
		// Memeriksa apakah opsi 'rememberMe' (ingat saya) dicentang (bernilai 'on')
		const rememberMe = formData.get('rememberMe') === 'on';

		try {
			// Memanggil API signInEmail dari Better-Auth untuk mencocokkan email, password, dan session
			await auth.api.signInEmail({
				body: { email, password, rememberMe }
			});
		} catch (error) {
			// Jika terjadi error dari API better-auth (misalnya email/password salah)
			if (error instanceof APIError) {
				// Kembalikan status HTTP 400 beserta pesan kesalahan login
				return fail(400, { message: error.message || 'Login gagal' });
			}
			// Jika terjadi error sistem lainnya, kembalikan status HTTP 500
			return fail(500, { message: 'Terjadi kesalahan' });
		}

		// Jika proses login berhasil, alihkan pengguna ke halaman dasbor (/dashboard)
		return redirect(302, '/dashboard');
	}
};
