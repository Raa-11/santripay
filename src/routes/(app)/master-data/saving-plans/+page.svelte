<script lang="ts">
  import { slide } from "svelte/transition";
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
    Calendar03Icon,
    UserAdd02Icon,
    StudentIcon,
  } from "@hugeicons/core-free-icons";
  import * as Table from "$lib/components/ui/table/index.js";
  import * as DropdownMenu from "$lib/components/ui/dropdown-menu/index.js";
  import * as Field from "$lib/components/ui/field/index.js";
  import * as NativeSelect from "$lib/components/ui/native-select/index.js";
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

  // Tanstack Data Table Svelte 5
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

  // Logic
  import * as RangeCalendar from "$lib/components/ui/range-calendar/index.js";
  import * as Popover from "$lib/components/ui/popover/index.js";
  import { CalendarDate, type DateValue } from "@internationalized/date";
  import { superForm } from "sveltekit-superforms";
  import { toast } from "svelte-sonner";
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();

  // ── 1. FORM STATE & ACTIONS ──

  // Add Plan
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
        showAdd = false;
        addReset();
        addDateRange = { start: undefined, end: undefined };
        toast.success("Program tabungan berhasil dibuat");
      } else if (form.message) toast.error(form.message);
    },
    onError: ({ result }) =>
      toast.error(result.error.message || "Gagal membuat program"),
  });

  // Edit Plan
  let showEdit = $state(false);
  const {
    form: editForm,
    errors: editErrors,
    enhance: editEnhance,
    constraints: editConstraints,
  } = superForm<any>(() => data.editForm, {
    onUpdated: ({ form }) => {
      if (form.valid) {
        (showEdit = false), toast.success("Program tabungan berhasil diperbarui");
      } else if (form.message) toast.error(form.message);
    },
    onError: ({ result }) =>
      toast.error(result.error.message || "Gagal memperbarui program"),
  });

  // Deletion
  let showDeleteConfirm = $state(false);
  let itemToDelete = $state<any>(null);
  const { enhance: delEnhance } = superForm<any>(() => data.deleteForm, {
    onUpdated: ({ form }) => {
      if (form.valid) {
        (showDeleteConfirm = false),
          clearSelection(),
          toast.success(form.message || "Tindakan berhasil");
      } else if (form.message) toast.error(form.message);
    },
    onError: ({ result }) =>
      toast.error(result.error.message || "Gagal menghapus"),
  });

  // Bulk Status
  let showStatusConfirm = $state(false);
  let statusToSet = $state(false);
  const { enhance: statusEnhance, form: statusForm } = superForm<any>(
    () => data.bulkStatusForm,
    {
      onUpdated: ({ form }) => {
        if (form.valid) {
          showStatusConfirm = false;
          clearSelection();
          toast.success(form.message || "Status berhasil diperbarui");
        } else if (form.message) toast.error(form.message);
      },
      onError: ({ result }) =>
        toast.error(result.error.message || "Gagal memperbarui status"),
    },
  );

  // ── MANAGE STUDENTS MODAL ──
  let showManage = $state(false);
  let managePlan = $state<any>(null);
  let manageTab = $state<"add" | "enrolled">("add");
  let studentSearch = $state("");
  let selectedAddIds = $state(new Set<string>());
  let selectedRemoveIds = $state(new Set<string>());

  const { enhance: enrollEnhance, reset: enrollReset } = superForm<any>(
    () => data.enrollForm,
    {
      onUpdated: ({ form }) => {
        if (form.valid) {
          selectedAddIds = new Set();
          studentSearch = "";
          toast.success(form.message || "Siswa berhasil didaftarkan");
        } else if (form.message) toast.error(form.message);
      },
      onError: ({ result }) =>
        toast.error(result.error.message || "Gagal mendaftarkan siswa"),
    },
  );

  const { enhance: removeEnhance, reset: removeReset } = superForm<any>(
    () => data.removeForm,
    {
      onUpdated: ({ form }) => {
        if (form.valid) {
          selectedRemoveIds = new Set();
          studentSearch = "";
          toast.success(form.message || "Siswa berhasil dihapus dari program");
        } else if (form.message) toast.error(form.message);
      },
      onError: ({ result }) =>
        toast.error(result.error.message || "Gagal menghapus siswa"),
    },
  );

  const openManage = (plan: any, tab: "add" | "enrolled" = "add") => {
    managePlan = plan;
    manageTab = tab;
    selectedAddIds = new Set();
    selectedRemoveIds = new Set();
    studentSearch = "";
    showManage = true;
  };

  // enrolled students for the current plan (with details)
  const enrolledInPlan = $derived(
    (data.enrolledPairs ?? []).filter((p: any) => p.planId === managePlan?.id),
  );
  const enrolledIdSet = $derived(new Set(enrolledInPlan.map((p: any) => p.studentId)));

  // "Add" tab — non-enrolled active students, filtered by search
  const filteredAddStudents = $derived(
    (data.activeStudents ?? []).filter(
      (s: any) =>
        !enrolledIdSet.has(s.id) &&
        (s.name.toLowerCase().includes(studentSearch.toLowerCase()) ||
          s.nis.toLowerCase().includes(studentSearch.toLowerCase()) ||
          (s.class ?? "").toLowerCase().includes(studentSearch.toLowerCase())),
    ),
  );
  const allAddSelected = $derived(
    filteredAddStudents.length > 0 &&
      filteredAddStudents.every((s: any) => selectedAddIds.has(s.id)),
  );
  const someAddSelected = $derived(
    filteredAddStudents.some((s: any) => selectedAddIds.has(s.id)),
  );
  const toggleAdd = (id: string) => {
    const n = new Set(selectedAddIds);
    n.has(id) ? n.delete(id) : n.add(id);
    selectedAddIds = n;
  };
  const toggleAllAdd = () => {
    const n = new Set(selectedAddIds);
    if (allAddSelected) filteredAddStudents.forEach((s: any) => n.delete(s.id));
    else filteredAddStudents.forEach((s: any) => n.add(s.id));
    selectedAddIds = n;
  };

  // "Enrolled" tab — enrolled students, filtered by search
  const filteredEnrolled = $derived(
    enrolledInPlan.filter(
      (s: any) =>
        s.name.toLowerCase().includes(studentSearch.toLowerCase()) ||
        s.nis.toLowerCase().includes(studentSearch.toLowerCase()) ||
        (s.class ?? "").toLowerCase().includes(studentSearch.toLowerCase()),
    ),
  );
  // Only students with zero balance can be unenrolled
  const removable = $derived(filteredEnrolled.filter((s: any) => Number(s.currentAmount) === 0));
  const allRemoveSelected = $derived(
    removable.length > 0 && removable.every((s: any) => selectedRemoveIds.has(s.studentId)),
  );
  const someRemoveSelected = $derived(
    removable.some((s: any) => selectedRemoveIds.has(s.studentId)),
  );
  const toggleRemove = (id: string) => {
    const n = new Set(selectedRemoveIds);
    n.has(id) ? n.delete(id) : n.add(id);
    selectedRemoveIds = n;
  };
  const toggleAllRemove = () => {
    const n = new Set(selectedRemoveIds);
    if (allRemoveSelected) removable.forEach((s: any) => n.delete(s.studentId));
    else removable.forEach((s: any) => n.add(s.studentId));
    selectedRemoveIds = n;
  };

  // ── DATE RANGE STATE ──
  type DateRange = { start: DateValue | undefined; end: DateValue | undefined };
  let addDateRange = $state<DateRange>({ start: undefined, end: undefined });
  let editDateRange = $state<DateRange>({ start: undefined, end: undefined });
  let addCalendarOpen = $state(false);
  let editCalendarOpen = $state(false);

  const parseDate = (s: string | undefined) => {
    if (!s) return undefined;
    const [y, m, d] = s.split("-").map(Number);
    return new CalendarDate(y, m, d);
  };

  const rangLabel = (r: DateRange) =>
    r.start && r.end
      ? `${formatDate(r.start.toString())} → ${formatDate(r.end.toString())}`
      : r.start
        ? `${formatDate(r.start.toString())} → …`
        : null;

  $effect(() => {
    $addForm.startDate = addDateRange.start?.toString() ?? "";
    $addForm.endDate = addDateRange.end?.toString() ?? "";
  });

  $effect(() => {
    $editForm.startDate = editDateRange.start?.toString() ?? "";
    $editForm.endDate = editDateRange.end?.toString() ?? "";
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
      accessorKey: "code",
      header: ({ column }) =>
        renderSnippet(sortHeader, { column, label: "Kode" }),
    },
    {
      accessorKey: "name",
      header: ({ column }) =>
        renderSnippet(sortHeader, { column, label: "Nama" }),
      cell: ({ row }) => renderSnippet(nameCell, { name: row.original.name }),
    },
    {
      accessorKey: "studentCount",
      header: ({ column }) =>
        renderSnippet(sortHeader, { column, label: "Siswa" }),
      cell: ({ row }) =>
        renderSnippet(studentCountCell, { count: row.original.studentCount ?? 0 }),
    },
    {
      accessorKey: "savingType",
      header: ({ column }) =>
        renderSnippet(sortHeader, { column, label: "Jenis" }),
      cell: ({ row }) => row.original.savingType || "-",
    },
    {
      accessorKey: "isActive",
      header: ({ column }) =>
        renderSnippet(sortHeader, { column, label: "Status" }),
      cell: ({ row }) =>
        renderSnippet(statusCell, { isActive: row.original.isActive }),
    },
    {
      accessorKey: "createdAt",
      header: ({ column }) =>
        renderSnippet(sortHeader, { column, label: "Dibuat" }),
      cell: ({ row }) => formatDate(row.original.createdAt),
    },
    {
      id: "actions",
      enableHiding: false,
      cell: ({ row }) => renderSnippet(actionsCell, { row }),
    },
  ]);

  const table = createSvelteTable({
    get data() {
      return data.items;
    },
    get columns() {
      return columns;
    },
    state: {
      get pagination() {
        return pagination;
      },
      get sorting() {
        return sorting;
      },
      get columnVisibility() {
        return columnVisibility;
      },
      get rowSelection() {
        return rowSelection;
      },
      get columnFilters() {
        return columnFilters;
      },
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
      if (typeof updater === "function")
        columnVisibility = updater(columnVisibility);
      else columnVisibility = updater;
    },
    onRowSelectionChange: (updater) => {
      if (typeof updater === "function") rowSelection = updater(rowSelection);
      else rowSelection = updater;
    },
  });

  const openDeleteConfirm = (u?: any) => (
    (itemToDelete = u || null), (showDeleteConfirm = true)
  );

  const openEdit = (u: any) => {
    editForm.set({
      ...$editForm,
      id: u.id,
      code: u.code,
      name: u.name,
      savingType: u.savingType || "FLEXIBLE",
      defaultTargetAmount: u.defaultTargetAmount || "",
      defaultContributionType: u.defaultContributionType || "",
      defaultContributionValue: u.defaultContributionValue || "",
      startDate: u.startDate || "",
      endDate: u.endDate || "",
      isActive: u.isActive ?? true,
    });
    editDateRange = {
      start: parseDate(u.startDate),
      end: parseDate(u.endDate),
    };
    showEdit = true;
  };

  // ── 5. HELPERS ──
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
  title={itemToDelete ? "Hapus Program?" : `Hapus ${selectedCount} Program?`}
  description={itemToDelete
    ? `Apakah Anda yakin ingin menghapus ${itemToDelete.name}? Tindakan ini tidak dapat dibatalkan.`
    : `Apakah Anda yakin ingin menghapus ${selectedCount} program yang dipilih? Semua data terkait akan dihapus secara permanen.`}
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

<ModalConfirmation
  open={showStatusConfirm}
  onClose={() => (showStatusConfirm = false)}
  title={`${statusToSet ? "Aktifkan?" : "Nonaktifkan?"}`}
  description={`Apakah Anda yakin ingin menandai ${selectedCount} program yang dipilih sebagai ${statusToSet ? "Aktif" : "Tidak Aktif"}?`}
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
      onclick={() => (showStatusConfirm = false)}>Batal</Button
    >
    <Button
      type="submit"
      class="flex-1 h-10 text-xs font-bold shadow-lg text-white {statusToSet
        ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/20'
        : 'bg-stone-600 hover:bg-stone-700 shadow-stone-500/20'}"
      onclick={() => ($statusForm.isActive = statusToSet)}>Ya, Lanjutkan</Button
    >
  </form>
</ModalConfirmation>

<Modal
  open={showAdd}
  onClose={() => (showAdd = false)}
  title="Tambah Program Tabungan Baru"
  icon={UserAdd01Icon}
  description="Buat program tabungan baru."
  maxWidth="560px"
>
  <form
    id="add-plan-form"
    method="POST"
    action="?/create"
    use:addEnhance
    class="space-y-4"
  >
    <!-- Code + Name -->
    <div class="grid grid-cols-2 gap-3.5">
      <Field.Field class="space-y-1.5">
        <Field.Label
          class="text-xs font-bold uppercase tracking-wider text-muted-foreground"
          >Kode</Field.Label
        >
        <Field.Content>
          <Input
            name="code"
            bind:value={$addForm.code}
            {...$addConstraints.code}
            required
            class="h-10 bg-muted/50"
          />
        </Field.Content>
        {#if $addErrors.code}<Field.Error class="text-[10px]"
            >{$addErrors.code}</Field.Error
          >{/if}
      </Field.Field>
      <Field.Field class="space-y-1.5">
        <Field.Label
          class="text-xs font-bold uppercase tracking-wider text-muted-foreground"
          >Nama Program</Field.Label
        >
        <Field.Content>
          <Input
            name="name"
            bind:value={$addForm.name}
            {...$addConstraints.name}
            required
            class="h-10 bg-muted/50"
          />
        </Field.Content>
        {#if $addErrors.name}<Field.Error class="text-[10px]"
            >{$addErrors.name}</Field.Error
          >{/if}
      </Field.Field>
    </div>

    <!-- Type picker -->
    <Field.Field class="space-y-1.5">
      <Field.Label
        class="text-xs font-bold uppercase tracking-wider text-muted-foreground"
        >Jenis Tabungan</Field.Label
      >
      <input type="hidden" name="savingType" value={$addForm.savingType} />
      <div class="grid grid-cols-2 gap-2">
        {#each [{ val: "FLEXIBLE", label: "Fleksibel", desc: "Tanpa target atau jadwal tetap", icon: "⟲" }, { val: "GOAL", label: "Berbasis Target", desc: "Target tetap, tanggal & kontribusi", icon: "◎" }] as opt}
          <button
            type="button"
            onclick={() => ($addForm.savingType = opt.val)}
            class="flex flex-col gap-1 rounded-lg border px-3 py-2.5 text-left transition-all
              {$addForm.savingType === opt.val
              ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
              : 'border-border bg-muted/30 hover:bg-muted/60'}"
          >
            <div class="flex items-center justify-between">
              <span
                class="text-xs font-bold {$addForm.savingType === opt.val
                  ? 'text-primary'
                  : 'text-foreground'}">{opt.label}</span
              >
              <span
                class="text-base leading-none {$addForm.savingType === opt.val
                  ? 'text-primary'
                  : 'text-muted-foreground'} ">{opt.icon}</span
              >
            </div>
            <span class="text-[10px] text-muted-foreground">{opt.desc}</span>
          </button>
        {/each}
      </div>
    </Field.Field>

    <!-- GOAL-only fields -->
    {#if $addForm.savingType === "GOAL"}
      <div
        class="space-y-4 rounded-lg border border-primary/20 bg-primary/5 p-4"
        transition:slide={{ duration: 200 }}
      >
        <p class="text-[10px] font-bold uppercase tracking-widest text-primary">
          Konfigurasi Target
        </p>

        <!-- Target Amount -->
        <Field.Field class="space-y-1">
          <div class="flex items-baseline justify-between">
            <Field.Label
              class="text-xs font-bold uppercase tracking-wider text-muted-foreground"
              >Total Target</Field.Label
            >
            <span class="text-[10px] text-muted-foreground"
              >Total dana yang dikumpulkan hingga tanggal akhir</span
            >
          </div>
          <Field.Content>
            <div class="relative">
              <span
                class="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-medium text-muted-foreground"
                >Rp</span
              >
              <Input
                name="defaultTargetAmount"
                type="number"
                bind:value={$addForm.defaultTargetAmount}
                class="h-10 bg-background pl-9 font-semibold"
                placeholder="0"
              />
            </div>
          </Field.Content>
        </Field.Field>

        <!-- Dates -->
        <Field.Field class="space-y-1.5">
          <Field.Label
            class="text-xs font-bold uppercase tracking-wider text-muted-foreground"
            >Rentang Tanggal</Field.Label
          >
          <Field.Content>
            <input type="hidden" name="startDate" value={$addForm.startDate} />
            <input type="hidden" name="endDate" value={$addForm.endDate} />
            <Popover.Root bind:open={addCalendarOpen}>
              <Popover.Trigger>
                {#snippet child({ props })}
                  <button
                    {...props}
                    type="button"
                    class="flex h-10 w-full items-center gap-2.5 rounded-md border bg-background px-3 text-left transition-colors hover:bg-muted/50 {addDateRange.start ? 'text-foreground' : 'text-muted-foreground'}"
                  >
                    <HugeiconsIcon icon={Calendar03Icon} size={14} class="shrink-0 text-muted-foreground" />
                    <span class="flex-1 text-xs font-medium">
                      {rangLabel(addDateRange) ?? "Pilih rentang tanggal…"}
                    </span>
                    {#if addDateRange.start || addDateRange.end}
                      <span
                        role="button"
                        tabindex="0"
                        onclick={(e) => { e.stopPropagation(); addDateRange = { start: undefined, end: undefined }; }}
                        onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); addDateRange = { start: undefined, end: undefined }; } }}
                        class="text-muted-foreground hover:text-foreground"
                      >
                        <HugeiconsIcon icon={Cancel01Icon} size={12} />
                      </span>
                    {/if}
                  </button>
                {/snippet}
              </Popover.Trigger>
              <Popover.Portal>
                <Popover.Content
                  side="bottom"
                  align="start"
                  sideOffset={4}
                  avoidCollisions={false}
                  class="z-[9999] w-auto overflow-hidden rounded-xl border bg-card p-0 shadow-xl"
                >
                  <RangeCalendar.RangeCalendar
                    bind:value={addDateRange}
                    numberOfMonths={2}
                    class="[--cell-size:--spacing(8)] p-3"
                  />
                  <div class="flex items-center justify-between gap-2 border-t px-3 py-2.5 bg-card">
                    <Button
                      variant="ghost"
                      size="sm"
                      class="text-xs text-muted-foreground h-8"
                      onclick={() => {
                        addDateRange = { start: undefined, end: undefined };
                        addCalendarOpen = false;
                      }}
                    >
                      Hapus
                    </Button>
                    <Button
                      size="sm"
                      class="text-xs h-8"
                      onclick={() => { addCalendarOpen = false; }}
                    >
                      Terapkan
                    </Button>
                  </div>
                </Popover.Content>
              </Popover.Portal>
            </Popover.Root>
          </Field.Content>
        </Field.Field>

        <!-- Contribution -->
        <div
          class="space-y-3 rounded-md border border-primary/10 bg-background p-3"
        >
          <p
            class="text-[10px] font-bold uppercase tracking-widest text-muted-foreground"
          >
            Persyaratan Setoran
          </p>
          <div class="flex gap-2">
            <!-- Amount -->
            <div class="relative flex-1">
              <span
                class="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-medium text-muted-foreground"
                >Rp</span
              >
              <Input
                name="defaultContributionValue"
                type="number"
                bind:value={$addForm.defaultContributionValue}
                class="h-9 bg-muted/30 pl-9 text-sm font-semibold"
                placeholder="0"
              />
            </div>
            <!-- Period button group -->
            <input
              type="hidden"
              name="defaultContributionType"
              value={$addForm.defaultContributionType}
            />
            <div class="flex shrink-0">
              {#each [{ val: "DAILY", label: "Hari" }, { val: "WEEKLY", label: "Minggu" }, { val: "MONTHLY", label: "Bulan" }, { val: "YEARLY", label: "Tahun" }, { val: "CUSTOM", label: "Kustom" }] as p, i}
                <button
                  type="button"
                  onclick={() => ($addForm.defaultContributionType = p.val)}
                  class="h-9 px-3 text-xs font-semibold border-y border-r transition-colors
                    {i === 0 ? 'rounded-l-md border-l' : ''}
                    {i === 4 ? 'rounded-r-md' : ''}
                    {$addForm.defaultContributionType === p.val
                    ? 'bg-primary text-primary-foreground border-primary z-10'
                    : 'bg-card text-muted-foreground border-border hover:bg-muted'}"
                >
                  {p.label}
                </button>
              {/each}
            </div>
          </div>
          <!-- Custom period input -->
          {#if $addForm.defaultContributionType === "CUSTOM"}
            <div
              class="flex items-center gap-2"
              transition:slide={{ duration: 150 }}
            >
              <span class="text-xs text-muted-foreground shrink-0">Setiap</span>
              <Input
                name="customPeriodLabel"
                bind:value={$addForm.customPeriodLabel}
                placeholder="mis. 2 minggu, 10 hari…"
                class="h-8 flex-1 text-xs bg-muted/30"
              />
            </div>
          {/if}
          <!-- Live preview -->
          {#if $addForm.defaultContributionValue && $addForm.defaultContributionType}
            <p class="text-[11px] text-primary font-medium">
              ✓ Setiap siswa harus menyetor
              <span class="font-bold"
                >Rp {new Intl.NumberFormat("id-ID").format(
                  Number($addForm.defaultContributionValue),
                )}</span
              >
              {#if $addForm.defaultContributionType === "CUSTOM"}
                setiap <span class="font-bold"
                  >{$addForm.customPeriodLabel || "…"}</span
                >
              {:else}
                per {(
                  {
                    DAILY: "hari",
                    WEEKLY: "minggu",
                    MONTHLY: "bulan",
                    YEARLY: "tahun",
                  } as any
                )[$addForm.defaultContributionType] ?? "…"}
              {/if}
            </p>
          {:else}
            <p class="text-[11px] text-muted-foreground">
              Atur jumlah dan periode untuk melihat persyaratan
            </p>
          {/if}
        </div>
      </div>
    {/if}
  </form>
  {#snippet footer()}
    <Button
      variant="ghost"
      class="h-10 px-4 text-xs font-bold"
      onclick={() => (showAdd = false)}>Batal</Button
    >
    <Button
      type="submit"
      form="add-plan-form"
      class="h-10 px-4 text-xs font-bold shadow-lg shadow-primary/20"
      >Buat Program</Button
    >
  {/snippet}
</Modal>

<Modal
  open={showEdit}
  onClose={() => (showEdit = false)}
  title="Edit Program Tabungan"
  icon={PencilEdit01Icon}
  maxWidth="560px"
>
  <form
    id="edit-plan-form"
    method="POST"
    action="?/update"
    use:editEnhance
    class="space-y-4"
  >
    <input type="hidden" name="id" bind:value={$editForm.id} />

    <!-- Code + Name -->
    <div class="grid grid-cols-2 gap-3.5">
      <Field.Field class="space-y-1.5">
        <Field.Label
          class="text-xs font-bold uppercase tracking-wider text-muted-foreground"
          >Kode</Field.Label
        >
        <Field.Content>
          <Input
            name="code"
            bind:value={$editForm.code}
            {...editConstraints.code}
            required
            class="h-10 bg-muted/50"
          />
        </Field.Content>
        {#if $editErrors.code}<Field.Error class="text-[10px]"
            >{$editErrors.code}</Field.Error
          >{/if}
      </Field.Field>
      <Field.Field class="space-y-1.5">
        <Field.Label
          class="text-xs font-bold uppercase tracking-wider text-muted-foreground"
          >Nama Program</Field.Label
        >
        <Field.Content>
          <Input
            name="name"
            bind:value={$editForm.name}
            {...editConstraints.name}
            required
            class="h-10 bg-muted/50"
          />
        </Field.Content>
        {#if $editErrors.name}<Field.Error class="text-[10px]"
            >{$editErrors.name}</Field.Error
          >{/if}
      </Field.Field>
    </div>

    <!-- Type picker -->
    <Field.Field class="space-y-1.5">
      <Field.Label
        class="text-xs font-bold uppercase tracking-wider text-muted-foreground"
        >Jenis Tabungan</Field.Label
      >
      <input type="hidden" name="savingType" value={$editForm.savingType} />
      <div class="grid grid-cols-2 gap-2">
        {#each [{ val: "FLEXIBLE", label: "Fleksibel", desc: "Tanpa target atau jadwal tetap", icon: "⟲" }, { val: "GOAL", label: "Berbasis Target", desc: "Target tetap, tanggal & kontribusi", icon: "◎" }] as opt}
          <button
            type="button"
            onclick={() => ($editForm.savingType = opt.val)}
            class="flex flex-col gap-1 rounded-lg border px-3 py-2.5 text-left transition-all
              {$editForm.savingType === opt.val
              ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
              : 'border-border bg-muted/30 hover:bg-muted/60'}"
          >
            <div class="flex items-center justify-between">
              <span
                class="text-xs font-bold {$editForm.savingType === opt.val
                  ? 'text-primary'
                  : 'text-foreground'}">{opt.label}</span
              >
              <span
                class="text-base leading-none {$editForm.savingType === opt.val
                  ? 'text-primary'
                  : 'text-muted-foreground'}">{opt.icon}</span
              >
            </div>
            <span class="text-[10px] text-muted-foreground">{opt.desc}</span>
          </button>
        {/each}
      </div>
    </Field.Field>

    <!-- GOAL-only fields -->
    {#if $editForm.savingType === "GOAL"}
      <div
        class="space-y-4 rounded-lg border border-primary/20 bg-primary/5 p-4"
        transition:slide={{ duration: 200 }}
      >
        <p class="text-[10px] font-bold uppercase tracking-widest text-primary">
          Konfigurasi Target
        </p>

        <!-- Target Amount -->
        <Field.Field class="space-y-1">
          <div class="flex items-baseline justify-between">
            <Field.Label
              class="text-xs font-bold uppercase tracking-wider text-muted-foreground"
              >Total Target</Field.Label
            >
            <span class="text-[10px] text-muted-foreground"
              >Total dana yang dikumpulkan hingga tanggal akhir</span
            >
          </div>
          <Field.Content>
            <div class="relative">
              <span
                class="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-medium text-muted-foreground"
                >Rp</span
              >
              <Input
                name="defaultTargetAmount"
                type="number"
                bind:value={$editForm.defaultTargetAmount}
                class="h-10 bg-background pl-9 font-semibold"
                placeholder="0"
              />
            </div>
          </Field.Content>
        </Field.Field>

        <!-- Dates -->
        <Field.Field class="space-y-1.5">
          <Field.Label
            class="text-xs font-bold uppercase tracking-wider text-muted-foreground"
            >Rentang Tanggal</Field.Label
          >
          <Field.Content>
            <input type="hidden" name="startDate" value={$editForm.startDate} />
            <input type="hidden" name="endDate" value={$editForm.endDate} />
            <Popover.Root bind:open={editCalendarOpen}>
              <Popover.Trigger>
                {#snippet child({ props })}
                  <button
                    {...props}
                    type="button"
                    class="flex h-10 w-full items-center gap-2.5 rounded-md border bg-background px-3 text-left transition-colors hover:bg-muted/50 {editDateRange.start ? 'text-foreground' : 'text-muted-foreground'}"
                  >
                    <HugeiconsIcon icon={Calendar03Icon} size={14} class="shrink-0 text-muted-foreground" />
                    <span class="flex-1 text-xs font-medium">
                      {rangLabel(editDateRange) ?? "Pilih rentang tanggal…"}
                    </span>
                    {#if editDateRange.start || editDateRange.end}
                      <span
                        role="button"
                        tabindex="0"
                        onclick={(e) => { e.stopPropagation(); editDateRange = { start: undefined, end: undefined }; }}
                        onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); editDateRange = { start: undefined, end: undefined }; } }}
                        class="text-muted-foreground hover:text-foreground"
                      >
                        <HugeiconsIcon icon={Cancel01Icon} size={12} />
                      </span>
                    {/if}
                  </button>
                {/snippet}
              </Popover.Trigger>
              <Popover.Portal>
                <Popover.Content
                  side="bottom"
                  align="start"
                  sideOffset={4}
                  avoidCollisions={false}
                  class="z-[9999] w-auto overflow-hidden rounded-xl border bg-card p-0 shadow-xl"
                >
                  <RangeCalendar.RangeCalendar
                    bind:value={editDateRange}
                    numberOfMonths={2}
                    class="[--cell-size:--spacing(8)] p-3"
                  />
                  <div class="flex items-center justify-between gap-2 border-t px-3 py-2.5 bg-card">
                    <Button
                      variant="ghost"
                      size="sm"
                      class="text-xs text-muted-foreground h-8"
                      onclick={() => {
                        editDateRange = { start: undefined, end: undefined };
                        editCalendarOpen = false;
                      }}
                    >
                      Hapus
                    </Button>
                    <Button
                      size="sm"
                      class="text-xs h-8"
                      onclick={() => { editCalendarOpen = false; }}
                    >
                      Terapkan
                    </Button>
                  </div>
                </Popover.Content>
              </Popover.Portal>
            </Popover.Root>
          </Field.Content>
        </Field.Field>

        <!-- Contribution -->
        <div
          class="space-y-3 rounded-md border border-primary/10 bg-background p-3"
        >
          <p
            class="text-[10px] font-bold uppercase tracking-widest text-muted-foreground"
          >
            Persyaratan Setoran
          </p>
          <div class="flex gap-2">
            <div class="relative flex-1">
              <span
                class="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-medium text-muted-foreground"
                >Rp</span
              >
              <Input
                name="defaultContributionValue"
                type="number"
                bind:value={$editForm.defaultContributionValue}
                class="h-9 bg-muted/30 pl-9 text-sm font-semibold"
                placeholder="0"
              />
            </div>
            <input
              type="hidden"
              name="defaultContributionType"
              value={$editForm.defaultContributionType}
            />
            <div class="flex shrink-0">
              {#each [{ val: "DAILY", label: "Hari" }, { val: "WEEKLY", label: "Minggu" }, { val: "MONTHLY", label: "Bulan" }, { val: "YEARLY", label: "Tahun" }, { val: "CUSTOM", label: "Kustom" }] as p, i}
                <button
                  type="button"
                  onclick={() => ($editForm.defaultContributionType = p.val)}
                  class="h-9 px-3 text-xs font-semibold border-y border-r transition-colors
                    {i === 0 ? 'rounded-l-md border-l' : ''}
                    {i === 4 ? 'rounded-r-md' : ''}
                    {$editForm.defaultContributionType === p.val
                    ? 'bg-primary text-primary-foreground border-primary z-10'
                    : 'bg-card text-muted-foreground border-border hover:bg-muted'}"
                >
                  {p.label}
                </button>
              {/each}
            </div>
          </div>
          <!-- Custom period input -->
          {#if $editForm.defaultContributionType === "CUSTOM"}
            <div
              class="flex items-center gap-2"
              transition:slide={{ duration: 150 }}
            >
              <span class="text-xs text-muted-foreground shrink-0">Setiap</span>
              <Input
                name="customPeriodLabel"
                bind:value={$editForm.customPeriodLabel}
                placeholder="mis. 2 minggu, 10 hari…"
                class="h-8 flex-1 text-xs bg-muted/30"
              />
            </div>
          {/if}
          {#if $editForm.defaultContributionValue && $editForm.defaultContributionType}
            <p class="text-[11px] text-primary font-medium">
              ✓ Setiap siswa harus menyetor
              <span class="font-bold"
                >Rp {new Intl.NumberFormat("id-ID").format(
                  Number($editForm.defaultContributionValue),
                )}</span
              >
              {#if $editForm.defaultContributionType === "CUSTOM"}
                setiap <span class="font-bold"
                  >{$editForm.customPeriodLabel || "…"}</span
                >
              {:else}
                per {(
                  {
                    DAILY: "hari",
                    WEEKLY: "minggu",
                    MONTHLY: "bulan",
                    YEARLY: "tahun",
                  } as any
                )[$editForm.defaultContributionType] ?? "…"}
              {/if}
            </p>
          {:else}
            <p class="text-[11px] text-muted-foreground">
              Atur jumlah dan periode untuk melihat persyaratan
            </p>
          {/if}
        </div>
      </div>
    {/if}

    <!-- Active status -->
    <label
      class="flex items-center gap-2.5 cursor-pointer rounded-lg border bg-muted/30 px-3 py-2.5"
    >
      <Checkbox name="isActive" bind:checked={$editForm.isActive} />
      <div>
        <p class="text-xs font-semibold">Status Aktif</p>
        <p class="text-[10px] text-muted-foreground">
          Program tidak aktif tidak menerima setoran baru
        </p>
      </div>
    </label>
  </form>
  {#snippet footer()}
    <Button
      variant="ghost"
      class="h-10 px-4 text-xs font-bold"
      onclick={() => (showEdit = false)}>Batal</Button
    >
    <Button
      type="submit"
      form="edit-plan-form"
      class="h-10 px-4 text-xs font-bold shadow-sm">Simpan Perubahan</Button
    >
  {/snippet}
</Modal>

<!-- ── MANAGE STUDENTS MODAL ── -->
<Modal
  open={showManage}
  onClose={() => (showManage = false)}
  title="Kelola Siswa"
  icon={UserAdd02Icon}
  description={managePlan?.name ?? ""}
  maxWidth="520px"
>
  <!-- Tab bar -->
  <div class="-mx-6 -mt-2 mb-4 flex border-b">
    <button
      type="button"
      onclick={() => { manageTab = "add"; studentSearch = ""; selectedAddIds = new Set(); }}
      class="flex-1 py-2.5 text-xs font-bold transition-colors
        {manageTab === 'add'
        ? 'border-b-2 border-primary text-primary'
        : 'text-muted-foreground hover:text-foreground'}"
    >
      Tambah Siswa
    </button>
    <button
      type="button"
      onclick={() => { manageTab = "enrolled"; studentSearch = ""; selectedRemoveIds = new Set(); }}
      class="flex-1 py-2.5 text-xs font-bold transition-colors
        {manageTab === 'enrolled'
        ? 'border-b-2 border-primary text-primary'
        : 'text-muted-foreground hover:text-foreground'}"
    >
      Terdaftar
      <span
        class="ml-1.5 rounded-full px-1.5 py-0.5 text-[9px]
          {manageTab === 'enrolled' ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}"
      >
        {enrolledInPlan.length}
      </span>
    </button>
  </div>

  <!-- Search -->
  <div class="relative mb-3">
    <span class="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">
      <HugeiconsIcon icon={Search01Icon} size={13} />
    </span>
    <Input
      type="text"
      bind:value={studentSearch}
      placeholder={manageTab === "add" ? "Cari nama, NIS, atau kelas…" : "Cari yang terdaftar…"}
      class="h-9 pl-8 text-xs bg-muted/50"
    />
  </div>

  <!-- ── ADD TAB ── -->
  {#if manageTab === "add"}
    <form id="enroll-form" method="POST" action="?/enrollStudent" use:enrollEnhance>
      <input type="hidden" name="planId" value={managePlan?.id ?? ""} />
      {#each [...selectedAddIds] as id (id)}
        <input type="hidden" name="studentIds" value={id} />
      {/each}
    </form>

    <!-- Select-all row -->
    <div class="flex items-center gap-3 rounded-lg border bg-muted/30 px-3 py-2 mb-1">
      <Checkbox
        checked={allAddSelected}
        indeterminate={!allAddSelected && someAddSelected}
        onCheckedChange={toggleAllAdd}
        disabled={filteredAddStudents.length === 0}
      />
      <span class="text-[11px] font-semibold text-muted-foreground">
        Pilih semua yang terlihat
        <span class="text-foreground font-bold">({filteredAddStudents.length})</span>
      </span>
      {#if selectedAddIds.size > 0}
        <span class="ml-auto text-[10px] font-bold text-primary">{selectedAddIds.size} dipilih</span>
      {/if}
    </div>

    <div class="max-h-64 overflow-y-auto rounded-lg border divide-y">
      {#if filteredAddStudents.length === 0}
        <div class="flex flex-col items-center gap-1.5 py-10 text-muted-foreground">
          <HugeiconsIcon icon={StudentIcon} size={22} />
          <p class="text-xs">{studentSearch ? "Tidak ada data." : "Semua siswa sudah terdaftar"}</p>
        </div>
      {:else}
        {#each filteredAddStudents as s (s.id)}
          {@const sel = selectedAddIds.has(s.id)}
          <button
            type="button"
            form="enroll-form"
            onclick={() => toggleAdd(s.id)}
            class="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors
              {sel ? 'bg-primary/5' : 'hover:bg-muted/40 bg-card'}"
          >
            <Checkbox
              checked={sel}
              onCheckedChange={() => toggleAdd(s.id)}
              onclick={(e: any) => e.stopPropagation()}
            />
            <span
              class="flex size-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold
                {sel ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}"
            >
              {s.name.charAt(0).toUpperCase()}
            </span>
            <div class="flex min-w-0 flex-1 flex-col">
              <span class="truncate text-xs font-semibold">{s.name}</span>
              <span class="text-[10px] text-muted-foreground">{s.nis}{s.class ? ` · ${s.class}` : ""}</span>
            </div>
          </button>
        {/each}
      {/if}
    </div>

  <!-- ── ENROLLED TAB ── -->
  {:else}
    <form id="remove-form" method="POST" action="?/removeStudents" use:removeEnhance>
      <input type="hidden" name="planId" value={managePlan?.id ?? ""} />
      {#each [...selectedRemoveIds] as id (id)}
        <input type="hidden" name="studentIds" value={id} />
      {/each}
    </form>

    <!-- Select-all row -->
    <div class="flex items-center gap-3 rounded-lg border bg-muted/30 px-3 py-2 mb-1">
      <Checkbox
        checked={allRemoveSelected}
        indeterminate={!allRemoveSelected && someRemoveSelected}
        onCheckedChange={toggleAllRemove}
        disabled={filteredEnrolled.length === 0}
      />
      <span class="text-[11px] font-semibold text-muted-foreground">
        Pilih semua yang bisa dihapus
        <span class="text-foreground font-bold">({removable.length})</span>
        {#if removable.length < filteredEnrolled.length}
          <span class="text-amber-600">· {filteredEnrolled.length - removable.length} memiliki saldo</span>
        {/if}
      </span>
      {#if selectedRemoveIds.size > 0}
        <span class="ml-auto text-[10px] font-bold text-destructive">{selectedRemoveIds.size} dipilih</span>
      {/if}
    </div>

    <div class="max-h-64 overflow-y-auto rounded-lg border divide-y">
      {#if filteredEnrolled.length === 0}
        <div class="flex flex-col items-center gap-1.5 py-10 text-muted-foreground">
          <HugeiconsIcon icon={StudentIcon} size={22} />
          <p class="text-xs">{studentSearch ? "Tidak ada data." : "Belum ada siswa yang terdaftar"}</p>
        </div>
      {:else}
        {#each filteredEnrolled as s (s.studentId)}
          {@const sel = selectedRemoveIds.has(s.studentId)}
          {@const hasBalance = Number(s.currentAmount) > 0}
          <button
            type="button"
            form="remove-form"
            disabled={hasBalance}
            onclick={() => !hasBalance && toggleRemove(s.studentId)}
            class="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors
              {hasBalance ? 'opacity-60 cursor-not-allowed bg-card' : sel ? 'bg-destructive/5' : 'hover:bg-muted/40 bg-card'}"
          >
            <Checkbox
              checked={sel}
              disabled={hasBalance}
              onCheckedChange={() => !hasBalance && toggleRemove(s.studentId)}
              onclick={(e: any) => e.stopPropagation()}
            />
            <span
              class="flex size-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold
                {sel ? 'bg-destructive/10 text-destructive' : 'bg-muted text-muted-foreground'}"
            >
              {s.name.charAt(0).toUpperCase()}
            </span>
            <div class="flex min-w-0 flex-1 flex-col">
              <span class="truncate text-xs font-semibold">{s.name}</span>
              <span class="text-[10px] text-muted-foreground">{s.nis}{s.class ? ` · ${s.class}` : ""}</span>
            </div>
            {#if hasBalance}
              <span class="shrink-0 text-[10px] font-semibold text-amber-600">
                Rp {new Intl.NumberFormat('id-ID').format(Number(s.currentAmount))}
              </span>
            {:else if sel}
              <span class="shrink-0 text-[9px] font-bold text-destructive/70">Akan dihapus</span>
            {/if}
          </button>
        {/each}
      {/if}
    </div>
  {/if}

  {#snippet footer()}
    {#if manageTab === "add"}
      <span class="mr-auto text-[11px] text-muted-foreground">
        {selectedAddIds.size > 0 ? `${selectedAddIds.size} dipilih` : ""}
      </span>
      <Button variant="ghost" class="h-9 px-4 text-xs font-bold" onclick={() => (showManage = false)}>Batal</Button>
      <Button
        type="submit"
        form="enroll-form"
        disabled={selectedAddIds.size === 0}
        class="h-9 px-4 text-xs font-bold shadow-lg shadow-primary/20 disabled:opacity-40"
      >
        Daftarkan {selectedAddIds.size > 0 ? selectedAddIds.size : ""}
      </Button>
    {:else}
      <span class="mr-auto text-[11px] text-muted-foreground">
        {selectedRemoveIds.size > 0 ? `${selectedRemoveIds.size} dipilih` : ""}
      </span>
      <Button variant="ghost" class="h-9 px-4 text-xs font-bold" onclick={() => (showManage = false)}>Batal</Button>
      <Button
        type="submit"
        form="remove-form"
        disabled={selectedRemoveIds.size === 0}
        variant="destructive"
        class="h-9 px-4 text-xs font-bold disabled:opacity-40"
      >
        Hapus {selectedRemoveIds.size > 0 ? selectedRemoveIds.size : ""}
      </Button>
    {/if}
  {/snippet}
</Modal>

<!-- ── MAIN CONTENT ── -->

<div class="flex flex-1 flex-col gap-6">
  <!-- HEADER -->
  <div class="flex items-center justify-between">
    <div>
      <h1 class="text-2xl font-semibold tracking-tight">Program Tabungan</h1>
      <p class="text-muted-foreground mt-1 text-sm">
        Kelola program tabungan dan aturan simpanan siswa.
      </p>
    </div>
    <Button
      class="gap-2"
      onclick={() => {
        addReset();
        addDateRange = { start: undefined, end: undefined };
        $addForm.isActive = true;
        showAdd = true;
      }}
    >
      <HugeiconsIcon icon={UserAdd01Icon} size={16} /> Tambah Program
    </Button>
  </div>

  <!-- FILTERS -->
  <div class="flex items-center justify-between gap-2">
    <div class="relative w-64">
      <span
        class="text-muted-foreground absolute top-1/2 left-2.5 -translate-y-1/2"
      >
        <HugeiconsIcon icon={Search01Icon} size={14} />
      </span>
      <Input
        placeholder="Cari nama..."
        value={(table.getColumn("name")?.getFilterValue() as string) ?? ""}
        oninput={(e) =>
          table.getColumn("name")?.setFilterValue(e.currentTarget.value)}
        class="h-8 pl-8 text-xs bg-card"
      />
    </div>

    <DropdownMenu.Root>
      <DropdownMenu.Trigger>
        {#snippet child({ props })}
          <Button
            {...props}
            variant="outline"
            size="sm"
            class="gap-1.5 h-8 text-xs font-semibold"
          >
            <HugeiconsIcon icon={Table01Icon} size={13} />
            Tampilan
          </Button>
        {/snippet}
      </DropdownMenu.Trigger>
      <DropdownMenu.Content
        align="end"
        class="min-w-40 rounded-lg border p-1 shadow-md"
      >
        <p
          class="text-muted-foreground px-2 py-1 text-[11px] font-medium uppercase tracking-wide"
        >
          Tampilkan Kolom
        </p>
        {#each table
          .getAllColumns()
          .filter((col) => col.getCanHide()) as column (column.id)}
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
    <Table.Root
      data-sorting={sorting}
      data-page={pagination.pageIndex}
      data-filters={columnFilters}
    >
      <Table.Header>
        {#each table.getHeaderGroups() as headerGroup (headerGroup.id)}
          <Table.Row class="hover:bg-transparent border-b">
            {#each headerGroup.headers as header (header.id)}
              {@const wClass =
                header.id === "select"
                  ? "w-10"
                  : header.id === "actions"
                    ? "w-10 text-right"
                    : header.id === "code"
                      ? "w-28"
                      : header.id === "studentCount"
                        ? "w-24"
                        : header.id === "savingType"
                          ? "w-28"
                          : header.id === "isActive"
                            ? "w-24"
                            : header.id === "createdAt"
                              ? "w-32"
                              : "w-auto"}
              <Table.Head
                class="px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground {wClass}"
              >
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
              {@const wClass =
                cell.column.id === "select"
                  ? "w-10"
                  : cell.column.id === "actions"
                    ? "w-10 text-right"
                    : cell.column.id === "code"
                      ? "w-28"
                      : cell.column.id === "savingType"
                        ? "w-28"
                        : cell.column.id === "isActive"
                          ? "w-24"
                          : cell.column.id === "createdAt"
                            ? "w-32"
                            : "w-auto"}
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
            <Table.Cell
              colspan={columns.length}
              class="h-20 text-center text-xs"
            >
              Tidak ada data.
            </Table.Cell>
          </Table.Row>
        {/each}
      </Table.Body>
    </Table.Root>
  </div>

  <!-- PAGINATION -->
  <div
    class="flex items-center justify-between text-xs text-muted-foreground"
  >
    <span>
      {table.getFilteredSelectedRowModel().rows.length} dari {table.getFilteredRowModel()
        .rows.length} baris dipilih
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
        <span
          class="px-3 py-1 bg-muted/50 rounded-md font-bold text-foreground text-xs"
        >
          Halaman {table.getState().pagination.pageIndex + 1} dari {table.getPageCount() ||
            1}
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
    <span class="px-2 text-[11px] font-bold">{selectedCount} dipilih</span>
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
      <HugeiconsIcon icon={Tick02Icon} size={14} /> Aktifkan
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
      <HugeiconsIcon icon={Cancel01Icon} size={14} /> Nonaktifkan
    </ActionBarItem>
    <ActionBarItem
      variant="destructive"
      size="sm"
      class="h-8 gap-1.5 bg-red-50 px-3 text-[11px] font-bold text-red-600 hover:bg-red-100 border-none ml-1.5"
      onSelect={() => openDeleteConfirm()}
    >
      <HugeiconsIcon icon={Delete02Icon} size={14} /> Hapus Terpilih
    </ActionBarItem>
  </ActionBarGroup>
</ActionBar>

{#snippet selectHeader({ table }: { table: any })}
  <Checkbox
    checked={table.getIsAllPageRowsSelected()}
    indeterminate={table.getIsSomePageRowsSelected() &&
      !table.getIsAllPageRowsSelected()}
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
    class="-ml-3 h-7 text-[11px] font-bold uppercase tracking-wider hover:bg-transparent {column.getIsSorted()
      ? 'text-foreground'
      : 'text-muted-foreground hover:text-foreground'}"
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

{#snippet studentCountCell({ count }: { count: number })}
  <span
    class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold {count > 0
      ? 'bg-blue-50 text-blue-700'
      : 'bg-muted text-muted-foreground'}"
  >
    <HugeiconsIcon icon={StudentIcon} size={10} />
    {count}
  </span>
{/snippet}

{#snippet nameCell({ name }: { name: string })}
  <div class="flex items-center gap-2">
    <span class="text-xs font-medium">{name}</span>
  </div>
{/snippet}

{#snippet statusCell({ isActive }: { isActive: boolean })}
  <span
    class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold {isActive
      ? 'bg-emerald-50 text-emerald-700'
      : 'bg-stone-100 text-stone-600'}"
  >
    <span
      class="size-1.5 rounded-full {isActive
        ? 'bg-emerald-500'
        : 'bg-stone-400'}"
    ></span>
    {isActive ? "Aktif" : "Tidak Aktif"}
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
    <DropdownMenu.Content align="end" class="w-48">
      <DropdownMenu.Item
        class="gap-2 text-xs"
        onclick={() => openManage(row.original)}
      >
        <HugeiconsIcon icon={UserAdd02Icon} size={13} /> Kelola Siswa
      </DropdownMenu.Item>
      <DropdownMenu.Separator />
      <DropdownMenu.Item
        class="gap-2 text-xs"
        onclick={() => openEdit(row.original)}
      >
        <HugeiconsIcon icon={PencilEdit01Icon} size={13} /> Edit Program
      </DropdownMenu.Item>
      <DropdownMenu.Separator />
      <DropdownMenu.Item
        class="gap-2 text-xs {Number(row.original.totalBalance) > 0 ? 'opacity-50 cursor-not-allowed' : 'text-destructive'}"
        disabled={Number(row.original.totalBalance) > 0}
        onclick={() => Number(row.original.totalBalance) === 0 && openDeleteConfirm(row.original)}
      >
        <HugeiconsIcon icon={Delete01Icon} size={13} /> Hapus Program
        {#if Number(row.original.totalBalance) > 0}
          <span class="ml-auto text-[10px] text-muted-foreground">memiliki saldo</span>
        {/if}
      </DropdownMenu.Item>
    </DropdownMenu.Content>
  </DropdownMenu.Root>
{/snippet}
