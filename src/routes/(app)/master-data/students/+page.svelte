<!--
  ╔══════════════════════════════════════════════════════════╗
  ║  HALAMAN   : Manajemen Data Siswa                        ║
  ║  RUTE      : /master-data/students                       ║
  ╚══════════════════════════════════════════════════════════╝

  TUJUAN
    Halaman ini digunakan untuk mengelola data siswa secara
    lengkap. Admin dapat melihat daftar seluruh siswa (aktif
    maupun tidak aktif), menambah siswa baru, mengedit data
    yang sudah ada, menghapus siswa, serta mengubah status
    aktif/tidak aktif secara massal (bulk action).

  DATA YANG DIMUAT (dari +page.server.ts)
    - items          : array semua siswa dari tabel students
    - addForm        : form kosong untuk menambah siswa baru
    - editForm       : form yang diisi data siswa yang diedit
    - deleteForm     : form hapus (berisi array id yang dihapus)
    - bulkStatusForm : form ubah status massal (aktif/tidak aktif)

  FITUR UTAMA
    - Tabel data siswa dengan sort per kolom, filter nama,
      paginasi, dan toggle visibilitas kolom
    - Modal tambah siswa baru (NIS, nama, kelas, jenis kelamin,
      alamat)
    - Modal edit siswa (semua field + toggle status aktif)
    - Konfirmasi hapus — bisa hapus 1 siswa atau banyak sekaligus
    - Action bar massal: muncul di bagian bawah layar saat ada
      baris yang dipilih, berisi tombol Aktifkan, Nonaktifkan,
      dan Hapus Terpilih
    - Toggle kolom: dropdown "Tampilan" untuk show/hide kolom

  CATATAN TEKNIS
    Tabel menggunakan @tanstack/table-core (bukan komponen
    shadcn Table biasa). Semua logika sort, filter, paginasi,
    dan seleksi baris dikelola oleh instance `table` yang
    dibuat via createSvelteTable(). State tabel disimpan
    sebagai Svelte 5 $state sehingga reaktif secara otomatis.
    Form dikelola dengan sveltekit-superforms; setiap aksi
    (create, update, delete, bulkStatus) punya form-nya sendiri
    agar tidak terjadi tabrakan state saat submit.
-->
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

  // Mengambil data awal dari load server (+page.server.ts) ke dalam komponen
  let { data }: { data: PageData } = $props();

  // ── 1. STATE FORM & AKSI SUBMIT (SUPERFORMS) ──

  // Form Tambah Siswa Baru
  let showAdd = $state(false); // State reaktif buat buka/tutup popup (modal) tambah siswa
  const {
    form: addForm,
    errors: addErrors,
    enhance: addEnhance,
    reset: addReset,
    constraints: addConstraints,
  } = superForm<any>(() => data.addForm, {
    // Callback ketika submit selesai diproses server
    onUpdated: ({ form }) => {
      if (form.valid) {
        // Kalau berhasil, tutup modal, kosongkan isian form, dan munculkan notifikasi sukses
        (showAdd = false), addReset(), toast.success("Siswa berhasil dibuat");
      } else if (form.message) toast.error(form.message);
    },
    // Callback kalau terjadi error server/koneksi
    onError: ({ result }) =>
      toast.error(result.error.message || "Gagal membuat siswa"),
  });

  // Form Edit Data Siswa
  let showEdit = $state(false); // State reaktif buat buka/tutup popup edit siswa
  const {
    form: editForm,
    errors: editErrors,
    enhance: editEnhance,
    constraints: editConstraints,
  } = superForm<any>(() => data.editForm, {
    onUpdated: ({ form }) => {
      if (form.valid) {
        // Kalau berhasil update, tutup modal dan tampilkan notifikasi
        (showEdit = false), toast.success("Siswa berhasil diperbarui");
      } else if (form.message) toast.error(form.message);
    },
    onError: ({ result }) =>
      toast.error(result.error.message || "Gagal memperbarui"),
  });

  // Form Hapus Siswa (Bisa hapus satu atau banyak sekaligus)
  let showDeleteConfirm = $state(false); // State reaktif konfirmasi hapus
  let itemToDelete = $state<any>(null); // Menyimpan info data siswa mana yang sedang dipilih buat dihapus
  const { enhance: delEnhance } = superForm<any>(() => data.deleteForm, {
    onUpdated: ({ form }) => {
      if (form.valid) {
        // Kalau sukses dihapus, tutup konfirmasi, hapus checklist centang tabel, dan tampilkan notifikasi
        (showDeleteConfirm = false),
          clearSelection(),
          toast.success(form.message || "Siswa berhasil dihapus");
      } else if (form.message) toast.error(form.message);
    },
    onError: ({ result }) =>
      toast.error(result.error.message || "Gagal menghapus"),
  });

  // Form Ubah Status Aktif/Nonaktif Massal
  let showStatusConfirm = $state(false); // State konfirmasi ubah status massal
  let statusToSet = $state(false); // Nilai status target yang mau diset (aktif atau nonaktif)
  const { enhance: statusEnhance, form: statusForm } = superForm<any>(() => data.bulkStatusForm, {
    onUpdated: ({ form }) => {
      if (form.valid) {
        // Jika sukses update massal, tutup dialog konfirmasi, bersihkan seleksi centang, dan tampilkan toast sukses
        showStatusConfirm = false;
        clearSelection();
        toast.success(form.message || "Status berhasil diperbarui");
      } else if (form.message) toast.error(form.message);
    },
    onError: ({ result }) => toast.error(result.error.message || "Gagal memperbarui status"),
  });

  // ── 2. STATE TABEL TANSTACK ──
  // State untuk melacak halaman tabel (index halaman & jumlah baris per halaman)
  let pagination = $state<PaginationState>({ pageIndex: 0, pageSize: 10 });
  // State untuk melacak kolom mana yang diurutkan (sorting)
  let sorting = $state<SortingState>([]);
  // State untuk input filter pencarian nama siswa
  let columnFilters = $state<ColumnFiltersState>([]);
  // State untuk mencatat baris mana saja yang sedang diceklis (row selection)
  let rowSelection = $state<RowSelectionState>({});
  // State untuk show/hide kolom tabel (kolom apa saja yang disembunyikan)
  let columnVisibility = $state<VisibilityState>({});

  // ── 3. STATE KONDISIONAL (DERIVED) ──
  // Mengambil kumpulan ID baris siswa yang sedang diceklis secara otomatis
  const selectedIds = $derived(Object.keys(rowSelection));
  // Jumlah baris siswa yang dicentang
  const selectedCount = $derived(selectedIds.length);

  // Fungsi untuk mengosongkan semua tanda centang di tabel
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
      header: ({ column }) => renderSnippet(sortHeader, { column, label: "Nama" }),
      cell: ({ row }) => renderSnippet(nameCell, { name: row.original.name }),
    },
    {
      accessorKey: "class",
      header: ({ column }) => renderSnippet(sortHeader, { column, label: "Kelas" }),
      cell: ({ row }) => row.original.class || "-",
    },
    {
      accessorKey: "gender",
      header: ({ column }) => renderSnippet(sortHeader, { column, label: "Jenis Kelamin" }),
      cell: ({ row }) => row.original.gender || "-",
    },
    {
      accessorKey: "isActive",
      header: ({ column }) => renderSnippet(sortHeader, { column, label: "Status" }),
      cell: ({ row }) => renderSnippet(statusCell, { isActive: row.original.isActive }),
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
    ? "Hapus Siswa?"
    : `Hapus ${selectedCount} Siswa?`}
  description={itemToDelete
    ? `Apakah Anda yakin ingin menghapus ${itemToDelete.name}? Tindakan ini tidak dapat dibatalkan.`
    : `Apakah Anda yakin ingin menghapus ${selectedCount} siswa yang dipilih? Semua data terkait akan dihapus secara permanen.`}
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
  title={`${statusToSet ? 'Aktifkan' : 'Nonaktifkan'}?`}
  description={`Apakah Anda yakin ingin menandai ${selectedCount} siswa yang dipilih sebagai ${statusToSet ? 'Aktif' : 'Tidak Aktif'}?`}
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
      class="flex-1 h-10 text-xs font-bold shadow-lg text-white {statusToSet ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/20' : 'bg-stone-600 hover:bg-stone-700 shadow-stone-500/20'}"
      onclick={() => (($statusForm as any).isActive = statusToSet)}
      >Ya, Lanjutkan</Button
    >
  </form>
</ModalConfirmation>

<Modal
  open={showAdd}
  onClose={() => (showAdd = false)}
  title="Tambah Siswa Baru"
  icon={UserAdd01Icon}
  description="Daftarkan siswa baru."
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
        >Nama Lengkap <span class="text-destructive">*</span></Field.Label
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
          >Kelas</Field.Label
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
          >Jenis Kelamin</Field.Label
        >
        <Field.Content
          ><NativeSelect.Root
            name="gender"
            bind:value={$addForm.gender}
            {...$addConstraints.gender}
          >
            <NativeSelect.Option value="">Pilih Jenis Kelamin</NativeSelect.Option>
            <NativeSelect.Option value="Male">Laki-laki</NativeSelect.Option>
            <NativeSelect.Option value="Female">Perempuan</NativeSelect.Option>
          </NativeSelect.Root></Field.Content
        >
      </Field.Field>
    </div>



    <Field.Field class="space-y-1.5">
      <Field.Label
        class="text-xs font-bold uppercase tracking-wider text-muted-foreground"
        >Alamat</Field.Label
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
      onclick={() => (showAdd = false)}>Batal</Button
    >
    <Button
      type="submit"
      form="add-student-form"
      class="h-10 px-4 text-xs font-bold shadow-lg shadow-primary/20"
      >Buat Siswa</Button
    >
  {/snippet}
</Modal>

<Modal
  open={showEdit}
  onClose={() => (showEdit = false)}
  title="Edit Siswa"
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
        >Nama Lengkap <span class="text-destructive">*</span></Field.Label
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
          >Kelas</Field.Label
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
          >Jenis Kelamin</Field.Label
        >
        <Field.Content
          ><NativeSelect.Root
            name="gender"
            bind:value={$editForm.gender}
            {...editConstraints.gender}
          >
            <NativeSelect.Option value="">Pilih Jenis Kelamin</NativeSelect.Option>
            <NativeSelect.Option value="Male">Laki-laki</NativeSelect.Option>
            <NativeSelect.Option value="Female">Perempuan</NativeSelect.Option>
          </NativeSelect.Root></Field.Content
        >
      </Field.Field>
    </div>

    <div class="flex items-center pt-2 pb-1">
      <label class="flex items-center gap-2 cursor-pointer text-sm font-medium">
        <Checkbox name="isActive" bind:checked={$editForm.isActive} />
        Status Aktif
      </label>
    </div>

    <Field.Field class="space-y-1.5">
      <Field.Label
        class="text-xs font-bold uppercase tracking-wider text-muted-foreground"
        >Alamat</Field.Label
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
      onclick={() => (showEdit = false)}>Batal</Button
    >
    <Button
      type="submit"
      form="edit-student-form"
      class="h-10 px-4 text-xs font-bold shadow-sm">Simpan Perubahan</Button
    >
  {/snippet}
</Modal>

<!-- ── MAIN CONTENT ── -->

<div class="flex flex-1 flex-col gap-6">
  <!-- HEADER -->
  <div class="flex items-center justify-between">
    <div>
      <h1 class="text-2xl font-semibold tracking-tight">Data Siswa</h1>
      <p class="text-muted-foreground mt-1 text-sm">
        Kelola data siswa dan profil mereka.
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
      <HugeiconsIcon icon={UserAdd01Icon} size={16} /> Tambah Siswa
    </Button>
  </div>

  <!-- FILTERS -->
  <div class="flex items-center justify-between gap-2">
    <div class="relative w-64">
      <span class="text-muted-foreground absolute top-1/2 left-2.5 -translate-y-1/2">
        <HugeiconsIcon icon={Search01Icon} size={14} />
      </span>
      <Input
        placeholder="Cari nama..."
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
            Tampilan
          </Button>
        {/snippet}
      </DropdownMenu.Trigger>
      <DropdownMenu.Content align="end" class="min-w-40 rounded-lg border p-1 shadow-md">
        <p class="text-muted-foreground px-2 py-1 text-[11px] font-medium uppercase tracking-wide">Tampilkan Kolom</p>
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
          Halaman {table.getState().pagination.pageIndex + 1} dari {table.getPageCount() || 1}
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
    {isActive ? 'Aktif' : 'Tidak Aktif'}
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
        <HugeiconsIcon icon={PencilEdit01Icon} size={13} /> Edit Siswa
      </DropdownMenu.Item>
      <DropdownMenu.Separator />
      <DropdownMenu.Item
        class="text-destructive gap-2 text-xs"
        onclick={() => openDeleteConfirm(row.original)}
      >
        <HugeiconsIcon icon={Delete01Icon} size={13} /> Hapus Siswa
      </DropdownMenu.Item>
    </DropdownMenu.Content>
  </DropdownMenu.Root>
{/snippet}
