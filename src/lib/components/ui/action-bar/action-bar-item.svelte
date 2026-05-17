<script lang="ts">
	import { cn, type WithElementRef } from '$lib/utils.js';
	import { buttonVariants, type ButtonVariant, type ButtonSize } from '$lib/components/ui/button/button.svelte';
	import type { HTMLButtonAttributes } from 'svelte/elements';

	let {
		ref = $bindable(null),
		variant = 'ghost' as ButtonVariant,
		size = 'icon-sm' as ButtonSize,
		onSelect,
		class: className,
		children,
		disabled,
		...restProps
	}: WithElementRef<HTMLButtonAttributes> & {
		variant?: ButtonVariant;
		size?: ButtonSize;
		onSelect?: () => void;
	} = $props();

	function handleClick() {
		if (!disabled) onSelect?.();
	}
</script>

<button
	bind:this={ref}
	data-slot="action-bar-item"
	type="button"
	{disabled}
	class={cn(buttonVariants({ variant, size }), className)}
	onclick={handleClick}
	{...restProps}
>
	{@render children?.()}
</button>
