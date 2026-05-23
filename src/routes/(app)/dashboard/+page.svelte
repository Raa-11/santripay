<script lang="ts">
  // Import PageData untuk tipe data data dari server (+page.ts)
  import type { PageData } from "./$types";
  // Import komponen UI Card
  import * as Card from "$lib/components/ui/card/index.js";
  // Import komponen UI Chart
  import * as Chart from "$lib/components/ui/chart/index.js";
  // Import visualisasi grafik dari library layerchart
  import { AreaChart, LineChart } from "layerchart";
  import { curveMonotoneX } from "d3-shape";
  // Import ikon Hugeicons
  import { HugeiconsIcon } from "@hugeicons/svelte";
  import {
    PiggyBankIcon,
    Wallet01Icon,
    ArrowDown01Icon,
    UserGroupIcon,
    AnalyticsUpIcon,
    ArrowUp01Icon,
    ArrowDown01Icon as ArrowDownIcon,
  } from "@hugeicons/core-free-icons";

  // Ambil waktu saat ini untuk ucapan selamat (pagi/siang/malam) di header
  const now = new Date();
  const greeting =
    now.getHours() < 12
      ? "Selamat pagi"
      : now.getHours() < 17
        ? "Selamat siang"
        : "Selamat malam";
  
  // Format tanggal hari ini (Contoh: Saturday, May 23, 2026)
  const printDate = now.toLocaleDateString("en-US", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  // Ambil data yang dikirim oleh server load function ke dalam UI ($props di Svelte 5)
  let { data }: { data: PageData } = $props();

  // Fungsi pembantu buat format angka ribuan (titik)
  const fmt = (n: number) =>
    new Intl.NumberFormat("id-ID").format(Math.round(n));
  
  // Format angka ke format Rupiah (Contoh: Rp 150.000)
  const fmtRp = (n: number) => `Rp ${fmt(n)}`;

  // Format angka yang disingkat biar ga kepanjangan di dasbor (Contoh: 1.5M / 500K)
  function fmtCompact(n: number): string {
    if (n >= 1_000_000_000) return `Rp ${(n / 1_000_000_000).toFixed(1)}B`;
    if (n >= 1_000_000) return `Rp ${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `Rp ${Math.round(n / 1_000)}K`;
    return fmtRp(n);
  }

  // Format waktu transaksi biar kalau hari ini cuma nampilin jam, kalau beda hari nampilin tanggal
  function txTime(iso: string): string {
    const d = new Date(iso);
    const today = new Date();
    if (d.toDateString() === today.toDateString()) {
      return d.toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
      });
    }
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  }

  // Fungsi buat bikin inisial nama siswa (Contoh: "Ahmad Zaki" jadi "AZ")
  function getInitials(name: string): string {
    return name
      .split(" ")
      .slice(0, 2)
      .map((w) => w[0])
      .join("")
      .toUpperCase();
  }

  // State reaktif buat tab grafik yang aktif ("7D" = 7 Hari, "12M" = 12 Bulan)
  let overviewTab = $state<"7D" | "12M">("12M");

  // Filter data grafik secara reaktif berdasarkan tab yang aktif saat ini
  const chartData = $derived(
    overviewTab === "7D" ? data.dailyData : data.monthlyData,
  );

  // Total setoran yang masuk di grafik terpilih
  const overviewTotal = $derived(chartData.reduce((s, d) => s + d.deposit, 0));
  // Cek apakah ada data setoran/penarikan biar grafiknya ga kosong melompong
  const hasChartData = $derived(
    chartData.some((d) => d.deposit > 0 || d.withdraw > 0),
  );
  // Cari nominal tertinggi untuk batas tinggi grafik (Y axis)
  const yMax = $derived(
    Math.max(1, ...chartData.map((d) => Math.max(d.deposit, d.withdraw))),
  );

  // Kalkulasi total setoran minggu ini secara reaktif
  const thisWeekTotal = $derived(
    data.dailyData.reduce((s, d) => s + d.deposit, 0),
  );
  const prevWeekTotal = $derived(data.prevWeekDeposits);
  // Ambil data setoran bulan lalu untuk dibandingin ke bulan ini
  const prevMonthTotal = $derived(
    data.monthlyData.find((d) => {
      const now = new Date();
      const prevM = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1),
      );
      return (
        d.month ===
        `${prevM.getUTCFullYear()}-${String(prevM.getUTCMonth() + 1).padStart(2, "0")}`
      );
    })?.deposit ?? 0,
  );

  // Label rentang waktu statistik di bawah grafik
  const statLabel = $derived(overviewTab === "7D" ? "Minggu Ini" : "Bulan Ini");

  // Total uang yang disetor di periode aktif
  const statTotal = $derived(
    overviewTab === "7D" ? thisWeekTotal : data.thisMonthDeposits,
  );

  // Hitung persentase kenaikan/penurunan setoran dibanding periode sebelumnya (+% / -%)
  const statChange = $derived(
    overviewTab === "7D"
      ? prevWeekTotal > 0
        ? Math.round(((thisWeekTotal - prevWeekTotal) / prevWeekTotal) * 100)
        : thisWeekTotal > 0
          ? 100
          : 0
      : prevMonthTotal > 0
        ? Math.round(
            ((data.thisMonthDeposits - prevMonthTotal) / prevMonthTotal) * 100,
          )
        : data.thisMonthDeposits > 0
          ? 100
          : 0,
  );

  // Data mini sparkline (grafik garis kecil) untuk kartu statistik di atas
  const depositSpark = $derived(data.dailyData.map((d) => d.deposit));
  const withdrawSpark = $derived(data.dailyData.map((d) => d.withdraw));
  
  // Hitung akumulasi tren saldo tabungan 7 hari terakhir
  const savingsSpark = $derived.by(() => {
    let acc = data.totalBalance - data.dailyData.reduce((s, d) => s + d.deposit - d.withdraw, 0);
    return data.dailyData.map((d) => {
      acc += d.deposit - d.withdraw;
      return acc;
    });
  });

  const studentsSpark = $derived(Array(7).fill(data.activeStudents));

  // Mapping data sparkline ke format object index-value biar bisa dibaca grafik layerchart
  const savingsSparkData = $derived(savingsSpark.map((v, i) => ({ index: i, val: v })));
  const depositSparkData = $derived(depositSpark.map((v, i) => ({ index: i, val: v })));
  const withdrawSparkData = $derived(withdrawSpark.map((v, i) => ({ index: i, val: v })));
  const studentsSparkData = $derived(studentsSpark.map((v, i) => ({ index: i, val: v })));

  // Konfigurasi label dan warna garis grafik utama
  const chartConfig = {
    deposit: { label: "Setoran", color: "var(--primary)" },
    withdraw: { label: "Penarikan", color: "var(--destructive)" },
  } satisfies Chart.ChartConfig;

  // Hitung persentase target ketersediaan saldo di program tabungan rencana
  function programProgress(p: (typeof data.programs)[number]): number {
    if (!p.defaultTargetAmount || p.studentCount === 0) return 0;
    return Math.min(
      100,
      (p.totalCollected / (p.defaultTargetAmount * p.studentCount)) * 100,
    );
  }
</script>

<svelte:head>
  <title>Dasbor</title>
</svelte:head>

<div class="flex flex-1 flex-col gap-5">
  <!-- ── HEADER ── -->
  <div class="flex items-center justify-between">
    <div>
      <p class="text-xs text-muted-foreground">
        {greeting}, {data.user?.name ?? "Admin"} 👋
      </p>
      <h1 class="text-xl font-bold tracking-tight">Dasbor</h1>
    </div>
    <p class="text-xs text-muted-foreground hidden sm:block">{printDate}</p>
  </div>





  <!-- ── STAT CARDS ── -->
  <div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
    <!-- Total Savings -->
    <Card.Root class="overflow-hidden">
      <div class="h-0.5 bg-primary"></div>
      <Card.Content class="p-4">
        <div class="flex items-start justify-between">
          <p class="text-xs font-medium text-muted-foreground">Total Tabungan</p>
          <div class="rounded-lg bg-primary/10 p-1.5">
            <HugeiconsIcon
              icon={PiggyBankIcon}
              size={13}
              class="text-primary"
            />
          </div>
        </div>
        <p class="mt-2.5 text-2xl font-bold tracking-tight">
          {fmtRp(data.totalBalance)}
        </p>
        <div class="mt-2 flex items-center justify-between gap-2">
          <p class="flex items-center gap-1 text-[11px] text-primary">
            <HugeiconsIcon icon={AnalyticsUpIcon} size={11} />
            <span>Saldo saat ini</span>
          </p>
          <div class="h-5 w-14 shrink-0">
            <LineChart
              data={savingsSparkData}
              x="index"
              series={[{ key: "val", color: "var(--primary)" }]}
              axis={false}
              grid={false}
              highlight={false}
              tooltipContext={false}
              padding={{ top: 2, right: 2, bottom: 2, left: 2 }}
              props={{
                spline: { curve: curveMonotoneX, strokeWidth: 1.5 },
              }}
            />
          </div>
        </div>
      </Card.Content>
    </Card.Root>

    <!-- Total Deposits -->
    <Card.Root class="overflow-hidden">
      <div class="h-0.5 bg-primary"></div>
      <Card.Content class="p-4">
        <div class="flex items-start justify-between">
          <p class="text-xs font-medium text-muted-foreground">
            Total Setoran
          </p>
          <div class="rounded-lg bg-primary/10 p-1.5">
            <HugeiconsIcon icon={Wallet01Icon} size={13} class="text-primary" />
          </div>
        </div>
        <p class="mt-2.5 text-2xl font-bold tracking-tight">
          {fmtRp(data.totalDeposits)}
        </p>
        <div class="mt-2 flex items-center justify-between gap-2">
          <p class="flex items-center gap-1 text-[11px] text-primary">
            <HugeiconsIcon icon={AnalyticsUpIcon} size={11} />
            <span>+{fmtCompact(data.thisWeekDeposits)} minggu ini</span>
          </p>
          <div class="h-5 w-14 shrink-0">
            <LineChart
              data={depositSparkData}
              x="index"
              series={[{ key: "val", color: "var(--primary)" }]}
              axis={false}
              grid={false}
              highlight={false}
              tooltipContext={false}
              padding={{ top: 2, right: 2, bottom: 2, left: 2 }}
              props={{
                spline: { curve: curveMonotoneX, strokeWidth: 1.5 },
              }}
            />
          </div>
        </div>
      </Card.Content>
    </Card.Root>

    <!-- Total Withdrawals -->
    <Card.Root class="overflow-hidden">
      <div class="h-0.5 bg-destructive"></div>
      <Card.Content class="p-4">
        <div class="flex items-start justify-between">
          <p class="text-xs font-medium text-muted-foreground">
            Total Penarikan
          </p>
          <div class="rounded-lg bg-destructive/10 p-1.5">
            <HugeiconsIcon
              icon={ArrowDownIcon}
              size={13}
              class="text-destructive"
            />
          </div>
        </div>
        <p class="mt-2.5 text-2xl font-bold tracking-tight">
          {fmtRp(data.totalWithdrawals)}
        </p>
        <div class="mt-2 flex items-center justify-between gap-2">
          <p class="flex items-center gap-1 text-[11px] text-muted-foreground">
            <span>Bersih: </span>
            <span
              class="{data.totalDeposits - data.totalWithdrawals >= 0
                ? 'text-primary'
                : 'text-destructive'} font-semibold"
            >
              {fmtCompact(Math.abs(data.totalDeposits - data.totalWithdrawals))}
            </span>
          </p>
          <div class="h-5 w-14 shrink-0">
            <LineChart
              data={withdrawSparkData}
              x="index"
              series={[{ key: "val", color: "var(--destructive)" }]}
              axis={false}
              grid={false}
              highlight={false}
              tooltipContext={false}
              padding={{ top: 2, right: 2, bottom: 2, left: 2 }}
              props={{
                spline: { curve: curveMonotoneX, strokeWidth: 1.5 },
              }}
            />
          </div>
        </div>
      </Card.Content>
    </Card.Root>

    <!-- Active Students -->
    <Card.Root class="overflow-hidden">
      <div class="h-0.5 bg-primary"></div>
      <Card.Content class="p-4">
        <div class="flex items-start justify-between">
          <p class="text-xs font-medium text-muted-foreground">
            Siswa Aktif
          </p>
          <div class="rounded-lg bg-primary/10 p-1.5">
            <HugeiconsIcon
              icon={UserGroupIcon}
              size={13}
              class="text-primary"
            />
          </div>
        </div>
        <p class="mt-2.5 text-2xl font-bold tracking-tight">
          {data.activeStudents}<span
            class="text-lg font-normal text-muted-foreground"
          >
            / {data.totalStudents}</span
          >
        </p>
        <div class="mt-2 flex items-center justify-between gap-2">
          <p class="flex items-center gap-1 text-[11px] text-primary">
            <HugeiconsIcon icon={AnalyticsUpIcon} size={11} />
            <span>Siswa terdaftar</span>
          </p>
          <div class="h-5 w-14 shrink-0">
            <LineChart
              data={studentsSparkData}
              x="index"
              series={[{ key: "val", color: "var(--primary)" }]}
              axis={false}
              grid={false}
              highlight={false}
              tooltipContext={false}
              padding={{ top: 2, right: 2, bottom: 2, left: 2 }}
              props={{
                spline: { curve: curveMonotoneX, strokeWidth: 1.5 },
              }}
            />
          </div>
        </div>
      </Card.Content>
    </Card.Root>
  </div>

  <!-- ── OVERVIEW + RECENT TRANSACTIONS ── -->
  <div class="grid grid-cols-1 gap-4 lg:grid-cols-5">
    <!-- Overview Chart -->
    <Card.Root class="lg:col-span-3">
      <Card.Content class="p-4">
        <div class="flex items-start justify-between gap-4">
          <div>
            <h2 class="text-sm font-bold">Ringkasan</h2>
            <p class="text-[11px] text-muted-foreground mt-0.5">
              {overviewTab === "7D"
                ? "Setoran & Penarikan, minggu ini"
                : "Setoran & Penarikan, tahun ini"}
            </p>
          </div>
          <div
            class="flex gap-0.5 rounded-lg border bg-muted/30 p-0.5 shrink-0"
          >
            {#each ["7D", "12M"] as const as tab}
              <button
                onclick={() => (overviewTab = tab)}
                class="rounded px-2.5 py-1 text-[10px] font-bold transition-colors {overviewTab ===
                tab
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'}"
              >
                {tab}
              </button>
            {/each}
          </div>
        </div>

        <!-- Period stats -->
        <div class="mt-3 grid grid-cols-2 gap-3">
          <div class="rounded-xl bg-muted/40 px-3 py-2.5">
            <p
              class="text-[10px] font-bold uppercase tracking-widest text-muted-foreground"
            >
              Total Periode
            </p>
            <p class="mt-1 text-xl font-bold">{fmtCompact(overviewTotal)}</p>
          </div>
          <div class="rounded-xl bg-muted/40 px-3 py-2.5">
            <p
              class="text-[10px] font-bold uppercase tracking-widest text-muted-foreground"
            >
              {statLabel}
            </p>
            <div class="mt-1 flex items-center gap-2">
              <p class="text-xl font-bold">{fmtCompact(statTotal)}</p>
              {#if statChange !== null && statChange !== 0}
                <span
                  class="rounded-full px-1.5 py-0.5 text-[10px] font-bold {statChange >
                  0
                    ? 'bg-primary/10 text-primary'
                    : 'bg-destructive/10 text-destructive'}"
                >
                  {statChange > 0 ? "+" : ""}{statChange}%
                </span>
              {/if}
            </div>
          </div>
        </div>

        <!-- Legend -->
        <div class="mt-3 flex items-center gap-4">
          <span class="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span class="inline-block h-0.5 w-4 rounded-full bg-primary"></span>
            Setoran
          </span>
          <span class="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span class="inline-block h-0.5 w-4 rounded-full bg-destructive"></span>
            Penarikan
          </span>
        </div>

        <!-- Line chart -->
        <div class="mt-2">
          {#if hasChartData}
            <!-- Global SVG Gradients for Dashboard AreaChart -->
            <svg class="absolute h-0 w-0 opacity-0 pointer-events-none" aria-hidden="true">
              <defs>
                <linearGradient id="dashboard-deposit-gradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stop-color="var(--primary)" stop-opacity="0.18" />
                  <stop offset="100%" stop-color="var(--primary)" stop-opacity="0.0" />
                </linearGradient>
                <linearGradient id="dashboard-withdraw-gradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stop-color="var(--destructive)" stop-opacity="0.15" />
                  <stop offset="100%" stop-color="var(--destructive)" stop-opacity="0.0" />
                </linearGradient>
              </defs>
            </svg>

            <Chart.Container config={chartConfig} class="aspect-auto h-44 w-full">
              <AreaChart
                data={chartData}
                x="label"
                axis="x"
                series={[
                  {
                    key: "deposit",
                    label: "Deposit",
                    color: "var(--primary)",
                    props: {
                      fill: "url(#dashboard-deposit-gradient)",
                      fillOpacity: 1,
                      line: { curve: curveMonotoneX, strokeWidth: 2.2, class: "stroke-primary" },
                    }
                  },
                  {
                    key: "withdraw",
                    label: "Withdraw",
                    color: "var(--destructive)",
                    props: {
                      fill: "url(#dashboard-withdraw-gradient)",
                      fillOpacity: 1,
                      line: { curve: curveMonotoneX, strokeWidth: 2.2, class: "stroke-destructive" },
                    }
                  },
                ]}
                props={{
                  highlight: { points: { r: 4 } },
                }}
              >
                {#snippet tooltip()}
                  <Chart.Tooltip>
                    {#snippet formatter({ value, name })}
                      <div class="flex items-center justify-between gap-6 w-full leading-none">
                        <span class="text-muted-foreground">{name}</span>
                        <span class="text-foreground font-mono font-bold">{fmtRp(Number(value))}</span>
                      </div>
                    {/snippet}
                  </Chart.Tooltip>
                {/snippet}
              </AreaChart>
            </Chart.Container>
          {:else}
            <div class="flex h-44 flex-col items-center justify-center gap-1.5 rounded-xl bg-muted/20">
              <p class="text-xs font-medium text-muted-foreground">Tidak ada data pada periode ini</p>
              <p class="text-[11px] text-muted-foreground/60">Beralih ke 12B untuk melihat data historis</p>
            </div>
          {/if}
        </div>
      </Card.Content>
    </Card.Root>

    <!-- Recent Transactions -->
    <Card.Root class="flex flex-col lg:col-span-2">
      <Card.Content class="flex flex-1 flex-col p-0">
        <div class="px-4 pt-4 pb-3 border-b">
          <h2 class="text-sm font-bold">Transaksi Terbaru</h2>
          <p class="text-[11px] text-muted-foreground mt-0.5">
            {data.recentTx.length} entri terbaru
          </p>
        </div>

        {#if data.recentTx.length === 0}
          <p
            class="flex-1 px-5 py-10 text-center text-sm text-muted-foreground"
          >
            Belum ada transaksi.
          </p>
        {:else}
          <div
            class="flex-1 divide-y overflow-y-auto"
            style="max-height: 240px;"
          >
            {#each data.recentTx as tx (tx.id)}
              <div class="flex items-center gap-3 px-4 py-2.5">
                <div
                  class="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground"
                >
                  {getInitials(tx.studentName)}
                </div>
                <div class="min-w-0 flex-1">
                  <p class="truncate text-xs font-semibold">{tx.studentName}</p>
                  <p class="truncate text-[10px] text-muted-foreground">
                    {tx.planName}
                  </p>
                </div>
                <div class="shrink-0 text-right">
                  <p
                    class="text-xs font-bold {tx.isReversed
                      ? 'text-amber-600'
                      : tx.type === 'DEPOSIT'
                        ? 'text-primary'
                        : 'text-destructive'}"
                  >
                    {tx.isReversed ? "↺" : tx.type === "DEPOSIT" ? "+" : "−"}
                    {fmtCompact(tx.amount)}
                  </p>
                  <p class="text-[10px] text-muted-foreground">
                    {txTime(tx.createdAt)}
                  </p>
                </div>
              </div>
            {/each}
          </div>
        {/if}

        <div
          class="flex items-center justify-between border-t px-4 py-2.5 mt-auto"
        >
          <p class="text-[11px] text-muted-foreground">
            Hari ini · {data.todayCount} transaksi
          </p>
          <p class="text-sm font-bold text-primary">
            + {fmtCompact(data.todayDeposits)}
          </p>
        </div>
      </Card.Content>
    </Card.Root>
  </div>

  <!-- ── SAVINGS PROGRAMS ── -->
  {#if data.programs.length > 0}
    <div>
      <div class="mb-3 flex items-end justify-between">
        <div>
          <h2 class="text-sm font-bold">Program Tabungan</h2>
          <p class="text-[11px] text-muted-foreground">
            {data.programs.length} program aktif
          </p>
        </div>
        <a
          href="/master-data/saving-plans"
          class="text-[11px] font-medium text-primary hover:underline"
        >
          Lihat semua →
        </a>
      </div>

      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {#each data.programs as p (p.id)}
          {@const pct = programProgress(p)}
          {@const isGoal =
            p.savingType !== "FLEXIBLE" &&
            !!p.defaultTargetAmount &&
            p.studentCount > 0}
          <Card.Root>
            <Card.Content class="p-4">
              <div class="flex items-start justify-between gap-3">
                <div class="min-w-0 flex-1">
                  <p class="font-semibold text-sm truncate">{p.name}</p>
                  <p class="text-[10px] font-mono text-muted-foreground mt-0.5">
                    {p.code}
                  </p>
                </div>
                {#if isGoal}
                  <span
                    class="shrink-0 rounded-full bg-primary px-2.5 py-0.5 text-[11px] font-bold text-primary-foreground"
                  >
                    {Math.round(pct)}%
                  </span>
                {:else}
                  <span
                    class="shrink-0 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-600"
                  >
                    fleksibel
                  </span>
                {/if}
              </div>

              <div
                class="mt-2.5 flex items-center gap-2 text-[11px] text-muted-foreground"
              >
                <span
                  class="size-1.5 rounded-full shrink-0 {p.savingType ===
                  'FLEXIBLE'
                    ? 'bg-amber-500'
                    : 'bg-primary'}"
                ></span>
                <span>{p.studentCount} siswa</span>
                <span>·</span>
                {#if isGoal}
                  <span
                    >{fmtCompact(p.totalCollected)} / {fmtCompact(
                      p.defaultTargetAmount! * p.studentCount,
                    )}</span
                  >
                {:else}
                  <span class="font-semibold text-foreground"
                    >{fmtCompact(p.totalCollected)}</span
                  >
                {/if}
              </div>

              <div
                class="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-muted"
              >
                <div
                  class="h-full rounded-full bg-primary transition-all duration-500"
                  style="width: {isGoal ? pct : 0}%"
                ></div>
              </div>
            </Card.Content>
          </Card.Root>
        {/each}
      </div>
    </div>
  {/if}
</div>
