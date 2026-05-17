<script lang="ts">
	import { getContext } from 'svelte';
	import { cn, type WithElementRef } from '$lib/utils.js';
	import { buttonVariants } from '$lib/components/ui/button/button.svelte';
	import { HugeiconsIcon } from '@hugeicons/svelte';
	import { Cancel01Icon } from '@hugeicons/core-free-icons';
	import type { HTMLButtonAttributes } from 'svelte/elements';

	let {
		ref = $bindable(null),
		class: className,
		children,
		...restProps
	}: WithElementRef<HTMLButtonAttributes> = $props();

	const ctx = getContext<{ close: () => void }>('action-bar');
</script>

<button
	bind:this={ref}
	data-slot="action-bar-close"
	type="button"
	aria-label="Close"
	class={cn(buttonVariants({ variant: 'ghost', size: 'icon-sm' }), className)}
	onclick={() => ctx?.close()}
	{...restProps}
>
	{#if children}
		{@render children()}
	{:else}
		<HugeiconsIcon icon={Cancel01Icon} size={14} />
	{/if}
</button>
