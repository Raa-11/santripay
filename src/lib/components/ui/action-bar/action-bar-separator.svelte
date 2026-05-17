<script lang="ts">
	import { cn, type WithElementRef } from '$lib/utils.js';
	import type { HTMLAttributes } from 'svelte/elements';

	let {
		ref = $bindable(null),
		class: className,
		...restProps
	}: WithElementRef<HTMLAttributes<HTMLDivElement>> = $props();
</script>

<div
	bind:this={ref}
	data-slot="action-bar-separator"
	role="separator"
	aria-orientation="vertical"
	class={cn('bg-border mx-0.5 h-4 w-px shrink-0', className)}
	{...restProps}
></div>
