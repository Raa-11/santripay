<script lang="ts">
  import { goto } from "$app/navigation";
  import { HugeiconsIcon } from "@hugeicons/svelte";
  import {
    PrinterIcon,
    ArrowUp01Icon,
    ArrowDown01Icon,
  } from "@hugeicons/core-free-icons";
  import type { PageData } from "./$types";
  import {
    ChartContainer,
    ChartTooltip,
    type ChartConfig,
  } from "$lib/components/ui/chart/index.js";
  import * as DropdownMenu from "$lib/components/ui/dropdown-menu/index.js";
  import * as Card from "$lib/components/ui/card/index.js";
  import * as Popover from "$lib/components/ui/popover/index.js";
  import * as RangeCalendar from "$lib/components/ui/range-calendar/index.js";
  import { Button } from "$lib/components/ui/button/index.js";
  import { AreaChart, BarChart } from "layerchart";
  import { curveMonotoneX } from "d3-shape";
  import { CalendarDate, type DateValue } from "@internationalized/date";

  let { data }: { data: PageData } = $props();

  const fmt = (n: number) =>
    new Intl.NumberFormat("id-ID").format(Math.round(n));
  const fmtRp = (n: number) => `Rp ${fmt(n)}`;
  const fmtDate = (s: string | null | undefined) => {
    if (!s) return "—";
    return new Date(s).toLocaleDateString("en-US", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const r = $derived(data.report);
  const plan = $derived(r?.plan);

  const targetAmount = $derived(Number(plan?.defaultTargetAmount ?? 0));
  const progress = $derived(
    targetAmount > 0
      ? Math.min((r!.totalCollected / targetAmount) * 100, 100)
      : 0,
  );
  const remaining = $derived(
    Math.max(targetAmount - (r?.totalCollected ?? 0), 0),
  );

  const avgMonthly = $derived(
    r
      ? r.monthlyData
          .filter((m) => m.total > 0)
          .reduce((s, m) => s + m.total, 0) /
          Math.max(r.monthlyData.filter((m) => m.total > 0).length, 1)
      : 0,
  );
  const monthsLeft = $derived(
    remaining > 0 && avgMonthly > 0 ? Math.ceil(remaining / avgMonthly) : 0,
  );
  const estimatedDate = $derived(() => {
    if (monthsLeft <= 0) return null;
    const d = new Date();
    d.setMonth(d.getMonth() + monthsLeft);
    return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
  });

  const monthChangePct = $derived(
    r && r.prevMonthTotal > 0
      ? Math.round(
          ((r.currentMonthTotal - r.prevMonthTotal) / r.prevMonthTotal) * 100,
        )
      : r && r.currentMonthTotal > 0
        ? 100
        : 0,
  );

  const monthlyChartConfig: ChartConfig = { total: { label: "Setoran" } };
  let chartType = $state<"bar" | "line">("bar");

  // Date range picker state — initialized from server data
  type DateRange = { start: DateValue | undefined; end: DateValue | undefined };

  function isoToCalendarDate(iso: string): CalendarDate {
    const [y, m, d] = iso.split("-").map(Number);
    return new CalendarDate(y, m, d);
  }

  let dateRange = $state<DateRange>({ start: undefined, end: undefined });

  // Keep dateRange in sync when plan changes (server returns new rangeFrom/rangeTo)
  $effect(() => {
    dateRange = {
      start: r?.rangeFrom ? isoToCalendarDate(r.rangeFrom) : undefined,
      end: r?.rangeTo ? isoToCalendarDate(r.rangeTo) : undefined,
    };
  });

  const fmtMonthYear = (d: DateValue) =>
    new Date(d.year, d.month - 1, d.day).toLocaleDateString("en-US", {
      month: "short",
      year: "numeric",
    });

  const rangeLabel = $derived(() => {
    if (!dateRange.start || !dateRange.end) return "Select range";
    return `${fmtMonthYear(dateRange.start)} – ${fmtMonthYear(dateRange.end)}`;
  });

  // Dynamic chart subtitle based on active range from server
  const chartRangeLabel = $derived(() => {
    if (!r?.rangeFrom || !r?.rangeTo) return "last 12 months";
    const from = isoToCalendarDate(r.rangeFrom);
    const to = isoToCalendarDate(r.rangeTo);
    // Same year → "Jan – Dec 2025"
    if (from.year === to.year) {
      const mFrom = new Date(from.year, from.month - 1).toLocaleDateString(
        "en-US",
        { month: "short" },
      );
      const mTo = new Date(to.year, to.month - 1).toLocaleDateString("en-US", {
        month: "short",
        year: "numeric",
      });
      return from.month === 1 && to.month === 12
        ? `${from.year}`
        : `${mFrom} – ${mTo}`;
    }
    return `${fmtMonthYear(from)} – ${fmtMonthYear(to)}`;
  });

  let rangeOpen = $state(false);

  function applyRange() {
    if (!dateRange.start || !dateRange.end) return;
    rangeOpen = false;
    goto(`?planId=${plan?.id}&from=${dateRange.start}&to=${dateRange.end}`);
  }

  function resetRange() {
    rangeOpen = false;
    goto(`?planId=${plan?.id}`);
  }

  const statusLabel = $derived(() => {
    if (!plan) return "";
    if (plan.savingType === "FLEXIBLE") return "fleksibel";
    return "target";
  });
  const statusColor = $derived(() => {
    if (!plan) return "text-muted-foreground";
    if (plan.savingType === "FLEXIBLE") return "text-amber-700";
    return monthChangePct >= 0 ? "text-emerald-700" : "text-red-600";
  });
  const statusDot = $derived(() => {
    if (!plan) return "bg-muted-foreground";
    if (plan.savingType === "FLEXIBLE") return "bg-amber-500";
    return monthChangePct >= 0 ? "bg-emerald-500" : "bg-red-500";
  });

  const now = new Date();
  const printDate = now.toLocaleString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  });
</script>

<svelte:head>
  <title>Laporan Program Tabungan</title>
</svelte:head>

<div class="flex flex-1 flex-col gap-6 print-page">
  <!-- HEADER -->
  <div class="flex items-start justify-between no-print">
    <div>
      <h1 class="text-2xl font-semibold tracking-tight">Laporan Program Tabungan</h1>
      <p class="mt-1 text-sm text-muted-foreground">
        Analisis mendalam per program tabungan — progres target, kontributor, dan
        linimasa.
      </p>
    </div>
    <div class="flex gap-2">
      <Button size="sm" onclick={() => window.print()}>
        <HugeiconsIcon icon={PrinterIcon} size={14} /> Cetak PDF
      </Button>
    </div>
  </div>

  <!-- PLAN SELECTOR + DATE RANGE -->
  <div
    class="flex items-center gap-3 rounded-xl border bg-card px-4 py-3 no-print"
  >
    <DropdownMenu.Root>
      <DropdownMenu.Trigger>
        {#snippet child({ props })}
          <button
            {...props}
            class="inline-flex h-8 flex-1 items-center gap-2 rounded-md border border-border bg-muted/40 px-3 text-xs font-semibold text-foreground transition-colors hover:bg-muted {plan
              ? 'border-primary/50'
              : ''}"
          >
            {#if plan}
              <span
                class="size-1.5 rounded-full {plan.savingType === 'FLEXIBLE'
                  ? 'bg-amber-500'
                  : 'bg-primary'} shrink-0"
              ></span>
              <span class="flex-1 text-left truncate">{plan.name}</span>
              <span class="font-mono text-[10px] text-muted-foreground shrink-0"
                >{plan.code}</span
              >
            {:else}
              <span class="flex-1 text-left text-muted-foreground"
                >Pilih program…</span
              >
            {/if}
            <svg
              class="size-3 text-muted-foreground shrink-0"
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
        class="w-72 rounded-xl border border-border bg-card p-1 shadow-lg max-h-72 overflow-y-auto"
      >
        {#each data.plans as p (p.id)}
          <button
            onclick={() => goto(`?planId=${p.id}`)}
            class="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium transition-colors hover:bg-muted {plan?.id ===
            p.id
              ? 'bg-muted text-foreground'
              : 'text-muted-foreground'}"
          >
            <span
              class="size-1.5 rounded-full shrink-0 {p.savingType === 'FLEXIBLE'
                ? 'bg-amber-500'
                : 'bg-primary'}"
            ></span>
            <span class="flex-1 text-left">{p.name}</span>
            <span class="font-mono text-[10px] shrink-0">{p.code}</span>
            {#if plan?.id === p.id}
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

    <div class="shrink-0 h-4 w-px bg-border"></div>

    <!-- Date range picker -->
    <Popover.Root bind:open={rangeOpen}>
      <Popover.Trigger>
        {#snippet child({ props })}
          <button
            {...props}
            class="inline-flex h-8 items-center gap-2 rounded-md border border-border bg-card px-3 text-xs font-semibold text-foreground transition-colors hover:bg-muted {dateRange.start ||
            dateRange.end
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
            {rangeLabel()}
            {#if dateRange.start || dateRange.end}
              <span
                role="button"
                tabindex="0"
                onclick={(e) => {
                  e.stopPropagation();
                  resetRange();
                }}
                onkeydown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.stopPropagation();
                    resetRange();
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
          align="end"
          sideOffset={4}
          class="z-50 w-auto rounded-xl border bg-card p-0 shadow-xl"
        >
          <RangeCalendar.RangeCalendar
            bind:value={dateRange}
            numberOfMonths={2}
            class="[--cell-size:--spacing(8)] p-3"
          />
          <div
            class="flex items-center justify-between gap-2 border-t px-3 py-2.5"
          >
            <Button
              variant="ghost"
              size="sm"
              onclick={resetRange}
              class="text-xs text-muted-foreground"
            >
              Kembalikan ke default
            </Button>
            <Button
              size="sm"
              class="text-xs"
              onclick={applyRange}
              disabled={!dateRange.start || !dateRange.end}
            >
              Terapkan
            </Button>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>

    <span class="text-xs text-muted-foreground shrink-0">
      {data.plans.length} program tersedia
    </span>
  </div>

  {#if !r || !plan}
    <div
      class="flex flex-1 items-center justify-center text-sm text-muted-foreground"
    >
      Tidak ada program tersedia.
    </div>
  {:else}
    <Card.Root class="rounded-2xl overflow-hidden print-card">
      <!-- Plan identity -->
      <Card.Header class="border-b px-6 pt-6 pb-4">
        <div class="flex items-start justify-between gap-4">
          <div>
            <p
              class="text-[10px] font-bold uppercase tracking-widest text-muted-foreground"
            >
              {plan.code} · {plan.savingType}
            </p>
            <Card.Title class="mt-1 text-2xl font-bold tracking-tight"
              >{plan.name}</Card.Title
            >
            <Card.Description class="mt-1 text-xs">
              {r.studentCount} siswa terdaftar · {r.totalTransactions} transaksi
              · sejak {fmtDate(plan.startDate ?? plan.createdAt)}
            </Card.Description>
          </div>
          <span
            class="flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold {statusColor()}"
          >
            <span class="size-1.5 rounded-full {statusDot()}"></span>
            {statusLabel()}
          </span>
        </div>
      </Card.Header>

      <Card.Content class="space-y-6 p-6">
        <!-- ── FLEXIBLE LAYOUT ── -->
        {#if plan.savingType === "FLEXIBLE"}
          <div class="rounded-xl border bg-muted/20 p-5">
            <div class="flex items-start justify-between gap-6">
              <div class="flex-1">
                <p
                  class="text-[10px] font-bold uppercase tracking-widest text-muted-foreground"
                >
                  Total Terkumpul
                </p>
                <p class="mt-1 text-3xl font-bold tracking-tight">
                  {fmtRp(r.totalCollected)}
                </p>
                <p class="mt-1 text-[11px] text-muted-foreground">
                  Fleksibel — tanpa target tetap
                </p>
                <div class="mt-3 flex items-center gap-4 text-[11px]">
                  <span
                    >Jenis: <strong class="text-amber-700">Fleksibel</strong
                    ></span
                  >
                  <span class="text-muted-foreground">·</span>
                  <span
                    >Siswa baru bulan ini: <strong
                      >+{r.newStudentsThisMonth}</strong
                    ></span
                  >
                  <span class="text-muted-foreground">·</span>
                  <span
                    >Bulan ini: <strong>{fmtRp(r.currentMonthTotal)}</strong
                    ></span
                  >
                </div>
              </div>
              <div class="flex divide-x rounded-lg border bg-card">
                <div class="px-5 py-3 text-center">
                  <p
                    class="text-[9px] font-bold uppercase tracking-widest text-muted-foreground"
                  >
                    Siswa
                  </p>
                  <p class="mt-1 text-2xl font-bold">{r.studentCount}</p>
                </div>
                <div class="px-5 py-3 text-center">
                  <p
                    class="text-[9px] font-bold uppercase tracking-widest text-muted-foreground"
                  >
                    Rata-rata / Siswa
                  </p>
                  <p class="mt-1 text-2xl font-bold">
                    {fmtRp(r.avgPerStudent)}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <!-- ── GOAL LAYOUT ── -->
        {:else}
          <div class="rounded-xl border bg-muted/20 p-5">
            <div class="grid grid-cols-3 gap-6 items-center">
              <div>
                <p
                  class="text-[9px] font-bold uppercase tracking-widest text-muted-foreground"
                >
                  Terkumpul
                </p>
                <p class="mt-1 text-xl font-bold">{fmtRp(r.totalCollected)}</p>
              </div>
              <div class="text-center">
                <p class="text-5xl font-black tracking-tight leading-none">
                  {Math.round(progress)}<span
                    class="text-2xl font-bold text-muted-foreground">%</span
                  >
                </p>
                <p
                  class="mt-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground"
                >
                  dari Target
                </p>
              </div>
              <div class="text-right">
                <p
                  class="text-[9px] font-bold uppercase tracking-widest text-muted-foreground"
                >
                  Target
                </p>
                <p class="mt-1 text-xl font-bold">{fmtRp(targetAmount)}</p>
              </div>
            </div>

            <div class="mt-4 h-3 w-full overflow-hidden rounded-full bg-muted">
              <div
                class="h-full rounded-full transition-all duration-700"
                style="width: {Math.max(
                  progress,
                  0.5,
                )}%; background: linear-gradient(to right, #1a4a38, #8b7a2e)"
              ></div>
            </div>

            <div class="mt-3 flex items-center justify-between text-[11px]">
              <span
                >Tersisa: <strong class="text-destructive"
                  >{fmtRp(remaining)}</strong
                ></span
              >
              <span
                >Rata-rata bulanan: <strong>{fmtRp(Math.round(avgMonthly))}</strong
                ></span
              >
              <span
                >Perkiraan selesai: <strong>{estimatedDate() ?? "—"}</strong
                ></span
              >
            </div>
          </div>
        {/if}

        <!-- ── STAT CARDS ── -->
        <div class="grid grid-cols-4 gap-3">
          <Card.Root size="sm">
            <Card.Content class="p-4">
              <p
                class="text-[9px] font-bold uppercase tracking-widest text-muted-foreground"
              >
                Bulan Ini
              </p>
              <p class="mt-2 text-lg font-bold text-emerald-700">
                + {fmtRp(r.currentMonthTotal)}
              </p>
              <p
                class="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground"
              >
                {#if monthChangePct > 0}
                  <HugeiconsIcon
                    icon={ArrowUp01Icon}
                    size={10}
                    class="text-emerald-600"
                  />
                  <span class="text-emerald-600">{monthChangePct}%</span>
                {:else if monthChangePct < 0}
                  <HugeiconsIcon
                    icon={ArrowDown01Icon}
                    size={10}
                    class="text-red-500"
                  />
                  <span class="text-red-500">{Math.abs(monthChangePct)}%</span>
                {:else}
                  <span>—</span>
                {/if}
                vs last month
              </p>
            </Card.Content>
          </Card.Root>

          <Card.Root size="sm">
            <Card.Content class="p-4">
              <p
                class="text-[9px] font-bold uppercase tracking-widest text-muted-foreground"
              >
                Total Siswa
              </p>
              <p class="mt-2 text-lg font-bold">{r.studentCount}</p>
              <p class="mt-1 text-[10px] text-muted-foreground">
                ▲ {r.newStudentsThisMonth} baru bulan ini
              </p>
            </Card.Content>
          </Card.Root>

          <Card.Root size="sm">
            <Card.Content class="p-4">
              <p
                class="text-[9px] font-bold uppercase tracking-widest text-muted-foreground"
              >
                Rata-rata per Siswa
              </p>
              <p class="mt-2 text-lg font-bold">{fmtRp(r.avgPerStudent)}</p>
              <p class="mt-1 text-[10px] text-muted-foreground">terakumulasi</p>
            </Card.Content>
          </Card.Root>

          <Card.Root size="sm">
            <Card.Content class="p-4">
              <p
                class="text-[9px] font-bold uppercase tracking-widest text-muted-foreground"
              >
                Pembatalan
              </p>
              <p
                class="mt-2 text-lg font-bold {r.reversalCount > 0
                  ? 'text-amber-600'
                  : ''}"
              >
                {r.reversalCount}
              </p>
              <p class="mt-1 text-[10px] text-muted-foreground">
                {r.totalTransactions > 0
                  ? `< ${Math.max(Math.ceil((r.reversalCount / r.totalTransactions) * 100), r.reversalCount > 0 ? 1 : 0)}% of total`
                  : "tidak ada transaksi"}
              </p>
            </Card.Content>
          </Card.Root>
        </div>

        <!-- ── MONTHLY CHART ── -->
        <div>
          <div class="flex items-center justify-between mb-2">
            <!-- Chart type toggle -->
            <div
              class="flex items-center rounded-md border bg-muted/30 p-0.5 gap-0.5"
            >
              <button
                onclick={() => (chartType = "bar")}
                class="rounded px-2.5 py-1 text-[10px] font-semibold transition-colors {chartType ===
                'bar'
                  ? 'bg-background shadow-sm text-foreground'
                  : 'text-muted-foreground hover:text-foreground'}"
              >
                Batang
              </button>
              <button
                onclick={() => (chartType = "line")}
                class="rounded px-2.5 py-1 text-[10px] font-semibold transition-colors {chartType ===
                'line'
                  ? 'bg-background shadow-sm text-foreground'
                  : 'text-muted-foreground hover:text-foreground'}"
              >
                Garis
              </button>
            </div>
            <p class="text-[10px] text-muted-foreground">{chartRangeLabel()}</p>
          </div>

          <!-- Global SVG Gradient Definition for Area Chart -->
          <svg class="absolute h-0 w-0 opacity-0 pointer-events-none" aria-hidden="true">
            <defs>
              <linearGradient id="chart-area-gradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="var(--primary)" stop-opacity="0.2" />
                <stop offset="100%" stop-color="var(--primary)" stop-opacity="0.0" />
              </linearGradient>
            </defs>
          </svg>

          <ChartContainer
            config={monthlyChartConfig}
            class="h-48 w-full aspect-auto print-chart"
          >
            {#if chartType === "bar"}
              <BarChart
                data={r.monthlyData}
                x="label"
                axis="x"
                series={[
                  {
                    key: "total",
                    label: "Setoran",
                    color: "var(--primary)",
                  },
                ]}
                padding={{ left: 65, bottom: 24, right: 10, top: 10 }}
                props={{
                  bars: { rounded: "top", class: "transition-colors hover:fill-primary/90" },
                  grid: { y: { class: "stroke-muted/40", "stroke-dasharray": "4 4" } },
                  yAxis: { tickMarks: false, format: (v) => fmtRp(v), class: "text-[9px] font-medium text-muted-foreground" },
                  xAxis: { tickMarks: false, class: "text-[10px] text-muted-foreground" }
                }}
              >
                {#snippet tooltip()}
                  <ChartTooltip>
                    {#snippet formatter({ value })}
                      <div class="flex items-center justify-between gap-6 w-full leading-none">
                        <span class="text-muted-foreground">Setoran</span>
                        <span class="text-foreground font-mono font-bold">{fmtRp(Number(value))}</span>
                      </div>
                    {/snippet}
                  </ChartTooltip>
                {/snippet}
              </BarChart>
            {:else}
              <AreaChart
                data={r.monthlyData}
                x="label"
                y="total"
                series={[
                  {
                    key: "total",
                    label: "Setoran",
                    color: "var(--primary)",
                  },
                ]}
                padding={{ left: 65, bottom: 24, right: 10, top: 10 }}
                props={{
                  area: {
                    line: { curve: curveMonotoneX, strokeWidth: 2.5, class: "stroke-primary" },
                    fill: "url(#chart-area-gradient)",
                    fillOpacity: 1
                  },
                  highlight: { points: { r: 4 } },
                  grid: { y: { class: "stroke-muted/40", "stroke-dasharray": "4 4" } },
                  yAxis: { tickMarks: false, format: (v) => fmtRp(v), class: "text-[9px] font-medium text-muted-foreground" },
                  xAxis: { tickMarks: false, class: "text-[10px] text-muted-foreground" }
                }}
              >
                {#snippet tooltip()}
                  <ChartTooltip>
                    {#snippet formatter({ value })}
                      <div class="flex items-center justify-between gap-6 w-full leading-none">
                        <span class="text-muted-foreground">Setoran</span>
                        <span class="text-foreground font-mono font-bold">{fmtRp(Number(value))}</span>
                      </div>
                    {/snippet}
                  </ChartTooltip>
                {/snippet}
              </AreaChart>
            {/if}
          </ChartContainer>
        </div>

        <!-- ── SIGNATURE ── -->
        <div class="mt-8 border-t pt-6">
          <div class="grid grid-cols-2 gap-8">
            <div class="text-center">
              <p class="text-xs text-muted-foreground mb-20">Disiapkan oleh,</p>
              <div class="border-t border-foreground/30 pt-2 mx-6">
                <p class="text-xs font-semibold">{data.user?.name ?? "—"}</p>
                <p class="text-[10px] text-muted-foreground">
                  Bendahara · {data.user?.email ?? ""}
                </p>
              </div>
            </div>
            <div class="text-center">
              <p class="text-xs text-muted-foreground mb-20">Disetujui oleh,</p>
              <div class="border-t border-foreground/30 pt-2 mx-6">
                <p class="text-xs font-semibold">&nbsp;</p>
                <p class="text-[10px] text-muted-foreground">
                  Kepala Lembaga
                </p>
              </div>
            </div>
          </div>
          <p class="mt-6 text-center text-[9px] text-muted-foreground">
            Dibuat oleh SantriPay · {plan.code} · {printDate}
          </p>
        </div>
      </Card.Content>
    </Card.Root>
  {/if}
</div>

<style>
  @media print {
    :global([data-slot="sidebar"]),
    :global([data-slot="sidebar-gap"]),
    :global(header),
    :global(nav),
    .no-print {
      display: none !important;
    }
    :global(body),
    :global([data-slot="sidebar-inset"]) {
      background: white !important;
      margin: 0 !important;
      padding: 0 !important;
    }
    :global([data-slot="sidebar-inset"]) {
      min-width: 100vw !important;
    }
    .print-page {
      padding: 0 !important;
    }
    @page {
      size: A4 landscape;
      margin: 12mm;
    }
    :global(.print-card) {
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .print-page {
      zoom: 0.6;
    }
    :global(.print-chart),
    :global(.print-chart .lc-root-container) {
      width: calc(100% / 0.6) !important;
      max-width: none !important;
    }
    :global(.print-chart) {
      height: 140px !important;
    }
    :global(.print-chart .lc-root-container),
    :global(.print-chart svg) {
      width: 100% !important;
      height: 100% !important;
    }
  }
</style>
