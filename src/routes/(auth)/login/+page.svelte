<script lang="ts">
	// Mengimpor komponen LoginForm (Form Login UI) yang sudah dibuat secara terpisah di folder komponen
	import LoginForm from '$lib/components/login-form.svelte';
	// Mengimpor tipe data ActionData untuk menangani respons data yang dikembalikan dari Form Actions server
	import type { ActionData } from './$types';

	// Mengambil properti 'form' (berisi error message atau status dari server setelah login dicoba)
	// menggunakan sistem Runes Svelte 5 ($props)
	let { form }: { form: ActionData } = $props();
</script>

<!-- Merender komponen Form Login UI dan menyalurkan properti respons form dari server ke dalamnya -->
<LoginForm {form} />
