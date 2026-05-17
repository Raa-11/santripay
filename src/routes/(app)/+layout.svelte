<script lang="ts">
  import { page } from "$app/stores";
  import AppSidebar from "$lib/components/app-sidebar.svelte";
  import * as Breadcrumb from "$lib/components/ui/breadcrumb/index.js";
  import { Separator } from "$lib/components/ui/separator/index.js";
  import * as Sidebar from "$lib/components/ui/sidebar/index.js";
  import { Toaster } from "svelte-sonner";
  import { setAuthContext } from "$lib/states/auth.svelte.ts";
  import type { LayoutData } from "./$types";

  let {
    data,
    children,
  }: { data: LayoutData; children: import("svelte").Snippet } = $props();

  const auth = setAuthContext(() => data.user);

  $effect(() => {
    auth.user = data.user;
  });

  import { navGroups } from "$lib/config/navigation";

  const routeMap = navGroups.reduce<Record<string, { parent?: string; label: string }>>((acc, group) => {
    group.items.forEach((item) => {
      acc[item.url] = {
        parent: group.label === "Workspace" ? undefined : group.label,
        label: item.title,
      };
    });
    return acc;
  }, {});

  const breadcrumb = $derived.by(() => {
    const path = $page.url.pathname;
    const match = Object.entries(routeMap).find(([route]) =>
      path.startsWith(route),
    );
    return match ? match[1] : null;
  });
</script>

<Toaster position="top-right" richColors closeButton />

<Sidebar.Provider>
  <AppSidebar user={data.user} />
  <Sidebar.Inset>
    <header class="flex h-12 shrink-0 items-center gap-2 border-b px-4">
      <Sidebar.Trigger class="-ms-1" />
      <Separator
        orientation="vertical"
        class="me-2 data-[orientation=vertical]:h-4"
      />
      {#if breadcrumb}
        <Breadcrumb.Root>
          <Breadcrumb.List>
            {#if breadcrumb.parent}
              <Breadcrumb.Item class="hidden md:block">
                <Breadcrumb.Link href="#">{breadcrumb.parent}</Breadcrumb.Link>
              </Breadcrumb.Item>
              <Breadcrumb.Separator class="hidden md:block" />
            {/if}
            <Breadcrumb.Item>
              <Breadcrumb.Page>{breadcrumb.label}</Breadcrumb.Page>
            </Breadcrumb.Item>
          </Breadcrumb.List>
        </Breadcrumb.Root>
      {/if}
    </header>
    <div class="mx-auto w-full max-w-7xl px-6 pt-15">
      {@render children()}
    </div>
  </Sidebar.Inset>
</Sidebar.Provider>
