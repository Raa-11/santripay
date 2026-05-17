<script lang="ts">
	import { getContext } from 'svelte';
	import { cn, type WithElementRef } from '$lib/utils.js';
	import type { HTMLAttributes } from 'svelte/elements';

	let {
		ref = $bindable(null),
		class: className,
		children,
		...restProps
	}: WithElementRef<HTMLAttributes<HTMLDivElement>> = $props();

	const ctx = getContext<{ loop: boolean; orientation: string }>('action-bar');

	function handleKeydown(e: KeyboardEvent) {
		const group = ref as HTMLElement;
		if (!group) return;

		const items = Array.from(
			group.querySelectorAll<HTMLElement>(
				'[data-slot="action-bar-item"]:not([disabled]):not([aria-disabled="true"])'
			)
		);
		if (items.length === 0) return;

		const current = document.activeElement as HTMLElement;
		const currentIndex = items.indexOf(current);

		const isHorizontal = (ctx?.orientation ?? 'horizontal') === 'horizontal';
		const isNext = isHorizontal ? e.key === 'ArrowRight' : e.key === 'ArrowDown';
		const isPrev = isHorizontal ? e.key === 'ArrowLeft' : e.key === 'ArrowUp';
		const isFirst = e.key === 'Home';
		const isLast = e.key === 'End';

		if (!isNext && !isPrev && !isFirst && !isLast) return;
		e.preventDefault();

		let nextIndex: number;
		if (isFirst) {
			nextIndex = 0;
		} else if (isLast) {
			nextIndex = items.length - 1;
		} else if (isNext) {
			nextIndex = currentIndex + 1;
			if (nextIndex >= items.length) nextIndex = ctx?.loop ? 0 : items.length - 1;
		} else {
			nextIndex = currentIndex - 1;
			if (nextIndex < 0) nextIndex = ctx?.loop ? items.length - 1 : 0;
		}

		items[nextIndex]?.focus();
	}
</script>

<div
	bind:this={ref}
	data-slot="action-bar-group"
	role="group"
	class={cn('flex items-center gap-0.5', className)}
	onkeydown={handleKeydown}
	{...restProps}
>
	{@render children?.()}
</div>
