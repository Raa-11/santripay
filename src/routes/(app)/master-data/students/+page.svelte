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
    Tick02Icon,
    Table01Icon,
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
  import * as Field from "$lib/components/ui/field/index.js";
  import { Button } from "$lib/components/ui/button/index.js";
  import { Input } from "$lib/components/ui/input/index.js";
  import { Textarea } from "$lib/components/ui/textarea/index.js";
  import * as NativeSelect from "$lib/components/ui/native-select/index.js";
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

  // Add Student
  let showAdd = $state(false);
  const {
    form: addForm,
    errors: addErrors,
    enhance: addEnhance,
    reset: addReset,
    constraints: addConstraints,
  } = superForm<any>(() => data.addForm, {
    onUpdated: ({ form }) => {
      if (form.valid) {
        (showAdd = false), addReset(), toast.success("Student created");
      } else if (form.message) toast.error(form.message);
    },
    onError: ({ result }) =>
      toast.error(result.error.message || "Failed to create student"),
  });

  // Edit Student
  let showEdit = $state(false);
  const {
    form: editForm,
    errors: editErrors,
    enhance: editEnhance,
    constraints: editConstraints,
  } = superForm<any>(() => data.editForm, {
    onUpdated: ({ form }) => {
      if (form.valid) {
        (showEdit = false), toast.success("Student updated");
      } else if (form.message) toast.error(form.message);
    },
    onError: ({ result }) =>
      toast.error(result.error.message || "Update failed"),
  });

  // Deletion
  let showDeleteConfirm = $state(false);
  let itemToDelete = $state<any>(null);
  const { enhance: delEnhance } = superForm<any>(() => data.deleteForm, {
    onUpdated: ({ form }) => {
      if (form.valid) {
        (showDeleteConfirm = false),
          clearSelection(),
          toast.success(form.message || "Action completed");
      } else if (form.message) toast.error(form.message);
    },
    onError: ({ result }) =>
      toast.error(result.error.message || "Deletion failed"),
  });

  // Bulk Status
  let showStatusConfirm = $state(false);
  let statusToSet = $state(false);
  const { enhance: statusEnhance, form: statusForm } = superForm<any>(() => data.bulkStatusForm, {
    onUpdated: ({ form }) => {
      if (form.valid) {
        showStatusConfirm = false;
        clearSelection();
        toast.success(form.message || "Status updated");
      } else if (form.message) toast.error(form.message);
    },
    onError: ({ result }) => toast.error(result.error.message || "Failed to update status"),
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
      accessorKey: "nis",
      header: ({ column }) => renderSnippet(sortHeader, { column, label: "NIS" }),
    },
    {
      accessorKey: "name",
      header: ({ column }) => renderSnippet(sortHeader, { column, label: "Name" }),
      cell: ({ row }) => renderSnippet(nameCell, { name: row.original.name }),
    },
    {
      accessorKey: "class",
      header: ({ column }) => renderSnippet(sortHeader, { column, label: "Class" }),
      cell: ({ row }) => row.original.class || "-",
    },
    {
      accessorKey: "gender",
      header: ({ column }) => renderSnippet(sortHeader, { column, label: "Gender" }),
      cell: ({ row }) => row.original.gender || "-",
    },
    {
      accessorKey: "isActive",
      header: ({ column }) => renderSnippet(sortHeader, { column, label: "Status" }),
      cell: ({ row }) => renderSnippet(statusCell, { isActive: row.original.isActive }),
    },
    {
      accessorKey: "createdAt",
      header: ({ column }) => renderSnippet(sortHeader, { column, label: "Joined" }),
      cell: ({ row }) => formatDate(row.original.createdAt),
    },
    {
      id: "actions",
      enableHiding: false,
      cell: ({ row }) => renderSnippet(actionsCell, { row }),
    },
  ]);

  const table = createSvelteTable({
    get data() { return data.items; },
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

  const openDeleteConfirm = (u?: any) => (
    (itemToDelete = u || null), (showDeleteConfirm = true)
  );
  const openEdit = (u: any) => (
    editForm.set({
      ...$editForm,
      id: u.id,
      nis: u.nis,
      name: u.name,
      gender: u.gender || "",
      class: u.class || "",
      address: u.address || "",
      isActive: u.isActive ?? true,
    }),
    (showEdit = true)
  );

  // ── 5. HELPERS ──
  const formatDate = (d: any) =>
    new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(new Date(d));

  // Sync from Server Data
  // Sync from Server Data removed because Tanstack handles it locally
</script>

<!-- ── MODALS ── -->

<ModalConfirmation
  open={showDeleteConfirm}
  onClose={() => (showDeleteConfirm = false)}
  title={itemToDelete
    ? "Delete Student?"
    : `Delete ${selectedCount} Students?`}
  description={itemToDelete
    ? `Are you sure you want to delete ${itemToDelete.name}? This action cannot be undone.`
    : `Are you sure you want to delete ${selectedCount} selected students? All related data will be permanently removed.`}
  icon={Delete01Icon}
>
  <form
    method="POST"
    action="?/delete"
    use:delEnhance
    class="flex gap-3 w-full"
  >
    {#if itemToDelete}
      <input type="hidden" name="ids" value={itemToDelete.id} />
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
      onclick={() => (showDeleteConfirm = false)}>Cancel</Button
    >
    <Button
      type="submit"
      variant="destructive"
      class="flex-1 h-10 text-xs font-bold shadow-lg shadow-destructive/20"
      >Yes, Delete</Button
    >
  </form>
</ModalConfirmation>

<ModalConfirmation
  open={showStatusConfirm}
  onClose={() => (showStatusConfirm = false)}
  title={`Set ${statusToSet ? 'Active' : 'Inactive'}?`}
  description={`Are you sure you want to mark ${selectedCount} selected students as ${statusToSet ? 'Active' : 'Inactive'}?`}
  icon={Tick02Icon}
>
  <form
    method="POST"
    action="?/bulkStatus"
    use:statusEnhance
    class="flex gap-3 w-full"
  >
    {#each selectedIds as id}
      <input type="hidden" name="ids" value={id} />
    {/each}
    <input type="hidden" name="isActive" bind:value={$statusForm.isActive} />
    <Button
      variant="ghost"
      class="flex-1 h-10 text-xs font-bold"
      onclick={() => (showStatusConfirm = false)}>Cancel</Button
    >
    <Button
      type="submit"
      class="flex-1 h-10 text-xs font-bold shadow-lg text-white {statusToSet ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/20' : 'bg-stone-600 hover:bg-stone-700 shadow-stone-500/20'}"
      onclick={() => (($statusForm as any).isActive = statusToSet)}
      >Yes, Proceed</Button
    >
  </form>
</ModalConfirmation>

<Modal
  open={showAdd}
  onClose={() => (showAdd = false)}
  title="Add New Student"
  icon={UserAdd01Icon}
  description="Register a new student."
  maxWidth="500px"
>
  <form
    id="add-student-form"
    method="POST"
    action="?/create"
    use:addEnhance
    class="space-y-4"
  >
    <Field.Field class="space-y-1.5">
      <Field.Label
        class="text-xs font-bold uppercase tracking-wider text-muted-foreground"
        >NIS <span class="text-destructive">*</span></Field.Label
      >
      <Field.Content
        ><Input
          name="nis"
          bind:value={$addForm.nis}
          {...$addConstraints.nis}
          required
          class="h-10 bg-muted/50"
        /></Field.Content
      >
      {#if $addErrors.nis}<Field.Error class="text-[10px]"
          >{$addErrors.nis}</Field.Error
        >{/if}
    </Field.Field>

    <Field.Field class="space-y-1.5">
      <Field.Label
        class="text-xs font-bold uppercase tracking-wider text-muted-foreground"
        >Full Name <span class="text-destructive">*</span></Field.Label
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

    <div class="grid grid-cols-2 gap-3.5">
      <Field.Field class="space-y-1.5">
        <Field.Label
          class="text-xs font-bold uppercase tracking-wider text-muted-foreground"
          >Class</Field.Label
        >
        <Field.Content
          ><Input
            name="class"
            bind:value={$addForm.class}
            {...$addConstraints.class}
            class="h-10 bg-muted/50"
          /></Field.Content
        >
      </Field.Field>

      <Field.Field class="space-y-1.5">
        <Field.Label
          class="text-xs font-bold uppercase tracking-wider text-muted-foreground"
          >Gender</Field.Label
        >
        <Field.Content
          ><NativeSelect.Root
            name="gender"
            bind:value={$addForm.gender}
            {...$addConstraints.gender}
          >
            <NativeSelect.Option value="">Select Gender</NativeSelect.Option>
            <NativeSelect.Option value="Male">Male</NativeSelect.Option>
            <NativeSelect.Option value="Female">Female</NativeSelect.Option>
          </NativeSelect.Root></Field.Content
        >
      </Field.Field>
    </div>



    <Field.Field class="space-y-1.5">
      <Field.Label
        class="text-xs font-bold uppercase tracking-wider text-muted-foreground"
        >Address</Field.Label
      >
      <Field.Content
        ><Textarea
          name="address"
          bind:value={$addForm.address}
          {...$addConstraints.address}
          class="min-h-[80px] bg-muted/50"
        /></Field.Content
      >
    </Field.Field>
  </form>
  {#snippet footer()}
    <Button
      variant="ghost"
      class="h-10 px-4 text-xs font-bold"
      onclick={() => (showAdd = false)}>Discard</Button
    >
    <Button
      type="submit"
      form="add-student-form"
      class="h-10 px-4 text-xs font-bold shadow-lg shadow-primary/20"
      >Create Student</Button
    >
  {/snippet}
</Modal>

<Modal
  open={showEdit}
  onClose={() => (showEdit = false)}
  title="Edit Student"
  icon={PencilEdit01Icon}
  maxWidth="500px"
>
  <form
    id="edit-student-form"
    method="POST"
    action="?/update"
    use:editEnhance
    class="space-y-4"
  >
    <input type="hidden" name="id" bind:value={$editForm.id} />

    <Field.Field class="space-y-1.5">
      <Field.Label
        class="text-xs font-bold uppercase tracking-wider text-muted-foreground"
        >NIS <span class="text-destructive">*</span></Field.Label
      >
      <Field.Content
        ><Input
          name="nis"
          bind:value={$editForm.nis}
          {...editConstraints.nis}
          required
          class="h-10 bg-muted/50"
        /></Field.Content
      >
      {#if $editErrors.nis}<Field.Error class="text-[10px]"
          >{$editErrors.nis}</Field.Error
        >{/if}
    </Field.Field>

    <Field.Field class="space-y-1.5">
      <Field.Label
        class="text-xs font-bold uppercase tracking-wider text-muted-foreground"
        >Full Name <span class="text-destructive">*</span></Field.Label
      >
      <Field.Content
        ><Input
          name="name"
          bind:value={$editForm.name}
          {...editConstraints.name}
          required
          class="h-10 bg-muted/50"
        /></Field.Content
      >
      {#if $editErrors.name}<Field.Error class="text-[10px]"
          >{$editErrors.name}</Field.Error
        >{/if}
    </Field.Field>

    <div class="grid grid-cols-2 gap-3.5">
      <Field.Field class="space-y-1.5">
        <Field.Label
          class="text-xs font-bold uppercase tracking-wider text-muted-foreground"
          >Class</Field.Label
        >
        <Field.Content
          ><Input
            name="class"
            bind:value={$editForm.class}
            {...editConstraints.class}
            class="h-10 bg-muted/50"
          /></Field.Content
        >
      </Field.Field>

      <Field.Field class="space-y-1.5">
        <Field.Label
          class="text-xs font-bold uppercase tracking-wider text-muted-foreground"
          >Gender</Field.Label
        >
        <Field.Content
          ><NativeSelect.Root
            name="gender"
            bind:value={$editForm.gender}
            {...editConstraints.gender}
          >
            <NativeSelect.Option value="">Select Gender</NativeSelect.Option>
            <NativeSelect.Option value="Male">Male</NativeSelect.Option>
            <NativeSelect.Option value="Female">Female</NativeSelect.Option>
          </NativeSelect.Root></Field.Content
        >
      </Field.Field>
    </div>

    <div class="flex items-center pt-2 pb-1">
      <label class="flex items-center gap-2 cursor-pointer text-sm font-medium">
        <Checkbox name="isActive" bind:checked={$editForm.isActive} />
        Active Status
      </label>
    </div>

    <Field.Field class="space-y-1.5">
      <Field.Label
        class="text-xs font-bold uppercase tracking-wider text-muted-foreground"
        >Address</Field.Label
      >
      <Field.Content
        ><Textarea
          name="address"
          bind:value={$editForm.address}
          {...editConstraints.address}
          class="min-h-[80px] bg-muted/50"
        /></Field.Content
      >
    </Field.Field>
  </form>
  {#snippet footer()}
    <Button
      variant="ghost"
      class="h-10 px-4 text-xs font-bold"
      onclick={() => (showEdit = false)}>Cancel</Button
    >
    <Button
      type="submit"
      form="edit-student-form"
      class="h-10 px-4 text-xs font-bold shadow-sm">Save Changes</Button
    >
  {/snippet}
</Modal>

<!-- ── MAIN CONTENT ── -->

<div class="flex flex-1 flex-col gap-6">
  <!-- HEADER -->
  <div class="flex items-center justify-between">
    <div>
      <h1 class="text-2xl font-semibold tracking-tight">Student Directory</h1>
      <p class="text-muted-foreground mt-1 text-sm">
        Manage students and their profiles.
      </p>
    </div>
    <Button
      class="gap-2"
      onclick={() => {
        addReset();
        ($addForm as any).isActive = true;
        showAdd = true;
      }}
    >
      <HugeiconsIcon icon={UserAdd01Icon} size={16} /> Add Student
    </Button>
  </div>

  <!-- FILTERS -->
  <div class="flex items-center justify-between gap-2">
    <div class="relative w-64">
      <span class="text-muted-foreground absolute top-1/2 left-2.5 -translate-y-1/2">
        <HugeiconsIcon icon={Search01Icon} size={14} />
      </span>
      <Input
        placeholder="Filter names..."
        value={(table.getColumn("name")?.getFilterValue() as string) ?? ""}
        oninput={(e) => table.getColumn("name")?.setFilterValue(e.currentTarget.value)}
        class="h-8 pl-8 text-xs bg-card"
      />
    </div>

    <DropdownMenu.Root>
      <DropdownMenu.Trigger>
        {#snippet child({ props })}
          <Button {...props} variant="outline" size="sm" class="gap-1.5 h-8 text-xs font-semibold">
            <HugeiconsIcon icon={Table01Icon} size={13} />
            View
          </Button>
        {/snippet}
      </DropdownMenu.Trigger>
      <DropdownMenu.Content align="end" class="min-w-40 rounded-lg border p-1 shadow-md">
        <p class="text-muted-foreground px-2 py-1 text-[11px] font-medium uppercase tracking-wide">Toggle columns</p>
        {#each table.getAllColumns().filter((col) => col.getCanHide()) as column (column.id)}
          <DropdownMenu.CheckboxItem
            class="capitalize text-xs rounded-md px-2 py-1.5 focus:bg-accent focus:text-accent-foreground"
            bind:checked={
              () => column.getIsVisible(), (v) => column.toggleVisibility(!!v)
            }
          >
            {column.id}
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
                               header.id === "nis" ? "w-28" :
                               header.id === "class" ? "w-20" :
                               header.id === "gender" ? "w-24" :
                               header.id === "isActive" ? "w-24" :
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
                               cell.column.id === "nis" ? "w-28" :
                               cell.column.id === "class" ? "w-20" :
                               cell.column.id === "gender" ? "w-24" :
                               cell.column.id === "isActive" ? "w-24" :
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
              No results.
            </Table.Cell>
          </Table.Row>
        {/each}
      </Table.Body>
    </Table.Root>
  </div>

  <!-- PAGINATION -->
  <div class="flex items-center justify-between text-xs text-muted-foreground">
    <span>
      {table.getFilteredSelectedRowModel().rows.length} of {table.getFilteredRowModel().rows.length} row(s) selected
    </span>
    <div class="flex items-center gap-4">
      <div class="flex items-center gap-2">
        <span>Rows per page</span>
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
      <div class="flex items-center gap-1">
        <Button
          variant="outline"
          size="icon-sm"
          class="size-8 text-xs"
          disabled={!table.getCanPreviousPage()}
          onclick={() => table.previousPage()}
        >
          ‹
        </Button>
        <span class="px-3 py-1 bg-muted/50 rounded-md font-bold text-foreground text-xs">
          Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount() || 1}
        </span>
        <Button
          variant="outline"
          size="icon-sm"
          class="size-8 text-xs"
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
    <span class="px-2 text-[11px] font-bold">{selectedCount} selected</span>
    <div class="h-4 w-[1px] bg-border"></div>
    <ActionBarItem
      variant="ghost"
      size="icon-sm"
      class="size-7"
      onSelect={clearSelection}
      aria-label="Clear selection"
    >
      <HugeiconsIcon icon={Cancel01Icon} size={14} />
    </ActionBarItem>
  </div>
  <ActionBarSeparator />
  <ActionBarGroup>
    <ActionBarItem
      variant="secondary"
      size="sm"
      class="h-8 gap-1.5 px-3 text-[11px] font-bold hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200"
      onSelect={() => {
        statusToSet = true;
        showStatusConfirm = true;
      }}
    >
      <HugeiconsIcon icon={Tick02Icon} size={14} /> Set Active
    </ActionBarItem>
    <ActionBarItem
      variant="secondary"
      size="sm"
      class="h-8 gap-1.5 px-3 text-[11px] font-bold hover:bg-stone-100 hover:text-stone-700 hover:border-stone-200"
      onSelect={() => {
        statusToSet = false;
        showStatusConfirm = true;
      }}
    >
      <HugeiconsIcon icon={Cancel01Icon} size={14} /> Set Inactive
    </ActionBarItem>
    <ActionBarItem
      variant="destructive"
      size="sm"
      class="h-8 gap-1.5 bg-red-50 px-3 text-[11px] font-bold text-red-600 hover:bg-red-100 border-none ml-1.5"
      onSelect={() => openDeleteConfirm()}
    >
      <HugeiconsIcon icon={Delete02Icon} size={14} /> Delete Selected
    </ActionBarItem>
  </ActionBarGroup>
</ActionBar>

{#snippet selectHeader({ table }: { table: any })}
  <Checkbox
    checked={table.getIsAllPageRowsSelected()}
    indeterminate={table.getIsSomePageRowsSelected() && !table.getIsAllPageRowsSelected()}
    onCheckedChange={(v) => table.toggleAllPageRowsSelected(!!v)}
    aria-label="Select all"
  />
{/snippet}

{#snippet selectCell({ row }: { row: any })}
  <Checkbox
    checked={row.getIsSelected()}
    onCheckedChange={(v) => row.toggleSelected(!!v)}
    aria-label="Select row"
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

{#snippet nameCell({ name }: { name: string })}
  <div class="flex items-center gap-2">
    <span class="text-xs font-medium">{name}</span>
  </div>
{/snippet}

{#snippet statusCell({ isActive }: { isActive: boolean })}
  <span class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold {isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-stone-100 text-stone-600'}">
    <span class="size-1.5 rounded-full {isActive ? 'bg-emerald-500' : 'bg-stone-400'}"></span>
    {isActive ? 'Active' : 'Inactive'}
  </span>
{/snippet}

{#snippet actionsCell({ row }: { row: any })}
  <DropdownMenu.Root>
    <DropdownMenu.Trigger>
      {#snippet child({ props })}
        <button
          {...props}
          class="text-muted-foreground hover:text-foreground flex size-7 items-center justify-center rounded-md"
        >
          <HugeiconsIcon icon={MoreVerticalIcon} size={15} />
        </button>
      {/snippet}
    </DropdownMenu.Trigger>
    <DropdownMenu.Content align="end" class="w-44">
      <DropdownMenu.Item
        class="gap-2 text-xs"
        onclick={() => openEdit(row.original)}
      >
        <HugeiconsIcon icon={PencilEdit01Icon} size={13} /> Edit Student
      </DropdownMenu.Item>
      <DropdownMenu.Separator />
      <DropdownMenu.Item
        class="text-destructive gap-2 text-xs"
        onclick={() => openDeleteConfirm(row.original)}
      >
        <HugeiconsIcon icon={Delete01Icon} size={13} /> Delete Student
      </DropdownMenu.Item>
    </DropdownMenu.Content>
  </DropdownMenu.Root>
{/snippet}
