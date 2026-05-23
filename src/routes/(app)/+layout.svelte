<!--
  ╔══════════════════════════════════════════════════════════╗
  ║  HALAMAN   : Layout Utama Aplikasi                       ║
  ║  RUTE      : / (semua halaman di dalam grup (app))       ║
  ╚══════════════════════════════════════════════════════════╝

  TUJUAN
    File ini adalah "pembungkus" (wrapper) yang mengelilingi
    semua halaman di dalam aplikasi setelah login. Setiap
    halaman seperti Dasbor, Transaksi, dll. akan selalu
    dirender di dalam layout ini.

  DATA YANG DIMUAT (dari +layout.server.ts)
    - user : objek data pengguna yang sedang login (nama,
             email, role, dll.)

  FITUR UTAMA
    - AppSidebar  : sidebar navigasi di sisi kiri layar
    - Breadcrumb  : navigasi "roti remah" di bagian header
                    yang menunjukkan posisi halaman saat ini
    - Toaster     : komponen notifikasi pop-up (toast) di
                    pojok kanan atas
    - Auth context: menyebarkan data user ke seluruh aplikasi
                    melalui setAuthContext() agar semua
                    komponen anak bisa mengaksesnya

  CATATAN TEKNIS
    - routeMap dibuat otomatis dengan mereduksi navGroups
      dari navigation.ts. Ini berarti cukup ubah navigation.ts
      saja untuk menambah/mengubah rute & label breadcrumb —
      tidak perlu menyentuh file ini.
    - $derived.by() dipakai untuk membuat breadcrumb secara
      reaktif: setiap kali URL berubah ($page.url.pathname),
      breadcrumb ikut diperbarui otomatis.
    - Grup navigasi berlabel "Area Kerja" tidak tampil sebagai
      parent breadcrumb (dianggap level teratas).
-->
<script lang="ts">
  // Import store 'page' bawaan SvelteKit untuk memantau URL aktif secara langsung
  import { page } from "$app/stores";
  // Import komponen sidebar navigasi
  import AppSidebar from "$lib/components/app-sidebar.svelte";
  // Import komponen remah roti (breadcrumb) navigasi
  import * as Breadcrumb from "$lib/components/ui/breadcrumb/index.js";
  import { Separator } from "$lib/components/ui/separator/index.js";
  import * as Sidebar from "$lib/components/ui/sidebar/index.js";
  // Import Toaster untuk menampilkan toast popup notifikasi sukses/error
  import { Toaster } from "svelte-sonner";
  // Import fungsi context share authentication agar halaman anak bisa tahu siapa yang login
  import { setAuthContext } from "$lib/states/auth.svelte.ts";
  import type { LayoutData } from "./$types";

  // Mengambil data user dari load function server, serta snippet halaman anak (children)
  let {
    data,
    children,
  }: { data: LayoutData; children: import("svelte").Snippet } = $props();

  // Daftarkan data user login ke context auth global
  const auth = setAuthContext(() => data.user);

  // Efek reaktif: Jika data user dari server berubah, update datanya di auth context
  $effect(() => {
    auth.user = data.user;
  });

  // Import struktur menu navigasi aplikasi dari config
  import { navGroups } from "$lib/config/navigation";

  // Bikin map rute URL ke label breadcrumb secara otomatis agar dinamis
  const routeMap = navGroups.reduce<Record<string, { parent?: string; label: string }>>((acc, group) => {
    group.items.forEach((item) => {
      acc[item.url] = {
        // Jika grup navigasi adalah "Area Kerja", set parent jadi kosong (dianggap menu utama)
        parent: group.label === "Area Kerja" ? undefined : group.label,
        label: item.title,
      };
    });
    return acc;
  }, {});

  // Ambil label breadcrumb secara reaktif berdasarkan path URL aktif saat ini (misal: /master-data/students)
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
