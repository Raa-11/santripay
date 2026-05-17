<script lang="ts">
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
	import { HugeiconsIcon } from '@hugeicons/svelte';
	import { Table01Icon, Tick02Icon } from '@hugeicons/core-free-icons';
	import { cn } from '$lib/utils.js';
	import { Button } from '$lib/components/ui/button/index.js';

	type Col = { key: string; label: string };

	let {
		cols,
		visible = $bindable<Set<string>>(new Set()),
	}: {
		cols: Col[];
		visible: Set<string>;
	} = $props();

	function toggle(key: string) {
		if (visible.has(key)) visible.delete(key);
		else visible.add(key);
		visible = new Set(visible);
	}
</script>

<DropdownMenu.Root>
	<DropdownMenu.Trigger>
		{#snippet child({ props })}
			<Button {...props} variant="outline" size="sm" class="gap-1.5">
				<HugeiconsIcon icon={Table01Icon} size={13} />
				View
			</Button>
		{/snippet}
	</DropdownMenu.Trigger>

	<DropdownMenu.Content
		align="end"
		sideOffset={6}
		class={cn(
			'bg-popover text-popover-foreground z-50 min-w-40 rounded-lg border p-1 shadow-md',
			'data-[state=open]:animate-in data-[state=closed]:animate-out',
			'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
			'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
			'data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2'
		)}
	>
			<p class="text-muted-foreground px-2 py-1 text-[11px] font-medium uppercase tracking-wide">Toggle columns</p>
			{#each cols as col}
				<DropdownMenu.Item
					closeOnSelect={false}
					class={cn(
						'focus:bg-accent focus:text-accent-foreground flex cursor-default items-center gap-2 rounded-md px-2 py-1.5 text-xs outline-none select-none'
					)}
					onclick={() => toggle(col.key)}
				>
					<span class={cn(
						'flex size-3.5 items-center justify-center rounded border',
						visible.has(col.key) ? 'bg-primary border-primary text-primary-foreground' : 'border-input'
					)}>
						{#if visible.has(col.key)}
							<HugeiconsIcon icon={Tick02Icon} size={10} />
						{/if}
					</span>
					{col.label}
				</DropdownMenu.Item>
			{/each}
	</DropdownMenu.Content>
</DropdownMenu.Root>
