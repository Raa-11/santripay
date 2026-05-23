// Mengimpor fungsi 'redirect' dari SvelteKit untuk mengalihkan rute halaman
import { redirect } from '@sveltejs/kit';
// Mengimpor tipe data Actions untuk mendefinisikan tipe aksi form (Form Actions) secara tepat
import type { Actions } from './$types';
// Mengimpor pustaka autentikasi 'auth' (Better-Auth) dari server backend
import { auth } from '$lib/server/auth';

// Mengekspor kumpulan aksi form (Actions) untuk berkas rute ini
export const actions: Actions = {
	// Aksi default yang dipicu ketika form signout disubmit (tanpa nama action spesifik)
	default: async (event) => {
		// Memanggil metode signOut dari Better-Auth dengan menyertakan headers request (untuk menghapus session)
		await auth.api.signOut({ headers: event.request.headers });
		// Mengalihkan pengguna kembali ke halaman login (URL: /login) dengan status redirect 302
		return redirect(302, '/login');
	}
};
