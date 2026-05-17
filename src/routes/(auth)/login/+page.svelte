<script lang="ts">
	import LoginForm from '$lib/components/login-form.svelte';
	import type { ActionData } from './$types';

	let { form }: { form: ActionData } = $props();
</script>

<LoginForm {form} />
