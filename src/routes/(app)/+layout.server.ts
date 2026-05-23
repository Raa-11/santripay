// Mengimpor fungsi 'redirect' dari SvelteKit untuk mengalihkan rute halaman
import { redirect } from '@sveltejs/kit';
// Mengimpor tipe data LayoutServerLoad untuk mendefinisikan tipe load function layout server secara tepat
import type { LayoutServerLoad } from './$types';

// Fungsi load server untuk grup rute (app) yang berfungsi sebagai Auth Guard
export const load: LayoutServerLoad = (event) => {
	// Memeriksa session pengguna di event.locals.user.
	// Jika user belum login (tidak ada session), langsung alihkan (redirect) ke halaman login
	if (!event.locals.user) {
		return redirect(302, '/login');
	}
	// Jika sukses login, kembalikan objek berisi data user agar dapat digunakan oleh seluruh halaman anak
	return { user: event.locals.user };
};
