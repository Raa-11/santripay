// Mengimpor fungsi 'redirect' dari SvelteKit untuk mengalihkan rute halaman
import { redirect } from '@sveltejs/kit';

// Fungsi load server utama untuk rute "/" (halaman beranda awal)
export const load = () => {
	// Mengalihkan secara otomatis pengguna yang mengakses "/" ke "/login" dengan kode status redirect 302
	return redirect(302, '/login');
};
