// Mengimpor tipe data PageLoad untuk mendefinisikan tipe load function di frontend secara tepat
import type { PageLoad } from './$types';

// Menonaktifkan Server-Side Rendering (SSR) untuk halaman ini.
// Halaman akan dirender sepenuhnya di sisi browser (Client-Side Rendering)
export const ssr = false;

// Fungsi load universal yang dijalankan sebelum komponen halaman (+page.svelte) dirender
export const load: PageLoad = async ({ fetch }) => {
	// Melakukan pemanggilan (fetch) internal ke API /api/dashboard untuk mengambil statistik dasbor
	const res = await fetch('/api/dashboard');
	// Mengembalikan respons JSON dari API ke halaman frontend (+page.svelte)
	return res.json();
};
