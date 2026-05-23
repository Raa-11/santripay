<script lang="ts" module>
  import { navGroups } from "$lib/config/navigation";
</script>

<script lang="ts">
  import { page } from "$app/stores";
  import { getAuthContext } from "$lib/states/auth.svelte.ts";
  import NavUser from "./nav-user.svelte";
  import * as Sidebar from "$lib/components/ui/sidebar/index.js";
  import { HugeiconsIcon } from "@hugeicons/svelte";
  import type { ComponentProps } from "svelte";

  let {
    ref = $bindable(null),
    collapsible = "icon",
    ...restProps
  }: ComponentProps<typeof Sidebar.Root> = $props();

  const auth = getAuthContext();
</script>

<Sidebar.Root bind:ref {collapsible} {...restProps}>
  <Sidebar.Header class="py-2">
    <Sidebar.Menu>
      <Sidebar.MenuItem>
        <Sidebar.MenuButton
          size="lg"
          class="pointer-events-none h-auto min-h-0 gap-2 px-3 py-2"
        >
          <img
            src="/menu.png"
            alt="ITASA"
            class="size-8 shrink-0 object-contain drop-shadow-sm contrast-125 saturate-125"
          />

          <span class="truncate text-base font-semibold tracking-tight">
            ITASA
          </span>
        </Sidebar.MenuButton>
      </Sidebar.MenuItem>
    </Sidebar.Menu>
  </Sidebar.Header>

  <Sidebar.Content>
    {#each navGroups as group (group.label)}
      <Sidebar.Group>
        <Sidebar.GroupLabel>{group.label}</Sidebar.GroupLabel>
        <Sidebar.Menu>
          {#each group.items as item (item.title)}
            <Sidebar.MenuItem>
              <Sidebar.MenuButton
                isActive={$page.url.pathname === item.url}
                tooltipContent={item.title}
                class="text-[13.5px]"
              >
                {#snippet child({ props })}
                  <a href={item.url} {...props}>
                    <HugeiconsIcon icon={item.icon} size={16} />
                    <span>{item.title}</span>
                  </a>
                {/snippet}
              </Sidebar.MenuButton>
            </Sidebar.MenuItem>
          {/each}
        </Sidebar.Menu>
      </Sidebar.Group>
    {/each}
  </Sidebar.Content>

  <Sidebar.Footer>
    {#if auth.user}
      <NavUser user={auth.user} />
    {/if}
  </Sidebar.Footer>
  <Sidebar.Rail />
</Sidebar.Root>
