<script lang="ts">
  import { HugeiconsIcon } from "@hugeicons/svelte";
  import {
    Search01Icon,
    UserAdd01Icon,
    Delete02Icon,
    Cancel01Icon,
    MoreVerticalIcon,
    PencilEdit01Icon,
    Delete01Icon,
    LockPasswordIcon,
  } from "@hugeicons/core-free-icons";

  import * as Table from "$lib/components/ui/table/index.js";
  import {
    createSvelteTable,
    FlexRender,
    renderSnippet,
  } from "$lib/components/ui/data-table/index.js";
  import ArrowUpDown from "@lucide/svelte/icons/arrow-up-down";
  import ArrowUp from "@lucide/svelte/icons/arrow-up";
  import ArrowDown from "@lucide/svelte/icons/arrow-down";
  import {
    type ColumnDef,
    type ColumnFiltersState,
    type PaginationState,
    type RowSelectionState,
    type SortingState,
    type VisibilityState,
    getCoreRowModel,
    getFilteredRowModel,
    getPaginationRowModel,
    getSortedRowModel,
  } from "@tanstack/table-core";
  import * as DropdownMenu from "$lib/components/ui/dropdown-menu/index.js";
  import * as Avatar from "$lib/components/ui/avatar/index.js";
  import * as Field from "$lib/components/ui/field/index.js";
  import { Button } from "$lib/components/ui/button/index.js";
  import { Input } from "$lib/components/ui/input/index.js";
  import { Checkbox } from "$lib/components/ui/checkbox/index.js";
  import {
    ActionBar,
    ActionBarGroup,
    ActionBarItem,
    ActionBarSeparator,
  } from "$lib/components/ui/action-bar/index.js";
  import Modal from "$lib/components/ui/modal.svelte";
  import ModalConfirmation from "$lib/components/ui/modal-confirmation.svelte";

  // Logic
  import { superForm } from "sveltekit-superforms";
  import { toast } from "svelte-sonner";
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();

  // ── 1. FORM STATE & ACTIONS ──

  // Add User
  let showAdd = $state(false);
  const {
    form: addForm,
    errors: addErrors,
    enhance: addEnhance,
    reset: addReset,
    constraints: addConstraints,
  } = superForm<any>(() => data.addForm, {
    onUpdated: ({ form }: { form: any }) => {
      if (form.valid) {
        showAdd = false;
        addReset();
        toast.success("Pengguna berhasil dibuat");
      } else if (form.message) toast.error(form.message);
    },
    onError: ({ result }) =>
      toast.error(result.error.message || "Gagal membuat pengguna"),
  });

  // Edit User
  let showEdit = $state(false);
  const {
    form: editForm,
    errors: editErrors,
    enhance: editEnhance,
    constraints: editConstraints,
  } = superForm<any>(() => data.editForm, {
    onUpdated: ({ form }: { form: any }) => {
      if (form.valid) {
        showEdit = false;
        toast.success("Profil berhasil diperbarui");
      } else if (form.message) toast.error(form.message);
    },
    onError: ({ result }) =>
      toast.error(result.error.message || "Gagal memperbarui"),
  });

  // Update Password
  let showPassword = $state(false);
  const {
    form: passForm,
    errors: passErrors,
    enhance: passEnhance,
    constraints: passConstraints,
  } = superForm<any>(() => data.passwordForm, {
    onUpdated: ({ form }: { form: any }) => {
      if (form.valid) {
        showPassword = false;
        toast.success("Kata sandi berhasil diperbarui");
      } else if (form.message) toast.error(form.message);
    },
    onError: ({ result }) =>
      toast.error(result.error.message || "Update keamanan gagal"),
  });

  // Deletion
  let showDeleteConfirm = $state(false);
  let userToDelete = $state<any>(null);
  const { enhance: delEnhance } = superForm<any>(() => data.deleteForm, {
    onUpdated: ({ form }: { form: any }) => {
      if (form.valid) {
        showDeleteConfirm = false;
        clearSelection();
        toast.success(form.message || "Aksi berhasil");
      } else if (form.message) toast.error(form.message);
    },
    onError: ({ result }) =>
      toast.error(result.error.message || "Penghapusan gagal"),
  });

  // ── 2. TABLE STATE ──
  let pagination = $state<PaginationState>({ pageIndex: 0, pageSize: 10 });
  let sorting = $state<SortingState>([]);
  let columnFilters = $state<ColumnFiltersState>([]);
  let rowSelection = $state<RowSelectionState>({});
  let columnVisibility = $state<VisibilityState>({});

  // ── 3. DERIVED LOGIC ──
  const selectedIds = $derived(Object.keys(rowSelection));
  const selectedCount = $derived(selectedIds.length);
  const selectedUser = $derived(
    selectedCount === 1
      ? data.users.find((u) => u.id === selectedIds[0])
      : null,
  );

  const clearSelection = () => (rowSelection = {});

  let columns: ColumnDef<any>[] = $derived([
    {
      id: "select",
      header: ({ table }) => renderSnippet(selectHeader, { table }),
      cell: ({ row }) => renderSnippet(selectCell, { row }),
      enableSorting: false,
      enableHiding: false,
    },
    {
      accessorKey: "id",
      header: ({ column }) => renderSnippet(sortHeader, { column, label: "ID" }),
      cell: ({ row }) => renderSnippet(idCell, { id: row.original.id }),
    },
    {
      accessorKey: "name",
      header: ({ column }) => renderSnippet(sortHeader, { column, label: "Nama" }),
      cell: ({ row }) => renderSnippet(nameCell, { user: row.original }),
    },
    {
      accessorKey: "email",
      header: ({ column }) => renderSnippet(sortHeader, { column, label: "Email" }),
      cell: ({ row }) => row.original.email,
    },
    {
      accessorKey: "emailVerified",
      header: ({ column }) => renderSnippet(sortHeader, { column, label: "Status" }),
      cell: ({ row }) => renderSnippet(statusCell, { emailVerified: row.original.emailVerified }),
    },
    {
      accessorKey: "createdAt",
      header: ({ column }) => renderSnippet(sortHeader, { column, label: "Bergabung" }),
      cell: ({ row }) => formatDate(row.original.createdAt),
    },
    {
      id: "actions",
      enableHiding: false,
      cell: ({ row }) => renderSnippet(actionsCell, { row }),
    },
  ]);

  const table = createSvelteTable({
    get data() { return data.users; },
    get columns() { return columns; },
    state: {
      get pagination() { return pagination; },
      get sorting() { return sorting; },
      get columnVisibility() { return columnVisibility; },
      get rowSelection() { return rowSelection; },
      get columnFilters() { return columnFilters; }
    },
    getRowId: (originalRow) => originalRow.id,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onPaginationChange: (updater) => {
      if (typeof updater === "function") pagination = updater(pagination);
      else pagination = updater;
    },
    onSortingChange: (updater) => {
      if (typeof updater === "function") sorting = updater(sorting);
      else sorting = updater;
    },
    onColumnFiltersChange: (updater) => {
      if (typeof updater === "function") columnFilters = updater(columnFilters);
      else columnFilters = updater;
    },
    onColumnVisibilityChange: (updater) => {
      if (typeof updater === "function") columnVisibility = updater(columnVisibility);
      else columnVisibility = updater;
    },
    onRowSelectionChange: (updater) => {
      if (typeof updater === "function") rowSelection = updater(rowSelection);
      else rowSelection = updater;
    }
  });

  const openEdit = (u: any) => {
    $editForm = {
      id: u.id,
      name: u.name,
      email: u.email,
    };
    showEdit = true;
  };

  const openPassword = (u: any) => {
    $passForm = {
      id: u.id,
      oldPassword: "",
      newPassword: "",
      confirmPassword: "",
    };
    showPassword = true;
  };

  const openDeleteConfirm = (u?: any) => {
    userToDelete = u || null;
    showDeleteConfirm = true;
  };

  // ── 5. HELPERS ──
  const initials = (n: string) =>
    n
      .split(" ")
      .slice(0, 2)
      .map((w) => w[0])
      .join("")
      .toUpperCase();
  const shortId = (id: string) => "USR-" + id.slice(0, 4).toUpperCase();
  const formatDate = (d: any) =>
    new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(new Date(d));
</script>

<!-- ── MODALS ── -->

<ModalConfirmation
  open={showDeleteConfirm}
  onClose={() => (showDeleteConfirm = false)}
  title={userToDelete
    ? "Hapus Akun Pengguna?"
    : `Hapus ${selectedCount} Akun?`}
  description={userToDelete
    ? `Apakah Anda yakin ingin menghapus ${userToDelete.name}? Tindakan ini tidak dapat dibatalkan.`
    : `Apakah Anda yakin ingin menghapus ${selectedCount} pengguna yang dipilih? Semua data terkait akan dihapus secara permanen.`}
  icon={Delete01Icon}
>
  <form
    method="POST"
    action="?/delete"
    use:delEnhance
    class="flex gap-3 w-full"
  >
    {#if userToDelete}
      <input type="hidden" name="ids" value={userToDelete.id} />
    {:else}
      {#each selectedIds as id}<input
          type="hidden"
          name="ids"
          value={id}
        />{/each}
    {/if}
    <Button
      variant="ghost"
      class="flex-1 h-10 text-xs font-bold"
      onclick={() => (showDeleteConfirm = false)}>Batal</Button
    >
    <Button
      type="submit"
      variant="destructive"
      class="flex-1 h-10 text-xs font-bold shadow-lg shadow-destructive/20"
      >Ya, Hapus</Button
    >
  </form>
</ModalConfirmation>

<Modal
  open={showAdd}
  onClose={() => (showAdd = false)}
  title="Tambah Pengguna Baru"
  icon={UserAdd01Icon}
  description="Buat akun sistem baru."
>
  <form
    id="add-user-form"
    method="POST"
    action="?/create"
    use:addEnhance
    class="space-y-4"
  >
    <Field.Field class="space-y-1.5">
      <Field.Label
        class="text-xs font-bold uppercase tracking-wider text-muted-foreground"
        >Nama Lengkap</Field.Label
      >
      <Field.Content
        ><Input
          name="name"
          bind:value={$addForm.name}
          {...$addConstraints.name}
          required
          class="h-10 bg-muted/50"
        /></Field.Content
      >
      {#if $addErrors.name}<Field.Error class="text-[10px]"
          >{$addErrors.name}</Field.Error
        >{/if}
    </Field.Field>
    <Field.Field class="space-y-1.5">
      <Field.Label
        class="text-xs font-bold uppercase tracking-wider text-muted-foreground"
        >Alamat Email</Field.Label
      >
      <Field.Content
        ><Input
          name="email"
          type="email"
          bind:value={$addForm.email}
          {...$addConstraints.email}
          required
          class="h-10 bg-muted/50"
        /></Field.Content
      >
      {#if $addErrors.email}<Field.Error class="text-[10px]"
          >{$addErrors.email}</Field.Error
        >{/if}
    </Field.Field>
    <div class="grid grid-cols-2 gap-3.5">
      <Field.Field class="space-y-1.5">
        <Field.Label
          class="text-xs font-bold uppercase tracking-wider text-muted-foreground"
          >Kata Sandi</Field.Label
        >
        <Field.Content
          ><Input
            name="password"
            type="password"
            bind:value={$addForm.password}
            {...$addConstraints.password}
            class="h-10 bg-muted/50"
          /></Field.Content
        >
      </Field.Field>
      <Field.Field class="space-y-1.5">
        <Field.Label
          class="text-xs font-bold uppercase tracking-wider text-muted-foreground"
          >Konfirmasi</Field.Label
        >
        <Field.Content
          ><Input
            name="confirmPassword"
            type="password"
            bind:value={$addForm.confirmPassword}
            {...$addConstraints.confirmPassword}
            class="h-10 bg-muted/50"
          /></Field.Content
        >
      </Field.Field>
    </div>
  </form>
  {#snippet footer()}
    <Button
      variant="ghost"
      class="h-10 px-4 text-xs font-bold"
      onclick={() => (showAdd = false)}>Batal</Button
    >
    <Button
      type="submit"
      form="add-user-form"
      class="h-10 px-4 text-xs font-bold shadow-lg shadow-primary/20"
      >Buat Pengguna</Button
    >
  {/snippet}
</Modal>

<Modal
  open={showEdit}
  onClose={() => (showEdit = false)}
  title="Edit Profil"
  icon={PencilEdit01Icon}
>
  <form
    id="edit-user-form"
    method="POST"
    action="?/update"
    use:editEnhance
    class="space-y-4"
  >
    <input type="hidden" name="id" bind:value={$editForm.id} />
    <Field.Field class="space-y-1.5">
      <Field.Label
        class="text-xs font-bold uppercase tracking-wider text-muted-foreground"
        >Nama Lengkap</Field.Label
      >
      <Field.Content
        ><Input
          name="name"
          bind:value={$editForm.name}
          {...$editConstraints.name}
          required
          class="h-10 bg-muted/50"
        /></Field.Content
      >
      {#if $editErrors.name}<Field.Error class="text-[10px]"
          >{$editErrors.name}</Field.Error
        >{/if}
    </Field.Field>
    <Field.Field class="space-y-1.5">
      <Field.Label
        class="text-xs font-bold uppercase tracking-wider text-muted-foreground"
        >Alamat Email</Field.Label
      >
      <Field.Content
        ><Input
          name="email"
          type="email"
          bind:value={$editForm.email}
          {...$editConstraints.email}
          required
          class="h-10 bg-muted/50"
        /></Field.Content
      >
      {#if $editErrors.email}<Field.Error class="text-[10px]"
          >{$editErrors.email}</Field.Error
        >{/if}
    </Field.Field>
  </form>
  {#snippet footer()}
    <Button
      variant="ghost"
      class="h-10 px-4 text-xs font-bold"
      onclick={() => (showEdit = false)}>Batal</Button
    >
    <Button
      type="submit"
      form="edit-user-form"
      class="h-10 px-4 text-xs font-bold shadow-sm">Simpan Perubahan</Button
    >
  {/snippet}
</Modal>

<Modal
  open={showPassword}
  onClose={() => (showPassword = false)}
  title="Perbarui Kata Sandi"
  icon={LockPasswordIcon}
>
  <form
    id="password-user-form"
    method="POST"
    action="?/updatePassword"
    use:passEnhance
    class="space-y-4"
  >
    <input type="hidden" name="id" bind:value={$passForm.id} />
    <Field.Field class="space-y-1.5">
      <Field.Label
        class="text-xs font-bold uppercase tracking-wider text-muted-foreground"
        >Kata Sandi Lama</Field.Label
      >
      <Field.Content
        ><Input
          name="oldPassword"
          type="password"
          bind:value={$passForm.oldPassword}
          {...$passConstraints.oldPassword}
          required
          class="h-10 bg-muted/50"
        /></Field.Content
      >
      {#if $passErrors.oldPassword}<Field.Error class="text-[10px]"
          >{$passErrors.oldPassword}</Field.Error
        >{/if}
    </Field.Field>
    <div class="grid grid-cols-2 gap-3.5">
      <Field.Field class="space-y-1.5">
        <Field.Label
          class="text-xs font-bold uppercase tracking-wider text-muted-foreground"
          >Kata Sandi Baru</Field.Label
        >
        <Field.Content
          ><Input
            name="newPassword"
            type="password"
            bind:value={$passForm.newPassword}
            {...$passConstraints.newPassword}
            required
            class="h-10 bg-muted/50"
          /></Field.Content
        >
        {#if $passErrors.newPassword}<Field.Error class="text-[10px]"
            >{$passErrors.newPassword}</Field.Error
          >{/if}
      </Field.Field>
      <Field.Field class="space-y-1.5">
        <Field.Label
          class="text-xs font-bold uppercase tracking-wider text-muted-foreground"
          >Konfirmasi</Field.Label
        >
        <Field.Content
          ><Input
            name="confirmPassword"
            type="password"
            bind:value={$passForm.confirmPassword}
            {...$passConstraints.confirmPassword}
            required
            class="h-10 bg-muted/50"
          /></Field.Content
        >
        {#if $passErrors.confirmPassword}<Field.Error class="text-[10px]"
            >{$passErrors.confirmPassword}</Field.Error
          >{/if}
      </Field.Field>
    </div>
  </form>
  {#snippet footer()}
    <Button
      variant="ghost"
      class="h-10 px-4 text-xs font-bold"
      onclick={() => (showPassword = false)}>Batal</Button
    >
    <Button
      type="submit"
      form="password-user-form"
      class="h-10 px-4 text-xs font-bold shadow-sm">Perbarui Kata Sandi</Button
    >
  {/snippet}
</Modal>

<!-- ── MAIN CONTENT ── -->

<div class="flex flex-1 flex-col gap-6">
  <!-- HEADER -->
  <div class="flex items-center justify-between">
    <div>
      <h1 class="text-2xl font-semibold tracking-tight">Manajemen Pengguna</h1>
      <p class="text-muted-foreground mt-1 text-sm">
        Kelola akun sistem dan hak akses pengguna.
      </p>
    </div>
    <Button
      class="gap-2"
      onclick={() => {
        addReset();
        showAdd = true;
      }}
    >
      <HugeiconsIcon icon={UserAdd01Icon} size={16} /> Tambah Pengguna
    </Button>
  </div>

  <!-- FILTERS -->
  <div class="flex items-center justify-between gap-2">
    <div class="relative w-64">
      <span class="text-muted-foreground absolute top-1/2 left-2.5 -translate-y-1/2">
        <HugeiconsIcon icon={Search01Icon} size={14} />
      </span>
      <Input
        placeholder="Cari pengguna..."
        value={(table.getColumn("name")?.getFilterValue() as string) ?? ""}
        oninput={(e) => table.getColumn("name")?.setFilterValue(e.currentTarget.value)}
        class="h-8 pl-8 text-xs bg-card"
      />
    </div>

    <DropdownMenu.Root>
      <DropdownMenu.Trigger>
        {#snippet child({ props })}
          <Button {...props} variant="outline" size="sm" class="gap-1.5 h-8 text-xs font-semibold">
            Tampilan
          </Button>
        {/snippet}
      </DropdownMenu.Trigger>
      <DropdownMenu.Content align="end" class="min-w-40 rounded-lg border p-1 shadow-md bg-card">
        <p class="text-muted-foreground px-2 py-1 text-[11px] font-medium uppercase tracking-wide">Tampilkan Kolom</p>
        {#each table.getAllColumns().filter((col) => col.getCanHide()) as column (column.id)}
          <DropdownMenu.CheckboxItem
            class="capitalize text-xs rounded-md px-2 py-1.5 focus:bg-accent focus:text-accent-foreground"
            bind:checked={
              () => column.getIsVisible(), (v) => column.toggleVisibility(!!v)
            }
          >
            {column.id === "emailVerified" ? "status" : column.id}
          </DropdownMenu.CheckboxItem>
        {/each}
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  </div>

  <!-- DATA TABLE -->
  <div class="rounded-xl border bg-card overflow-hidden">
    <Table.Root data-sorting={sorting} data-page={pagination.pageIndex} data-filters={columnFilters}>
      <Table.Header>
        {#each table.getHeaderGroups() as headerGroup (headerGroup.id)}
          <Table.Row class="hover:bg-transparent border-b">
            {#each headerGroup.headers as header (header.id)}
              {@const wClass = header.id === "select" ? "w-10" :
                               header.id === "actions" ? "w-10 text-right" :
                               header.id === "id" ? "w-28" :
                               header.id === "email" ? "w-44" :
                               header.id === "emailVerified" ? "w-24" :
                               header.id === "createdAt" ? "w-32" : "w-auto"}
              <Table.Head class="px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground {wClass}">
                {#if !header.isPlaceholder}
                  <FlexRender
                    content={header.column.columnDef.header}
                    context={header.getContext()}
                  />
                {/if}
              </Table.Head>
            {/each}
          </Table.Row>
        {/each}
      </Table.Header>
      <Table.Body>
        {#each table.getRowModel().rows as row (row.id)}
          <Table.Row data-state={row.getIsSelected() && "selected"}>
            {#each row.getVisibleCells() as cell (cell.id)}
              {@const wClass = cell.column.id === "select" ? "w-10" :
                               cell.column.id === "actions" ? "w-10 text-right" :
                               cell.column.id === "id" ? "w-28" :
                               cell.column.id === "email" ? "w-44" :
                               cell.column.id === "emailVerified" ? "w-24" :
                               cell.column.id === "createdAt" ? "w-32" : "w-auto"}
              <Table.Cell class="px-3 py-1.5 text-xs {wClass}">
                <FlexRender
                  content={cell.column.columnDef.cell}
                  context={cell.getContext()}
                />
              </Table.Cell>
            {/each}
          </Table.Row>
        {:else}
          <Table.Row>
            <Table.Cell colspan={columns.length} class="h-20 text-center text-xs">
              Tidak ada data.
            </Table.Cell>
          </Table.Row>
        {/each}
      </Table.Body>
    </Table.Root>
  </div>

  <!-- PAGINATION -->
  <div class="flex items-center justify-between text-xs text-muted-foreground">
    <span>
      {table.getFilteredSelectedRowModel().rows.length} dari {table.getFilteredRowModel().rows.length} baris dipilih
    </span>
    <div class="flex items-center gap-4">
      <div class="flex items-center gap-2">
        <span>Baris per halaman</span>
        <select
          class="rounded-md border px-2 py-1 bg-transparent font-medium text-xs focus:outline-none"
          value={table.getState().pagination.pageSize}
          onchange={(e) => table.setPageSize(Number(e.currentTarget.value))}
        >
          {#each [10, 20, 50] as n}
            <option value={n}>{n}</option>
          {/each}
        </select>
      </div>
      <div class="flex items-center gap-1 font-bold text-foreground">
        <Button
          variant="outline"
          size="icon-sm"
          class="size-8"
          disabled={!table.getCanPreviousPage()}
          onclick={() => table.previousPage()}
        >
          ‹
        </Button>
        <span class="px-3 py-1.5 bg-muted/50 rounded-md">
          Halaman {table.getState().pagination.pageIndex + 1} dari {table.getPageCount()}
        </span>
        <Button
          variant="outline"
          size="icon-sm"
          class="size-8"
          disabled={!table.getCanNextPage()}
          onclick={() => table.nextPage()}
        >
          ›
        </Button>
      </div>
    </div>
  </div>
</div>

<!-- ACTION BAR -->
<ActionBar open={selectedCount > 0}>
  <div
    class="flex items-center gap-1 rounded-md border bg-background px-1 py-0.5"
  >
    <span class="px-2 text-[11px] font-bold">{selectedCount} dipilih</span>
    <div class="h-4 w-[1px] bg-border"></div>
    <ActionBarItem
      variant="ghost"
      size="icon-sm"
      class="size-7"
      onSelect={clearSelection}
      aria-label="Hapus pilihan"
    >
      <HugeiconsIcon icon={Cancel01Icon} size={14} />
    </ActionBarItem>
  </div>
  <ActionBarSeparator />
  <ActionBarGroup>
    {#if selectedCount === 1}
      <ActionBarItem
        variant="secondary"
        size="sm"
        class="h-8 gap-1.5 px-3 text-[11px] font-bold"
        onSelect={() => {
          if (selectedUser) openEdit(selectedUser);
        }}
      >
        <HugeiconsIcon icon={PencilEdit01Icon} size={14} /> Edit Profil
      </ActionBarItem>
    {/if}
    <ActionBarItem
      variant="destructive"
      size="sm"
      class="h-8 gap-1.5 bg-red-50 px-3 text-[11px] font-bold text-red-600 hover:bg-red-100 border-none"
      onSelect={() => openDeleteConfirm()}
    >
      <HugeiconsIcon icon={Delete02Icon} size={14} /> Hapus Terpilih
    </ActionBarItem>
  </ActionBarGroup>
</ActionBar>

{#snippet selectHeader({ table }: { table: any })}
  <Checkbox
    checked={table.getIsAllPageRowsSelected()}
    indeterminate={table.getIsSomePageRowsSelected() && !table.getIsAllPageRowsSelected()}
    onCheckedChange={(v) => table.toggleAllPageRowsSelected(!!v)}
    aria-label="Pilih semua"
  />
{/snippet}

{#snippet selectCell({ row }: { row: any })}
  <Checkbox
    checked={row.getIsSelected()}
    onCheckedChange={(v) => row.toggleSelected(!!v)}
    aria-label="Pilih baris"
  />
{/snippet}

{#snippet sortHeader({ column, label }: { column: any; label: string })}
  <Button
    variant="ghost"
    class="-ml-3 h-7 text-[11px] font-bold uppercase tracking-wider hover:bg-transparent {column.getIsSorted() ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'}"
    onclick={(e) => column.getToggleSortingHandler()?.(e)}
  >
    {label}
    {#if column.getIsSorted() === "asc"}
      <ArrowUp class="ml-1.5 size-3.5 text-primary" />
    {:else if column.getIsSorted() === "desc"}
      <ArrowDown class="ml-1.5 size-3.5 text-primary" />
    {:else}
      <ArrowUpDown class="ml-1.5 size-3.5 text-muted-foreground/40" />
    {/if}
  </Button>
{/snippet}

{#snippet idCell({ id }: { id: string })}
  <span class="font-mono text-[10px] text-muted-foreground">{shortId(id)}</span>
{/snippet}

{#snippet nameCell({ user }: { user: any })}
  <div class="flex items-center gap-2">
    <Avatar.Root class="size-6 text-[9px]">
      <Avatar.Fallback class="font-bold">{initials(user.name)}</Avatar.Fallback>
    </Avatar.Root>
    <span class="font-medium text-foreground text-xs">{user.name}</span>
  </div>
{/snippet}

{#snippet statusCell({ emailVerified }: { emailVerified: boolean })}
  <span
    class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold {emailVerified
      ? 'bg-emerald-50 text-emerald-700'
      : 'bg-amber-50 text-amber-700'}"
  >
    <span
      class="size-1.5 rounded-full {emailVerified
        ? 'bg-emerald-500'
        : 'bg-amber-400'}"
    ></span>
    {emailVerified ? "Terverifikasi" : "Belum Terverifikasi"}
  </span>
{/snippet}

{#snippet actionsCell({ row }: { row: any })}
  <DropdownMenu.Root>
    <DropdownMenu.Trigger
      >{#snippet child({ props })}<button
          {...props}
          class="text-muted-foreground hover:text-foreground flex size-7 items-center justify-center rounded-md"
          ><HugeiconsIcon
            icon={MoreVerticalIcon}
            size={15}
          /></button
        >{/snippet}</DropdownMenu.Trigger
    >
    <DropdownMenu.Content align="end" class="w-44 bg-card">
      <DropdownMenu.Item
        class="gap-2 text-xs"
        onclick={() => openEdit(row.original)}
        ><HugeiconsIcon icon={PencilEdit01Icon} size={13} /> Edit Profil</DropdownMenu.Item
      >
      <DropdownMenu.Item
        class="gap-2 text-xs"
        onclick={() => openPassword(row.original)}
        ><HugeiconsIcon icon={LockPasswordIcon} size={13} /> Perbarui Kata Sandi</DropdownMenu.Item
      >
      {#if row.original.id !== data.currentUserId}
        <DropdownMenu.Separator />
        <DropdownMenu.Item
          class="text-destructive gap-2 text-xs"
          onclick={() => openDeleteConfirm(row.original)}
          ><HugeiconsIcon icon={Delete01Icon} size={13} /> Hapus Akun</DropdownMenu.Item
        >
      {/if}
    </DropdownMenu.Content>
  </DropdownMenu.Root>
{/snippet}
