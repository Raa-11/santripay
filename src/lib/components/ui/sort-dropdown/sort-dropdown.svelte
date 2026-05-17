<script lang="ts">
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
	import { HugeiconsIcon } from '@hugeicons/svelte';
	import { SortByUp01Icon, SortByDown01Icon, Tick02Icon } from '@hugeicons/core-free-icons';
	import { cn } from '$lib/utils.js';
	import { Button } from '$lib/components/ui/button/index.js';

	type Col = { key: string; label: string };

	let {
		cols,
		sortCol = $bindable(),
		sortDir = $bindable<'asc' | 'desc'>('asc'),
		onSortChange
	}: {
		cols: Col[];
		sortCol: string;
		sortDir?: 'asc' | 'desc';
		onSortChange?: () => void;
	} = $props();

	function handleSortCol(key: string) {
		sortCol = key;
		onSortChange?.();
	}

	function handleSortDir(dir: 'asc' | 'desc') {
		sortDir = dir;
		onSortChange?.();
	}
</script>

<DropdownMenu.Root>
	<DropdownMenu.Trigger>
		{#snippet child({ props })}
			<Button {...props} variant="outline" size="sm" class="gap-1.5">
				<HugeiconsIcon icon={sortDir === 'asc' ? SortByUp01Icon : SortByDown01Icon} size={13} />
				Sort
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
			<!-- Sort by -->
			<p class="text-muted-foreground px-2 py-1 text-[11px] font-medium uppercase tracking-wide">Sort by</p>
			{#each cols as col}
				<DropdownMenu.Item
					closeOnSelect={false}
					class={cn(
						'focus:bg-accent focus:text-accent-foreground flex cursor-default items-center gap-2 rounded-md px-2 py-1.5 text-xs outline-none select-none'
					)}
					onclick={() => handleSortCol(col.key)}
				>
					<span class="flex w-3 items-center justify-center">
						{#if sortCol === col.key}
							<HugeiconsIcon icon={Tick02Icon} size={12} />
						{/if}
					</span>
					{col.label}
				</DropdownMenu.Item>
			{/each}

			<DropdownMenu.Separator class="bg-border my-1 h-px" />

			<!-- Direction -->
			<p class="text-muted-foreground px-2 py-1 text-[11px] font-medium uppercase tracking-wide">Direction</p>
			{#each [{ value: 'asc', label: 'Ascending', icon: SortByUp01Icon }, { value: 'desc', label: 'Descending', icon: SortByDown01Icon }] as dir}
				<DropdownMenu.Item
					closeOnSelect={false}
					class={cn(
						'focus:bg-accent focus:text-accent-foreground flex cursor-default items-center gap-2 rounded-md px-2 py-1.5 text-xs outline-none select-none'
					)}
					onclick={() => handleSortDir(dir.value as 'asc' | 'desc')}
				>
					<span class="flex w-3 items-center justify-center">
						{#if sortDir === dir.value}
							<HugeiconsIcon icon={Tick02Icon} size={12} />
						{/if}
					</span>
					<HugeiconsIcon icon={dir.icon} size={13} />
					{dir.label}
				</DropdownMenu.Item>
			{/each}
	</DropdownMenu.Content>
</DropdownMenu.Root>
