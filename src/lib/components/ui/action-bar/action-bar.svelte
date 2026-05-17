<script lang="ts">
	import { setContext } from 'svelte';
	import { cn, type WithElementRef } from '$lib/utils.js';
	import type { HTMLAttributes } from 'svelte/elements';
	import type { Snippet } from 'svelte';

	type Side = 'top' | 'bottom';
	type Align = 'start' | 'center' | 'end';

	let {
		ref = $bindable(null),
		open = false,
		onOpenChange,
		side = 'bottom' as Side,
		align = 'center' as Align,
		sideOffset = 16,
		alignOffset = 16,
		orientation = 'horizontal' as 'horizontal' | 'vertical',
		loop = true,
		class: className,
		children,
		...restProps
	}: WithElementRef<HTMLAttributes<HTMLDivElement>> & {
		open?: boolean;
		onOpenChange?: (open: boolean) => void;
		side?: Side;
		align?: Align;
		sideOffset?: number;
		alignOffset?: number;
		orientation?: 'horizontal' | 'vertical';
		loop?: boolean;
	} = $props();

	setContext('action-bar', {
		close: () => onOpenChange?.(false),
		get loop() { return loop; },
		get orientation() { return orientation; },
	});

	const positionStyle = $derived(() => {
		let s = '';
		s += side === 'bottom' ? `bottom:${sideOffset}px;` : `top:${sideOffset}px;`;
		if (align === 'center') {
			s += 'left:50%;transform:translateX(-50%);';
		} else if (align === 'start') {
			s += `left:${alignOffset}px;`;
		} else {
			s += `right:${alignOffset}px;`;
		}
		return s;
	});

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') onOpenChange?.(false);
	}
</script>

<svelte:window onkeydown={open ? handleKeydown : undefined} />

{#if open}
	<div
		bind:this={ref}
		data-slot="action-bar"
		role="toolbar"
		aria-orientation={orientation}
		class={cn(
			'fixed z-50 flex items-center gap-2 rounded-xl border bg-background px-2 py-1.5 text-foreground shadow-lg',
			'animate-in fade-in-0 duration-150',
			side === 'bottom' ? 'slide-in-from-bottom-2' : 'slide-in-from-top-2',
			className
		)}
		style={positionStyle()}
		{...restProps}
	>
		{@render children?.()}
	</div>
{/if}
