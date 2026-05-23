<script lang="ts">
  import type { PageData } from "./$types";
  import { superForm } from "sveltekit-superforms";
  import { Button } from "$lib/components/ui/button/index.js";
  import { Input } from "$lib/components/ui/input/index.js";
  import * as Table from "$lib/components/ui/table/index.js";
  import ModalConfirmation from "$lib/components/ui/modal-confirmation.svelte";
  import { HugeiconsIcon } from "@hugeicons/svelte";
  import { ArrowTurnBackwardIcon } from "@hugeicons/core-free-icons";
  import {
    createSvelteTable,
    FlexRender,
    renderSnippet,
  } from "$lib/components/ui/data-table/index.js";
  import {
    type ColumnDef,
    type ColumnFiltersState,
    type PaginationState,
    type SortingState,
    type VisibilityState,
    getCoreRowModel,
    getFilteredRowModel,
    getPaginationRowModel,
    getSortedRowModel,
  } from "@tanstack/table-core";
  import ArrowUpDown from "@lucide/svelte/icons/arrow-up-down";
  import ArrowUp from "@lucide/svelte/icons/arrow-up";
  import ArrowDown from "@lucide/svelte/icons/arrow-down";
  import { toast } from "svelte-sonner";
  import * as Popover from "$lib/components/ui/popover/index.js";
  import * as RangeCalendar from "$lib/components/ui/range-calendar/index.js";
  import * as DropdownMenu from "$lib/components/ui/dropdown-menu/index.js";
  import {
    type DateValue,
    today,
    getLocalTimeZone,
  } from "@internationalized/date";

  // Ambil data transaksi dan form dari server
  let { data }: { data: PageData } = $props();

  // Tipe jenis transaksi: hanya DEPOSIT atau WITHDRAW
  type TxType = "DEPOSIT" | "WITHDRAW";
  // Tipe struktur data satu baris transaksi di tabel
  interface TxRow {
    entryId: string;           // ID transaksi
    referenceNo: string;       // Nomor referensi
    createdAt: string;         // Waktu transaksi
    type: TxType;              // Jenis: DEPOSIT / WITHDRAW
    amount: number;            // Nominal uang
    description: string | null; // Keterangan
    studentName: string;       // Nama santri
    studentNis: string;        // NIS santri
    studentClass: string | null; // Kelas santri
    planName: string;          // Nama program tabungan
    planCode: string;          // Kode program tabungan
  }

  // Format angka ke Rupiah (Contoh: Rp 75.000)
  const fmt = (n: number) =>
    "Rp " + new Intl.NumberFormat("id-ID").format(Math.round(n));


  // Format waktu: hari ini → jam saja, hari lain → tanggal + jam
  function txDateTime(iso: string): string {
    const d = new Date(iso);
    const todayDate = new Date();
    if (d.toDateString() === todayDate.toDateString()) {
      return d.toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
      });
    }
    return (
      d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" }) +
      " · " +
      d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
    );
  }

  // Semua data transaksi dari server (dicast ke tipe TxRow[])
  const allTx = $derived(data.transactions as TxRow[]);

  // Tipe rentang tanggal filter (awal - akhir)
  type DateRange = { start: DateValue | undefined; end: DateValue | undefined };
  const todayDv = today(getLocalTimeZone()); // Tanggal hari ini dalam format kalender
  let filterRange = $state<DateRange>({ start: todayDv, end: todayDv }); // Default filter: hari ini
  let calendarOpen = $state(false); // State buka/tutup popup kalender filter tanggal

  function fmtDv(dv: DateValue): string {
    return new Date(dv.year, dv.month - 1, dv.day).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }

  const dateRangeLabel = $derived(
    filterRange.start && filterRange.end
      ? filterRange.start.toString() === filterRange.end.toString()
        ? fmtDv(filterRange.start)
        : `${fmtDv(filterRange.start)} – ${fmtDv(filterRange.end)}`
      : filterRange.start
        ? `Dari ${fmtDv(filterRange.start)}`
        : "Semua tanggal",
  );

  const rangeStart = $derived(
    filterRange.start
      ? new Date(
          filterRange.start.year,
          filterRange.start.month - 1,
          filterRange.start.day,
        )
      : null,
  );
  const rangeEnd = $derived(
    filterRange.end
      ? new Date(
          filterRange.end.year,
          filterRange.end.month - 1,
          filterRange.end.day + 1,
        )
      : null,
  );

  // State pagination, sorting, dan filter kolom tabel
  let pagination = $state<PaginationState>({ pageIndex: 0, pageSize: 10 });
  let sorting = $state<SortingState>([{ id: "createdAt", desc: true }]); // Default urutan: terbaru dulu
  let columnFilters = $state<ColumnFiltersState>([]);
  let columnVisibility = $state<VisibilityState>({});
  let globalFilter = $state("");                                           // Isi kotak pencarian teks bebas
  let typeFilter = $state<"all" | "DEPOSIT" | "WITHDRAW">("all");          // Filter jenis transaksi

  // Pilihan jenis transaksi untuk dropdown filter
  const typeOptions: {
    key: "all" | "DEPOSIT" | "WITHDRAW";
    label: string;
    dot: string;
  }[] = [
    { key: "all", label: "Semua Jenis", dot: "bg-muted-foreground" },
    { key: "DEPOSIT", label: "Setoran", dot: "bg-primary" },
    { key: "WITHDRAW", label: "Penarikan", dot: "bg-destructive" },
  ];

  const activeTypeLabel = $derived(
    typeFilter === "all"
      ? "Jenis"
      : (typeOptions.find((o) => o.key === typeFilter)?.label ?? "Jenis"),
  );

  // Filter transaksi berdasarkan rentang tanggal, jenis, dan teks pencarian secara reaktif
  const filteredData = $derived(
    allTx.filter((tx) => {
      const d = new Date(tx.createdAt);
      if (rangeStart && d < rangeStart) return false;           // Filter tanggal awal
      if (rangeEnd && d >= rangeEnd) return false;              // Filter tanggal akhir
      if (typeFilter !== "all" && tx.type !== typeFilter) return false; // Filter jenis transaksi
      if (!globalFilter) return true;                           // Tanpa teks pencarian = tampilkan semua
      const q = globalFilter.toLowerCase();
      return (
        tx.referenceNo.toLowerCase().includes(q) ||
        tx.studentName.toLowerCase().includes(q) ||
        tx.studentNis.toLowerCase().includes(q) ||
        tx.planCode.toLowerCase().includes(q)
      );
    }),
  );



  // State untuk menyimpan transaksi yang sedang dikonfirmasi untuk dibatalkan
  let confirmTx = $state<TxRow | null>(null);

  // Buka dialog konfirmasi pembatalan dan reset form alasan
  function openConfirm(tx: TxRow) {
    confirmTx = tx;
    reversalReset();
  }

  // Tutup dialog konfirmasi dan bersihkan state
  function closeConfirm() {
    confirmTx = null;
    reversalReset();
  }

  // Form pembatalan transaksi menggunakan superforms
  const {
    form: reversalForm,          // Isi field form (reason, entryId)
    enhance: reversalEnhance,    // Progressive enhancement agar form pakai fetch bukan full reload
    reset: reversalReset,        // Fungsi reset form ke kondisi awal
    submitting: reversalSubmitting, // State loading saat form sedang diproses server
    message: reversalMessage,    // Pesan balasan dari server (sukses/error)
  } = superForm<any>(() => data.reversalForm!, {
    onUpdated: ({ form }) => {
      if (form.valid) {
        closeConfirm(); // Tutup dialog kalau pembatalan berhasil
        toast.success(form.message || "Transaksi berhasil dibatalkan");
      } else if (form.message) {
        toast.error(form.message); // Tampilkan pesan error dari server
      }
    },
    onError: ({ result }) =>
      toast.error(result.error.message || "Pembatalan gagal"),
  });

  // Definisi kolom tabel transaksi yang bisa dibatalkan
  const columns: ColumnDef<TxRow>[] = [
    {
      accessorKey: "referenceNo",
      header: ({ column }) =>
        renderSnippet(sortHeader, { column, label: "No. Ref" }),
      cell: ({ row }) =>
        renderSnippet(refCell, { id: row.original.referenceNo }),
    },
    {
      accessorKey: "createdAt",
      header: ({ column }) =>
        renderSnippet(sortHeader, { column, label: "Waktu" }),
      cell: ({ row }) =>
        renderSnippet(timeCell, { iso: row.original.createdAt }),
    },
    {
      accessorKey: "type",
      header: ({ column }) =>
        renderSnippet(sortHeader, { column, label: "Jenis" }),
      cell: ({ row }) => renderSnippet(typeCell, { type: row.original.type }),
    },
    {
      accessorKey: "studentName",
      header: ({ column }) =>
        renderSnippet(sortHeader, { column, label: "Siswa" }),
      cell: ({ row }) => renderSnippet(studentCell, { tx: row.original }),
    },
    {
      accessorKey: "planName",
      header: ({ column }) =>
        renderSnippet(sortHeader, { column, label: "Program" }),
      cell: ({ row }) => renderSnippet(programCell, { tx: row.original }),
    },
    {
      accessorKey: "amount",
      header: ({ column }) =>
        renderSnippet(sortHeader, { column, label: "Jumlah" }),
      cell: ({ row }) => renderSnippet(amountCell, { tx: row.original }),
    },
    {
      id: "action",
      enableSorting: false,
      cell: ({ row }) => renderSnippet(actionCell, { tx: row.original }),
    },
  ];

  const table = createSvelteTable({
    get data() {
      return filteredData;
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
      get columnFilters() {
        return columnFilters;
      },
    },
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onPaginationChange: (u) => {
      if (typeof u === "function") pagination = u(pagination);
      else pagination = u;
    },
    onSortingChange: (u) => {
      if (typeof u === "function") sorting = u(sorting);
      else sorting = u;
    },
    onColumnFiltersChange: (u) => {
      if (typeof u === "function") columnFilters = u(columnFilters);
      else columnFilters = u;
    },
  });
</script>

<svelte:head>
  <title>Pembatalan</title>
</svelte:head>

<div class="flex flex-col gap-6 flex-1">
  <!-- Header -->
  <div class="flex items-start justify-between">
    <div>
      <h1 class="text-2xl font-semibold tracking-tight">Pembatalan</h1>
      <p class="text-sm text-muted-foreground mt-1">
        Batalkan setoran atau penarikan. Pembatalan langsung membuat
        <span class="text-primary font-medium">entri lawan</span> di jurnal.
      </p>
    </div>
    <Button
      variant="outline"
      size="sm"
      class="gap-2 text-xs"
      href="/transactions/transaction-history"
    >
      <svg
        class="size-3.5"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path
          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"
        /><rect x="9" y="3" width="6" height="4" rx="1" /><path
          d="M9 12h6M9 16h4"
        />
      </svg>
      Lihat Riwayat
    </Button>
  </div>



  <!-- Filters -->
  <div class="flex items-center justify-between gap-3 flex-wrap">
    <div class="flex items-center gap-2 flex-wrap">
      <div class="relative">
        <svg
          class="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          ><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg
        >
        <Input
          bind:value={globalFilter}
          oninput={() => {
            pagination = { ...pagination, pageIndex: 0 };
          }}
          placeholder="Cari no. ref, siswa, program..."
          class="h-8 pl-8 text-xs w-60 bg-card"
        />
      </div>

      <!-- Date range calendar -->
      <Popover.Root bind:open={calendarOpen}>
        <Popover.Trigger>
          {#snippet child({ props })}
            <button
              {...props}
              class="inline-flex h-8 items-center gap-2 rounded-md border border-border bg-card px-3 text-xs font-semibold text-foreground transition-colors hover:bg-muted {filterRange.start ||
              filterRange.end
                ? 'border-primary/50 text-primary'
                : ''}"
            >
              <svg
                class="size-3.5 text-muted-foreground shrink-0"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                ><rect x="3" y="4" width="18" height="18" rx="2" /><line
                  x1="16"
                  y1="2"
                  x2="16"
                  y2="6"
                /><line x1="8" y1="2" x2="8" y2="6" /><line
                  x1="3"
                  y1="10"
                  x2="21"
                  y2="10"
                /></svg
              >
              {dateRangeLabel}
              {#if filterRange.start || filterRange.end}
                <span
                  role="button"
                  tabindex="0"
                  onclick={(e) => {
                    e.stopPropagation();
                    filterRange = { start: undefined, end: undefined };
                    pagination = { ...pagination, pageIndex: 0 };
                  }}
                  onkeydown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.stopPropagation();
                      filterRange = { start: undefined, end: undefined };
                    }
                  }}
                  class="text-muted-foreground hover:text-foreground"
                >
                  <svg
                    class="size-3"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2.5"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    ><line x1="18" y1="6" x2="6" y2="18" /><line
                      x1="6"
                      y1="6"
                      x2="18"
                      y2="18"
                    /></svg
                  >
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
            class="z-50 w-auto rounded-xl border bg-card p-0 shadow-xl"
          >
            <RangeCalendar.RangeCalendar
              bind:value={filterRange}
              numberOfMonths={2}
              class="[--cell-size:--spacing(8)] p-3"
              onValueChange={() => {
                pagination = { ...pagination, pageIndex: 0 };
              }}
            />
            <div class="flex items-center justify-between gap-2 border-t px-3 py-2.5">
              <Button
                variant="ghost"
                size="sm"
                class="text-xs text-muted-foreground"
                onclick={() => {
                  filterRange = { start: undefined, end: undefined };
                  pagination = { ...pagination, pageIndex: 0 };
                  calendarOpen = false;
                }}
              >
			Bersihkan
				</Button>
				<Button
					size="sm"
					class="text-xs"
					onclick={() => { calendarOpen = false; }}
				>
					Terapkan
              </Button>
            </div>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>

      <!-- Type filter dropdown -->
      <DropdownMenu.Root>
        <DropdownMenu.Trigger>
          {#snippet child({ props })}
            <button
              {...props}
              class="inline-flex h-8 items-center gap-2 rounded-md border border-border bg-card px-3 text-xs font-semibold text-foreground transition-colors hover:bg-muted {typeFilter !==
              'all'
                ? 'border-primary/50 text-primary'
                : ''}"
            >
              {#if typeFilter !== "all"}
                <span
                  class="size-1.5 rounded-full {typeOptions.find(
                    (o) => o.key === typeFilter,
                  )?.dot}"
                ></span>
              {/if}
              {activeTypeLabel}
              <svg
                class="size-3 text-muted-foreground"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2.5"
                stroke-linecap="round"
                stroke-linejoin="round"><path d="M6 9l6 6 6-6" /></svg
              >
            </button>
          {/snippet}
        </DropdownMenu.Trigger>
        <DropdownMenu.Content
          align="start"
          class="w-44 rounded-xl border border-border bg-card p-1 shadow-lg"
        >
          {#each typeOptions as opt}
            <button
              onclick={() => {
                typeFilter = opt.key;
                pagination = { ...pagination, pageIndex: 0 };
              }}
              class="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium transition-colors hover:bg-muted {typeFilter ===
              opt.key
                ? 'bg-muted text-foreground'
                : 'text-muted-foreground'}"
            >
              <span
                class="size-1.5 rounded-full {opt.dot} {opt.key === 'all'
                  ? 'opacity-40'
                  : ''}"
              ></span>
              <span class="flex-1 text-left">{opt.label}</span>
              {#if typeFilter === opt.key}
                <svg
                  class="size-3.5 text-primary shrink-0"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2.5"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  ><polyline points="20 6 9 17 4 12" /></svg
                >
              {/if}
            </button>
          {/each}
        </DropdownMenu.Content>
      </DropdownMenu.Root>
    </div>
  </div>

  <!-- Data Table -->
  <div class="rounded-xl border bg-card">
    <Table.Root>
        <Table.Header>
          {#each table.getHeaderGroups() as hg (hg.id)}
            <Table.Row class="hover:bg-transparent border-b">
              {#each hg.headers as header (header.id)}
                <Table.Head
                  class="px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground"
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
            <Table.Row>
              {#each row.getVisibleCells() as cell (cell.id)}
                <Table.Cell class="px-3 py-2 text-xs">
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
                class="h-20 text-center text-xs text-muted-foreground"
              >
                Tidak ada transaksi yang dapat dibatalkan.
              </Table.Cell>
            </Table.Row>
          {/each}
        </Table.Body>
      </Table.Root>
    </div>

  <!-- Pagination -->
  <div class="flex items-center justify-between text-xs text-muted-foreground">
    <span>{filteredData.length} transaksi · {dateRangeLabel}</span>
    <div class="flex items-center gap-4">
      <div class="flex items-center gap-2">
        <span>Baris</span>
        <select
          class="rounded-md border px-2 py-1 bg-transparent font-medium text-xs focus:outline-none"
          value={table.getState().pagination.pageSize}
          onchange={(e) => table.setPageSize(Number(e.currentTarget.value))}
        >
          {#each [10, 15, 20, 50] as n}<option value={n}>{n}</option>{/each}
        </select>
      </div>
      <div class="flex items-center gap-1 font-bold text-foreground">
        <Button
          variant="outline"
          size="icon-sm"
          class="size-8"
          disabled={!table.getCanPreviousPage()}
          onclick={() => table.previousPage()}>‹</Button
        >
        <span class="px-3 py-1.5 bg-muted/50 rounded-md">
          Halaman {table.getState().pagination.pageIndex + 1} dari {table.getPageCount() || 1}
        </span>
        <Button
          variant="outline"
          size="icon-sm"
          class="size-8"
          disabled={!table.getCanNextPage()}
          onclick={() => table.nextPage()}>›</Button
        >
      </div>
    </div>
  </div>

</div>

<!-- ── Reversal confirmation modal ── -->
<ModalConfirmation
  open={confirmTx !== null}
  onClose={closeConfirm}
  title="Batalkan transaksi ini?"
  description={confirmTx
    ? `${confirmTx.studentName} · ${confirmTx.planCode} · ${fmt(confirmTx.amount)}`
    : ""}
  icon={ArrowTurnBackwardIcon}
  variant="danger"
>
  <form
    method="POST"
    action="?/reverse"
    class="flex flex-col gap-3 w-full"
    use:reversalEnhance
  >
    <input type="hidden" name="entryId" value={confirmTx?.entryId ?? ""} />

    {#if confirmTx}
      <div class="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2.5 space-y-1 text-left">
        <p class="text-[10px] font-bold uppercase tracking-widest text-amber-600">
          Transaksi yang akan dibatalkan
        </p>
        <p class="text-xs font-semibold">{confirmTx.referenceNo}</p>
        <p class="text-[11px] text-muted-foreground">
          {confirmTx.planName} · {confirmTx.type === "DEPOSIT" ? "Setoran" : "Penarikan"}
        </p>
      </div>
    {/if}

    <div class="space-y-1.5 text-left">
      <label
        class="text-[10px] font-bold uppercase tracking-widest text-muted-foreground"
        for="reversal-reason"
      >
        Alasan <span class="text-muted-foreground/50">(opsional)</span>
      </label>
      <textarea
        id="reversal-reason"
        name="reason"
        rows={2}
        placeholder="mis. jumlah salah dimasukkan, transaksi duplikat..."
        class="w-full rounded-lg border bg-muted/40 px-3 py-2 text-xs resize-none focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground/50"
      ></textarea>
    </div>

    {#if $reversalMessage}
      <div class="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
        {$reversalMessage}
      </div>
    {/if}

    <div class="flex gap-3 w-full">
      <Button type="button" variant="ghost" class="flex-1 h-10 text-xs font-bold" onclick={closeConfirm}>
        Batal
      </Button>
      <Button
        type="submit"
        variant="destructive"
        class="flex-1 h-10 text-xs font-bold gap-1.5"
        disabled={$reversalSubmitting}
      >
        {#if $reversalSubmitting}
          <span class="size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"></span>
          Memproses…
        {:else}
          <HugeiconsIcon icon={ArrowTurnBackwardIcon} size={14} />
          Konfirmasi Pembatalan
        {/if}
      </Button>
    </div>
  </form>
</ModalConfirmation>

<!-- ══ SNIPPETS ══ -->

{#snippet sortHeader({ column, label }: { column: any; label: string })}
  <Button
    variant="ghost"
    class="-ml-3 h-7 text-[11px] font-bold uppercase tracking-wider hover:bg-transparent {column.getIsSorted()
      ? 'text-foreground'
      : 'text-muted-foreground hover:text-foreground'}"
    onclick={(e: any) => column.getToggleSortingHandler()?.(e)}
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

{#snippet refCell({ id }: { id: string })}
  <span class="font-mono text-[10px] text-muted-foreground">{id}</span>
{/snippet}

{#snippet timeCell({ iso }: { iso: string })}
  <span class="tabular-nums text-[11px]">{txDateTime(iso)}</span>
{/snippet}

{#snippet typeCell({ type }: { type: TxType })}
  {#if type === "DEPOSIT"}
    <span
      class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary/10 text-primary"
      >● setoran</span
    >
  {:else}
    <span
      class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-destructive/10 text-destructive"
      >● penarikan</span
    >
  {/if}
{/snippet}

{#snippet studentCell({ tx }: { tx: TxRow })}
  <div>
    <p class="font-semibold text-xs">{tx.studentName}</p>
    <p class="text-[10px] text-muted-foreground">
      {tx.studentNis}{tx.studentClass ? " · " + tx.studentClass : ""}
    </p>
  </div>
{/snippet}

{#snippet programCell({ tx }: { tx: TxRow })}
  <div>
    <p class="text-xs font-medium">{tx.planName}</p>
    <p class="text-[10px] text-muted-foreground font-mono">{tx.planCode}</p>
  </div>
{/snippet}

{#snippet amountCell({ tx }: { tx: TxRow })}
  <span
    class="font-bold tabular-nums {tx.type === 'DEPOSIT'
      ? 'text-primary'
      : 'text-destructive'}"
  >
    {tx.type === "DEPOSIT" ? "+" : "−"}
    {new Intl.NumberFormat("id-ID").format(tx.amount)}
  </span>
{/snippet}

{#snippet actionCell({ tx }: { tx: TxRow })}
  <Button
    variant="ghost"
    size="sm"
    class="h-7 gap-1.5 text-[11px] font-bold text-destructive hover:text-destructive hover:bg-destructive/10"
    onclick={() => openConfirm(tx)}
  >
    <svg
      class="size-3.5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      ><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path
        d="M3 3v5h5"
      /></svg
    >
    Batalkan
  </Button>
{/snippet}
