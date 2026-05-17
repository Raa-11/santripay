<script lang="ts">
  import type { PageData } from './$types';
  import { Button } from '$lib/components/ui/button/index.js';
  import { Input } from '$lib/components/ui/input/index.js';
  import * as Table from '$lib/components/ui/table/index.js';
  import {
    createSvelteTable,
    FlexRender,
    renderSnippet,
  } from '$lib/components/ui/data-table/index.js';
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
  } from '@tanstack/table-core';
  import ArrowUpDown from '@lucide/svelte/icons/arrow-up-down';
  import ArrowUp from '@lucide/svelte/icons/arrow-up';
  import ArrowDown from '@lucide/svelte/icons/arrow-down';
  import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
  import * as Popover from '$lib/components/ui/popover/index.js';
  import * as RangeCalendar from '$lib/components/ui/range-calendar/index.js';
  import { CalendarDate, type DateValue, today, getLocalTimeZone } from '@internationalized/date';

  let { data }: { data: PageData } = $props();

  // ── Types ──
  type UiType = 'deposit' | 'withdrawal' | 'reversal';
  interface TxRow {
    referenceNo: string;
    entryId: string;
    createdAt: string;
    uiType: UiType;
    dbType: string;
    studentName: string;
    studentNis: string;
    studentClass: string | null;
    planName: string;
    planCode: string;
    amount: number;
    isReversed: boolean;
    operatorName: string | null;
    description: string | null;
    reversalReason: string | null;
  }

  // ── Helpers ──
  const fmt = (n: number) => 'Rp ' + new Intl.NumberFormat('id-ID').format(Math.round(n));

  function txDateTime(iso: string): string {
    const d = new Date(iso);
    const todayDate = new Date();
    if (d.toDateString() === todayDate.toDateString()) {
      return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    }
    return (
      d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) +
      ' · ' +
      d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
    );
  }

  const now = new Date();

  // ── Map server rows → TxRow ──
  const allTx = $derived(data.transactions.map((r) => ({
    referenceNo: r.referenceNo,
    entryId: r.entryId,
    createdAt: r.createdAt,
    uiType: r.isReversed ? 'reversal' : r.type === 'DEPOSIT' ? 'deposit' : 'withdrawal',
    dbType: r.type,
    studentName: r.studentName,
    studentNis: r.studentNis,
    studentClass: r.studentClass,
    planName: r.planName,
    planCode: r.planCode,
    amount: r.amount,
    isReversed: r.isReversed,
    operatorName: r.operatorName,
    description: r.description,
    reversalReason: r.reversalReason,
  })));

  // ── Filter state ──
  let pagination     = $state<PaginationState>({ pageIndex: 0, pageSize: 10 });
  let sorting        = $state<SortingState>([{ id: 'createdAt', desc: true }]);
  let columnFilters  = $state<ColumnFiltersState>([]);
  let columnVisibility = $state<VisibilityState>({});
  let globalFilter   = $state('');
  let selectedTypes  = $state<UiType | 'all'>('all');
  let selectedPlan   = $state<string | null>(null);

  const typeOptions: { key: UiType | 'all'; label: string; dot: string }[] = [
    { key: 'all',        label: 'All Types',  dot: 'bg-muted-foreground' },
    { key: 'deposit',    label: 'Deposit',    dot: 'bg-primary' },
    { key: 'withdrawal', label: 'Withdrawal', dot: 'bg-destructive' },
    { key: 'reversal',   label: 'Reversal',   dot: 'bg-amber-500' },
  ];

  const activeTypeLabel = $derived(
    selectedTypes === 'all' ? 'Types' : (typeOptions.find((o) => o.key === selectedTypes)?.label ?? 'Types')
  );

  // ── Date range calendar filter ──
  type DateRange = { start: DateValue | undefined; end: DateValue | undefined };
  const todayDv = today(getLocalTimeZone());
  let filterRange = $state<DateRange>({ start: todayDv, end: todayDv });
  let calendarOpen = $state(false);

  function fmtDv(dv: DateValue): string {
    return new Date(dv.year, dv.month - 1, dv.day).toLocaleDateString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric',
    });
  }

  const dateRangeLabel = $derived(
    filterRange.start && filterRange.end
      ? filterRange.start.toString() === filterRange.end.toString()
        ? fmtDv(filterRange.start)
        : `${fmtDv(filterRange.start)} – ${fmtDv(filterRange.end)}`
      : filterRange.start
      ? `From ${fmtDv(filterRange.start)}`
      : 'All dates'
  );

  const rangeStart = $derived(
    filterRange.start
      ? new Date(filterRange.start.year, filterRange.start.month - 1, filterRange.start.day)
      : null
  );
  const rangeEnd = $derived(
    filterRange.end
      ? new Date(filterRange.end.year, filterRange.end.month - 1, filterRange.end.day + 1)
      : null
  );

  // ── Stats: date-filtered only (no type filter) ──
  const dateTx = $derived(
    allTx.filter((tx) => {
      const d = new Date(tx.createdAt);
      if (rangeStart && d < rangeStart) return false;
      if (rangeEnd && d >= rangeEnd) return false;
      return true;
    })
  );

  const rangeLabel = $derived(dateRangeLabel);

  const totalDeposit    = $derived(dateTx.filter((t) => t.uiType === 'deposit').reduce((s, t) => s + t.amount, 0));
  const totalWithdrawal = $derived(dateTx.filter((t) => t.uiType === 'withdrawal').reduce((s, t) => s + t.amount, 0));
  const totalReversal   = $derived(dateTx.filter((t) => t.uiType === 'reversal').reduce((s, t) => s + t.amount, 0));
  const netFlow         = $derived(totalDeposit - totalWithdrawal);

  // ── Available saving plans (from loaded data) ──
  const availablePlans = $derived(
    [...new Map(allTx.map((tx) => [tx.planCode, { code: tx.planCode, name: tx.planName }])).values()]
      .sort((a, b) => a.name.localeCompare(b.name))
  );

  // ── Table data: date + type + plan + text filters ──
  const filteredData = $derived(
    dateTx.filter((tx) => {
      if (selectedTypes !== 'all' && tx.uiType !== selectedTypes) return false;
      if (selectedPlan && tx.planCode !== selectedPlan) return false;
      if (!globalFilter) return true;
      const q = globalFilter.toLowerCase();
      return (
        tx.referenceNo.toLowerCase().includes(q) ||
        tx.studentName.toLowerCase().includes(q) ||
        tx.studentNis.toLowerCase().includes(q) ||
        tx.planCode.toLowerCase().includes(q) ||
        tx.planName.toLowerCase().includes(q)
      );
    })
  );

  // ── Column defs ──
  const columns: ColumnDef<TxRow>[] = [
    {
      accessorKey: 'referenceNo',
      header: ({ column }) => renderSnippet(sortHeader, { column, label: 'Ref No' }),
      cell: ({ row }) => renderSnippet(refCell, { id: row.original.referenceNo }),
    },
    {
      accessorKey: 'createdAt',
      header: ({ column }) => renderSnippet(sortHeader, { column, label: 'Time' }),
      cell: ({ row }) => renderSnippet(timeCell, { iso: row.original.createdAt }),
    },
    {
      accessorKey: 'uiType',
      header: ({ column }) => renderSnippet(sortHeader, { column, label: 'Type' }),
      cell: ({ row }) => renderSnippet(typeCell, { type: row.original.uiType }),
    },
    {
      accessorKey: 'studentName',
      header: ({ column }) => renderSnippet(sortHeader, { column, label: 'Student' }),
      cell: ({ row }) => renderSnippet(studentCell, { tx: row.original }),
    },
    {
      accessorKey: 'planName',
      header: ({ column }) => renderSnippet(sortHeader, { column, label: 'Program' }),
      cell: ({ row }) => renderSnippet(programCell, { tx: row.original }),
    },
    {
      accessorKey: 'amount',
      header: ({ column }) => renderSnippet(sortHeader, { column, label: 'Amount' }),
      cell: ({ row }) => renderSnippet(amountCell, { tx: row.original }),
    },
    {
      accessorKey: 'operatorName',
      header: 'Operator',
      cell: ({ row }) => renderSnippet(operatorCell, { tx: row.original }),
    },
    {
      id: 'reversal',
      header: 'Reversal',
      cell: ({ row }) => renderSnippet(reversalCell, { tx: row.original }),
      enableSorting: false,
    },
  ];

  const table = createSvelteTable({
    get data() { return filteredData; },
    get columns() { return columns; },
    state: {
      get pagination()       { return pagination; },
      get sorting()          { return sorting; },
      get columnVisibility() { return columnVisibility; },
      get columnFilters()    { return columnFilters; },
    },
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onPaginationChange:    (u) => { if (typeof u === 'function') pagination = u(pagination); else pagination = u; },
    onSortingChange:       (u) => { if (typeof u === 'function') sorting = u(sorting); else sorting = u; },
    onColumnFiltersChange: (u) => { if (typeof u === 'function') columnFilters = u(columnFilters); else columnFilters = u; },
  });
</script>

<svelte:head>
  <title>Transaction History</title>
</svelte:head>

<!-- ══ PAGE ══ -->
<div class="flex flex-col gap-6 flex-1">

  <!-- Header -->
  <div class="flex items-start justify-between">
    <div>
      <h1 class="text-2xl font-semibold tracking-tight">Transaction History</h1>
      <p class="text-sm text-muted-foreground mt-1">
        Full journal of all deposits, withdrawals, and reversals. Filter by period, student, or program.
      </p>
    </div>
  </div>

  <!-- Stat cards -->
  <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
    <div class="rounded-xl border bg-card px-4 py-3.5 space-y-1">
      <p class="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Total Deposits</p>
      <p class="text-xl font-bold text-primary">+ {fmt(totalDeposit)}</p>
      <p class="text-[11px] text-muted-foreground">{dateTx.filter((t) => t.uiType === 'deposit').length} transactions</p>
    </div>
    <div class="rounded-xl border bg-card px-4 py-3.5 space-y-1">
      <p class="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Withdrawals</p>
      <p class="text-xl font-bold text-destructive">− {fmt(totalWithdrawal)}</p>
      <p class="text-[11px] text-muted-foreground">{dateTx.filter((t) => t.uiType === 'withdrawal').length} transactions</p>
    </div>
    <div class="rounded-xl border bg-card px-4 py-3.5 space-y-1">
      <p class="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Reversals</p>
      <p class="text-xl font-bold text-amber-600">↺ {fmt(totalReversal)}</p>
      <p class="text-[11px] text-muted-foreground">{dateTx.filter((t) => t.uiType === 'reversal').length} transactions</p>
    </div>
    <div class="rounded-xl border bg-card px-4 py-3.5 space-y-1">
      <p class="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Net Flow</p>
      <p class="text-xl font-bold {netFlow >= 0 ? 'text-primary' : 'text-destructive'}">
        {netFlow >= 0 ? '+' : '−'} {fmt(Math.abs(netFlow))}
      </p>
      <p class="text-[11px] text-muted-foreground">{dateTx.length} entries · {rangeLabel}</p>
    </div>
  </div>

  <!-- Filters -->
  <div class="flex items-center justify-between gap-3 flex-wrap">
    <div class="flex items-center gap-2 flex-wrap">
      <!-- Search -->
      <div class="relative">
        <svg class="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
        <Input
          bind:value={globalFilter}
          oninput={() => { pagination = { ...pagination, pageIndex: 0 }; }}
          placeholder="Search ref no, student, program..."
          class="h-8 pl-8 text-xs w-60 bg-card"
        />
      </div>

      <!-- Date range calendar picker -->
      <Popover.Root bind:open={calendarOpen}>
        <Popover.Trigger>
          {#snippet child({ props })}
            <button
              {...props}
              class="inline-flex h-8 items-center gap-2 rounded-md border border-border bg-card px-3 text-xs font-semibold text-foreground transition-colors hover:bg-muted {filterRange.start || filterRange.end ? 'border-primary/50 text-primary' : ''}"
            >
              <svg class="size-3.5 text-muted-foreground shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              {dateRangeLabel}
              {#if filterRange.start || filterRange.end}
                <span
                  role="button"
                  tabindex="0"
                  onclick={(e) => { e.stopPropagation(); filterRange = { start: undefined, end: undefined }; pagination = { ...pagination, pageIndex: 0 }; }}
                  onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); filterRange = { start: undefined, end: undefined }; } }}
                  class="text-muted-foreground hover:text-foreground"
                >
                  <svg class="size-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </span>
              {/if}
            </button>
          {/snippet}
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content side="bottom" align="start" sideOffset={4} class="z-50 w-auto rounded-xl border bg-card p-0 shadow-xl">
            <RangeCalendar.RangeCalendar
              bind:value={filterRange}
              numberOfMonths={2}
              class="[--cell-size:--spacing(8)] p-3"
              onValueChange={() => { pagination = { ...pagination, pageIndex: 0 }; }}
            />
            <div class="flex items-center justify-between gap-2 border-t px-3 py-2.5">
              <Button
                variant="ghost"
                size="sm"
                class="text-xs text-muted-foreground"
                onclick={() => { filterRange = { start: undefined, end: undefined }; pagination = { ...pagination, pageIndex: 0 }; calendarOpen = false; }}
              >
                Clear
              </Button>
              <Button size="sm" class="text-xs" onclick={() => { calendarOpen = false; }}>
                Apply
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
              class="inline-flex h-8 items-center gap-2 rounded-md border border-border bg-card px-3 text-xs font-semibold text-foreground transition-colors hover:bg-muted {selectedTypes !== 'all' ? 'border-primary/50 text-primary' : ''}"
            >
              {#if selectedTypes !== 'all'}
                <span class="size-1.5 rounded-full {typeOptions.find((o) => o.key === selectedTypes)?.dot}"></span>
              {/if}
              {activeTypeLabel}
              <svg class="size-3 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>
            </button>
          {/snippet}
        </DropdownMenu.Trigger>
        <DropdownMenu.Content align="start" class="w-44 rounded-xl border border-border bg-card p-1 shadow-lg">
          {#each typeOptions as opt}
            <button
              onclick={() => { selectedTypes = opt.key; pagination = { ...pagination, pageIndex: 0 }; }}
              class="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium transition-colors hover:bg-muted {selectedTypes === opt.key ? 'bg-muted text-foreground' : 'text-muted-foreground'}"
            >
              <span class="size-1.5 rounded-full {opt.dot} {opt.key === 'all' ? 'opacity-40' : ''}"></span>
              <span class="flex-1 text-left">{opt.label}</span>
              {#if selectedTypes === opt.key}
                <svg class="size-3.5 text-primary shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              {/if}
            </button>
          {/each}
        </DropdownMenu.Content>
      </DropdownMenu.Root>

      <!-- Saving Plan filter dropdown -->
      <DropdownMenu.Root>
        <DropdownMenu.Trigger>
          {#snippet child({ props })}
            <button
              {...props}
              class="inline-flex h-8 items-center gap-2 rounded-md border border-border bg-card px-3 text-xs font-semibold text-foreground transition-colors hover:bg-muted {selectedPlan ? 'border-primary/50 text-primary' : ''}"
            >
              {selectedPlan ? availablePlans.find((p) => p.code === selectedPlan)?.name ?? selectedPlan : 'Saving Plan'}
              <svg class="size-3 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>
            </button>
          {/snippet}
        </DropdownMenu.Trigger>
        <DropdownMenu.Content align="start" class="w-52 rounded-xl border border-border bg-card p-1 shadow-lg max-h-64 overflow-y-auto">
          <button
            onclick={() => { selectedPlan = null; pagination = { ...pagination, pageIndex: 0 }; }}
            class="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium transition-colors hover:bg-muted {selectedPlan === null ? 'bg-muted text-foreground' : 'text-muted-foreground'}"
          >
            <span class="flex-1 text-left">All Plans</span>
            {#if selectedPlan === null}
              <svg class="size-3.5 text-primary shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            {/if}
          </button>
          {#each availablePlans as plan}
            <button
              onclick={() => { selectedPlan = plan.code; pagination = { ...pagination, pageIndex: 0 }; }}
              class="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium transition-colors hover:bg-muted {selectedPlan === plan.code ? 'bg-muted text-foreground' : 'text-muted-foreground'}"
            >
              <div class="flex-1 text-left min-w-0">
                <p class="truncate">{plan.name}</p>
                <p class="text-[10px] font-mono opacity-60">{plan.code}</p>
              </div>
              {#if selectedPlan === plan.code}
                <svg class="size-3.5 text-primary shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
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
              <Table.Head class="px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                {#if !header.isPlaceholder}
                  <FlexRender content={header.column.columnDef.header} context={header.getContext()} />
                {/if}
              </Table.Head>
            {/each}
          </Table.Row>
        {/each}
      </Table.Header>
      <Table.Body>
        {#each table.getRowModel().rows as row (row.id)}
          <Table.Row data-state={row.getIsSelected() && 'selected'}>
            {#each row.getVisibleCells() as cell (cell.id)}
              <Table.Cell class="px-3 py-2 text-xs">
                <FlexRender content={cell.column.columnDef.cell} context={cell.getContext()} />
              </Table.Cell>
            {/each}
          </Table.Row>
        {:else}
          <Table.Row>
            <Table.Cell colspan={columns.length} class="h-20 text-center text-xs text-muted-foreground">
              No transactions found.
            </Table.Cell>
          </Table.Row>
        {/each}
      </Table.Body>
    </Table.Root>
  </div>

  <!-- Pagination -->
  <div class="flex items-center justify-between text-xs text-muted-foreground">
    <span>{filteredData.length} transactions · {rangeLabel}</span>
    <div class="flex items-center gap-4">
      <div class="flex items-center gap-2">
        <span>Rows</span>
        <select
          class="rounded-md border px-2 py-1 bg-transparent font-medium text-xs focus:outline-none"
          value={table.getState().pagination.pageSize}
          onchange={(e) => table.setPageSize(Number(e.currentTarget.value))}
        >
          {#each [10, 15, 20, 50] as n}
            <option value={n}>{n}</option>
          {/each}
        </select>
      </div>
      <div class="flex items-center gap-1 font-bold text-foreground">
        <Button variant="outline" size="icon-sm" class="size-8" disabled={!table.getCanPreviousPage()} onclick={() => table.previousPage()}>‹</Button>
        <span class="px-3 py-1.5 bg-muted/50 rounded-md">
          Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount() || 1}
        </span>
        <Button variant="outline" size="icon-sm" class="size-8" disabled={!table.getCanNextPage()} onclick={() => table.nextPage()}>›</Button>
      </div>
    </div>
  </div>

</div>

<!-- ══ SNIPPETS ══ -->

{#snippet sortHeader({ column, label }: { column: any; label: string })}
  <Button
    variant="ghost"
    class="-ml-3 h-7 text-[11px] font-bold uppercase tracking-wider hover:bg-transparent {column.getIsSorted() ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'}"
    onclick={(e: any) => column.getToggleSortingHandler()?.(e)}
  >
    {label}
    {#if column.getIsSorted() === 'asc'}
      <ArrowUp class="ml-1.5 size-3.5 text-primary" />
    {:else if column.getIsSorted() === 'desc'}
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

{#snippet typeCell({ type }: { type: UiType })}
  {#if type === 'deposit'}
    <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary/10 text-primary">● deposit</span>
  {:else if type === 'withdrawal'}
    <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-destructive/10 text-destructive">● withdrawal</span>
  {:else}
    <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600">↺ reversal</span>
  {/if}
{/snippet}

{#snippet studentCell({ tx }: { tx: TxRow })}
  <div>
    <p class="font-semibold text-xs">{tx.studentName}</p>
    <p class="text-[10px] text-muted-foreground">{tx.studentNis}{tx.studentClass ? ' · ' + tx.studentClass : ''}</p>
  </div>
{/snippet}

{#snippet programCell({ tx }: { tx: TxRow })}
  <div>
    <p class="text-xs font-medium">{tx.planName}</p>
    <p class="text-[10px] text-muted-foreground font-mono">{tx.planCode}</p>
  </div>
{/snippet}

{#snippet amountCell({ tx }: { tx: TxRow })}
  <span class="font-bold tabular-nums {tx.uiType === 'deposit' ? 'text-primary' : tx.uiType === 'withdrawal' ? 'text-destructive' : 'text-amber-600'}">
    {tx.uiType === 'deposit' ? '+' : tx.uiType === 'withdrawal' ? '−' : '↺'} {new Intl.NumberFormat('id-ID').format(tx.amount)}
  </span>
{/snippet}

{#snippet operatorCell({ tx }: { tx: TxRow })}
  <div>
    <p class="text-[10px] text-muted-foreground">{tx.operatorName ?? '—'}</p>
    {#if tx.description}
      <p class="text-[10px] text-muted-foreground/60">{tx.description}</p>
    {/if}
  </div>
{/snippet}

{#snippet reversalCell({ tx }: { tx: TxRow })}
  {#if tx.isReversed && tx.reversalReason}
    <p class="text-[11px] text-muted-foreground leading-tight">{tx.reversalReason}</p>
  {:else}
    <span class="text-[10px] text-muted-foreground/30">—</span>
  {/if}
{/snippet}
