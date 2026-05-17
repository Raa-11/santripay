<script lang="ts">
	import { HugeiconsIcon } from '@hugeicons/svelte';
	import { Cancel01Icon } from '@hugeicons/core-free-icons';
	import { fade, scale } from 'svelte/transition';
	import { backOut } from 'svelte/easing';

	interface Props {
		open: boolean;
		title?: string;
		description?: string;
		icon?: any;
		variant?: 'default' | 'danger';
		onClose: () => void;
		children: import('svelte').Snippet;
		footer?: import('svelte').Snippet;
		maxWidth?: string;
	}

	let { 
		open, 
		title, 
		description, 
		icon, 
		variant = 'default', 
		onClose, 
		children, 
		footer,
		maxWidth = '420px'
	}: Props = $props();

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape' && open) onClose();
	}
</script>

<svelte:window onkeydown={handleKeydown} />

{#if open}
	<div class="fixed inset-0 z-50 flex items-center justify-center p-4">
		<!-- Backdrop -->
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div 
			class="fixed inset-0 bg-slate-950/40 backdrop-blur-sm" 
			onclick={onClose}
			transition:fade={{ duration: 200 }}
		></div>

		<!-- Modal Container -->
		<div 
			class="relative w-full bg-background rounded-xl border shadow-2xl overflow-hidden flex flex-col"
			style="max-width: {maxWidth}"
			transition:scale={{ duration: 300, start: 0.95, opacity: 0, easing: backOut }}
		>
			<!-- Header -->
			<div class="px-6 py-4 border-b bg-muted/20 flex items-center justify-between">
				<div class="flex items-center gap-3">
					{#if icon}
						<div class="size-8 rounded-lg flex items-center justify-center {variant === 'danger' ? 'bg-destructive/10 text-destructive' : 'bg-primary/10 text-primary'}">
							<HugeiconsIcon {icon} size={18} />
						</div>
					{/if}
					<div>
						<h2 class="text-base font-bold tracking-tight">{title}</h2>
						{#if description}
							<p class="text-[11px] text-muted-foreground line-clamp-1">{description}</p>
						{/if}
					</div>
				</div>
				<button 
					class="size-8 flex items-center justify-center rounded-lg hover:bg-muted text-muted-foreground transition-colors"
					onclick={onClose}
					aria-label="Close"
				>
					<HugeiconsIcon icon={Cancel01Icon} size={16} />
				</button>
			</div>

			<!-- Body -->
			<div class="flex-1 overflow-y-auto p-6">
				{@render children()}
			</div>

			<!-- Footer -->
			{#if footer}
				<div class="px-6 py-4 border-t bg-muted/10 flex justify-end gap-3">
					{@render footer()}
				</div>
			{/if}
		</div>
	</div>
{/if}
