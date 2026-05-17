<script lang="ts">
	import { cn, type WithElementRef } from '$lib/utils.js';
	import type { HTMLAttributes } from 'svelte/elements';

	let {
		ref = $bindable(null),
		count,
		class: className,
		children,
		...restProps
	}: WithElementRef<HTMLAttributes<HTMLSpanElement>> & {
		count?: number;
	} = $props();
</script>

<span
	bind:this={ref}
	data-slot="action-bar-selection"
	class={cn('px-2 text-xs font-medium text-muted-foreground', className)}
	{...restProps}
>
	{#if children}
		{@render children()}
	{:else if count !== undefined}
		{count} selected
	{/if}
</span>
