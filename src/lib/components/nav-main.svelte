<script lang="ts">
	import { untrack } from 'svelte';
	import { get } from 'svelte/store';
	import { page } from '$app/stores';
	import * as Collapsible from "$lib/components/ui/collapsible/index.js";
	import * as Sidebar from "$lib/components/ui/sidebar/index.js";
	import ChevronRightIcon from "@lucide/svelte/icons/chevron-right";

	let {
		items,
	}: {
		items: {
			title: string;
			url: string;
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			icon?: any;
			isActive?: boolean;
			items?: { title: string; url: string }[];
		}[];
	} = $props();

	const currentPath = get(page).url.pathname;

	let openStates = $state(
		untrack(() =>
			Object.fromEntries(
				items.map((item) => [
					item.title,
					item.items && item.items.length > 0 ? true : (item.isActive ?? false)
				])
			)
		)
	);
</script>

<Sidebar.Group>
	<Sidebar.Menu>
		{#each items as item (item.title)}
			{#if !item.items || item.items.length === 0}
				<Sidebar.MenuItem>
					<Sidebar.MenuButton
						isActive={$page.url.pathname === item.url}
						tooltipContent={item.title}
						class="text-[13.5px]"
					>
						{#snippet child({ props })}
							<a href={item.url} {...props}>
								{#if item.icon}
									<item.icon />
								{/if}
								<span>{item.title}</span>
							</a>
						{/snippet}
					</Sidebar.MenuButton>
				</Sidebar.MenuItem>
			{:else}
				<Collapsible.Root
					open={openStates[item.title]}
					onOpenChange={(val) => (openStates[item.title] = val)}
					class="group/collapsible"
				>
					{#snippet child({ props })}
						<Sidebar.MenuItem {...props}>
							<Collapsible.Trigger>
								{#snippet child({ props })}
									<Sidebar.MenuButton {...props} tooltipContent={item.title} class="text-[13.5px]">
										{#if item.icon}
											<item.icon />
										{/if}
										<span>{item.title}</span>
										<ChevronRightIcon
											class="ms-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90"
										/>
									</Sidebar.MenuButton>
								{/snippet}
							</Collapsible.Trigger>
							<Collapsible.Content>
								<Sidebar.MenuSub>
									{#each item.items as subItem (subItem.title)}
										<Sidebar.MenuSubItem>
											<Sidebar.MenuSubButton isActive={$page.url.pathname === subItem.url} class="text-[13px]">
												{#snippet child({ props })}
													<a href={subItem.url} {...props}>
														<span>{subItem.title}</span>
													</a>
												{/snippet}
											</Sidebar.MenuSubButton>
										</Sidebar.MenuSubItem>
									{/each}
								</Sidebar.MenuSub>
							</Collapsible.Content>
						</Sidebar.MenuItem>
					{/snippet}
				</Collapsible.Root>
			{/if}
		{/each}
	</Sidebar.Menu>
</Sidebar.Group>
