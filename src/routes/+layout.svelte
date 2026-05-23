<script lang="ts">
	// Mengimpor berkas CSS global untuk mengatur styling dasar seluruh aplikasi
	import './layout.css';
	// Mengimpor gambar favicon SVG sebagai ikon tab browser
	import favicon from '$lib/assets/favicon.svg';
	// Mengimpor fungsi lifecycle hook 'onNavigate' dari SvelteKit untuk mendeteksi navigasi halaman
	import { onNavigate } from '$app/navigation';

	// Mengambil properti 'children' (halaman/konten aktif saat ini) menggunakan Runes Svelte 5 ($props)
	let { children } = $props();

	// Mendeteksi ketika pengguna berpindah halaman (navigasi)
	onNavigate((navigation) => {
		// Jika browser tidak mendukung View Transitions API, batalkan transisi animasi halaman
		if (!document.startViewTransition) return;
		
		// Mengembalikan Promise untuk menunda selesainya navigasi hingga animasi transisi selesai
		return new Promise((resolve) => {
			// Memulai animasi transisi antar tampilan halaman secara mulus (smooth transition)
			document.startViewTransition(async () => {
				resolve(); // Mengizinkan SvelteKit merender halaman baru ke dalam DOM
				await navigation.complete; // Menunggu hingga navigasi SvelteKit selesai sepenuhnya
			});
		});
	});
</script>

<!-- Memasukkan tag ke bagian <head> dari dokumen HTML untuk mengatur favicon tab browser -->
<svelte:head><link rel="icon" href={favicon} /></svelte:head>

<!-- Merender halaman anak/halaman aktif saat ini di dalam layout global -->
{@render children()}
