<script lang="ts">
	import type { PageData } from './$types';
	import { enhance } from '$app/forms';
	import Decimal from 'decimal.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import * as Field from '$lib/components/ui/field/index.js';
	import { Separator } from '$lib/components/ui/separator/index.js';
	import { HugeiconsIcon } from '@hugeicons/svelte';
	import {
		Search01Icon,
		Cancel01Icon,
		ArrowUp01Icon,
		PiggyBankIcon,
		File01Icon,
		Tick02Icon,
		ArrowDown01Icon,
		UserGroupIcon,
	} from '@hugeicons/core-free-icons';

	let { data }: { data: PageData } = $props();

	// ── Types ─────────────────────────────────────────────
	type Student = { id: string; nis: string; name: string; class: string | null; gender: string | null };
	type Enrollment = {
		id: string; currentAmount: number; status: string;
		planId: string; planName: string; planCode: string; planType: string;
		defaultTargetAmount: number | null;
	};
	type RecentTx = {
		id: string; amount: number; type: string; isReversed: boolean;
		createdAt: string; planCode: string; planName: string;
	};
	type Member = { id: string; name: string; nis: string; class: string | null; currentAmount: number };
	type DistRow = Member & { share: number; capped: boolean; balanceAfter: number };

	// ── Tab ───────────────────────────────────────────────
	let activeTab = $state<'individual' | 'bulk'>('individual');

	// ── Individual state ──────────────────────────────────
	let searchQuery = $state('');
	let searchResults = $state<Student[]>([]);
	let searchLoading = $state(false);
	let searchOpen = $state(false);
	let searchTimeout: ReturnType<typeof setTimeout> | null = null;

	let selectedStudent = $state<Student | null>(null);
	let enrollments = $state<Enrollment[]>([]);
	let enrollmentsLoading = $state(false);
	let selectedEnrollment = $state<Enrollment | null>(null);
	let programOpen = $state(false);

	let recentTx = $state<RecentTx[]>([]);
	let amount = $state(0);
	const presets = [1_000, 2_000, 5_000, 10_000, 20_000, 50_000];

	let submitting = $state(false);
	let lastRefNo = $state('');
	let withdrawSuccess = $state(false);
	let withdrawError = $state('');

	// ── Bulk state ────────────────────────────────────────
	let bulkPlanId = $state('');
	let bulkPlanOpen = $state(false);
	let bulkMembers = $state<Member[]>([]);
	let bulkMembersLoading = $state(false);
	let bulkAmount = $state(0);
	let bulkSubmitting = $state(false);
	let bulkSuccess = $state(false);
	let bulkError = $state('');
	let bulkLastRef = $state('');
	let bulkLastTotal = $state('');
	let bulkLastCount = $state(0);

	// ── Derived (individual) ──────────────────────────────
	const balanceBefore = $derived(selectedEnrollment?.currentAmount ?? 0);
	const balanceAfter = $derived(balanceBefore - (amount > 0 ? amount : 0));
	const isOverdrawn = $derived(balanceAfter < 0);
	const canSubmit = $derived(!!selectedEnrollment && amount > 0 && !isOverdrawn && !submitting);

	// ── Derived (bulk) ────────────────────────────────────
	const selectedPlan = $derived(data.plans.find((p) => p.id === bulkPlanId) ?? null);
	const totalPlanBalance = $derived(bulkMembers.reduce((s, m) => s + m.currentAmount, 0));

	function computeDistribution(total: number, members: Member[]): DistRow[] {
		if (total <= 0 || members.length === 0)
			return members.map((m) => ({ ...m, share: 0, capped: false, balanceAfter: m.currentAmount }));
		const t = new Decimal(total);
		const n = members.length;
		const base = t.divToInt(n);
		const rem = t.mod(n).toNumber();
		return members.map((m, i) => {
			const balance = new Decimal(m.currentAmount);
			let share = i < rem ? base.plus(1) : base;
			const capped = share.greaterThan(balance);
			if (capped) share = balance;
			return { ...m, share: share.toNumber(), capped, balanceAfter: balance.minus(share).toNumber() };
		});
	}

	const distribution = $derived(computeDistribution(bulkAmount, bulkMembers));
	const actualTotal = $derived(distribution.reduce((s, d) => s + d.share, 0));
	const cappedCount = $derived(distribution.filter((d) => d.capped).length);
	const bulkExceedsBalance = $derived(totalPlanBalance > 0 && bulkAmount > totalPlanBalance);
	const canBulkSubmit = $derived(
		!!bulkPlanId && bulkAmount > 0 && bulkMembers.length > 0 && !bulkSubmitting && !bulkExceedsBalance,
	);

	// ── Helpers ───────────────────────────────────────────
	const now = new Date();
	const dateLabel = new Intl.DateTimeFormat('en-GB', {
		day: '2-digit', month: 'short', year: 'numeric',
		hour: '2-digit', minute: '2-digit',
	}).format(now);

	const fmt = (n: number) => 'Rp ' + new Intl.NumberFormat('id-ID').format(Math.round(Math.abs(n)));
	function getInitials(name: string) {
		return name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase();
	}
	function txDateTime(iso: string): string {
		const d = new Date(iso);
		const today = new Date();
		if (d.toDateString() === today.toDateString())
			return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
		return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) +
			' · ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
	}

	// ── Individual: search ────────────────────────────────
	function onSearchInput() {
		if (searchTimeout) clearTimeout(searchTimeout);
		if (searchQuery.length < 2) { searchResults = []; searchOpen = false; return; }
		searchTimeout = setTimeout(async () => {
			searchLoading = true;
			try {
				const res = await fetch(`/api/students/search?q=${encodeURIComponent(searchQuery)}`);
				searchResults = await res.json();
				searchOpen = searchResults.length > 0;
			} finally { searchLoading = false; }
		}, 280);
	}

	async function selectStudent(s: Student) {
		selectedStudent = s;
		searchQuery = ''; searchResults = []; searchOpen = false;
		selectedEnrollment = null; recentTx = [];
		await Promise.all([loadEnrollments(s.id), loadRecentTx(s.id)]);
	}

	function clearStudent() {
		selectedStudent = null; selectedEnrollment = null;
		enrollments = []; recentTx = []; amount = 0;
		withdrawSuccess = false; withdrawError = '';
	}

	async function loadEnrollments(studentId: string) {
		enrollmentsLoading = true;
		try {
			const res = await fetch(`/api/students/${studentId}/enrollments`);
			const all: Enrollment[] = await res.json();
			enrollments = all.filter((e) => e.currentAmount > 0);
			if (selectedEnrollment) {
				const updated = enrollments.find((e) => e.id === selectedEnrollment!.id);
				selectedEnrollment = updated ?? null;
			}
		} finally { enrollmentsLoading = false; }
	}

	function selectEnrollment(e: Enrollment) {
		selectedEnrollment = e; programOpen = false;
		if (amount > e.currentAmount) amount = 0;
	}

	async function loadRecentTx(studentId: string) {
		const res = await fetch(`/api/students/${studentId}/recent-deposits?type=WITHDRAW`);
		recentTx = await res.json();
	}

	const handleEnhance = () => {
		submitting = true; withdrawError = '';
		return async ({ result }: { result: { type: string; data?: Record<string, unknown> } }) => {
			submitting = false;
			if (result.type === 'success') {
				lastRefNo = String(result.data?.referenceNo ?? '');
				withdrawSuccess = true; amount = 0;
				if (selectedStudent)
					await Promise.all([loadEnrollments(selectedStudent.id), loadRecentTx(selectedStudent.id)]);
				setTimeout(() => { withdrawSuccess = false; }, 4000);
			} else if (result.type === 'failure') {
				withdrawError = String(result.data?.error ?? 'Gagal memproses penarikan');
			}
		};
	};

	function reset() { amount = 0; withdrawSuccess = false; withdrawError = ''; }

	// ── Bulk: plan & members ──────────────────────────────
	async function selectBulkPlan(id: string) {
		bulkPlanId = id; bulkPlanOpen = false;
		bulkMembers = []; bulkAmount = 0; bulkError = ''; bulkSuccess = false;
		bulkMembersLoading = true;
		try {
			const res = await fetch(`/api/saving-plans/${id}/members`);
			bulkMembers = await res.json();
		} finally { bulkMembersLoading = false; }
	}

	const handleBulkEnhance = () => {
		bulkSubmitting = true; bulkError = '';
		return async ({ result }: { result: { type: string; data?: Record<string, unknown> } }) => {
			bulkSubmitting = false;
			if (result.type === 'success') {
				bulkLastRef = String(result.data?.referenceNo ?? '');
				bulkLastTotal = String(result.data?.actualTotal ?? '0');
				bulkLastCount = Number(result.data?.processedCount ?? 0);
				bulkSuccess = true; bulkAmount = 0;
				if (bulkPlanId) {
					bulkMembersLoading = true;
					try {
						const res = await fetch(`/api/saving-plans/${bulkPlanId}/members`);
						bulkMembers = await res.json();
					} finally { bulkMembersLoading = false; }
				}
				setTimeout(() => { bulkSuccess = false; }, 5000);
			} else if (result.type === 'failure') {
				bulkError = String(result.data?.error ?? 'Gagal memproses penarikan massal');
			}
		};
	};

	function resetBulk() { bulkAmount = 0; bulkSuccess = false; bulkError = ''; }
</script>

<svelte:head>
	<title>Penarikan</title>
</svelte:head>

<div class="flex flex-col gap-6 flex-1">

	<!-- Header -->
	<div class="flex items-start justify-between">
		<div>
			<h1 class="text-2xl font-semibold tracking-tight">Penarikan</h1>
			<p class="text-sm text-muted-foreground mt-1">
				Proses penarikan tabungan siswa — pengembalian,
				<span class="text-primary font-medium">surplus SPP</span>, atau pencairan tujuan.
			</p>
		</div>
		<Button variant="outline" size="sm" class="gap-2 text-xs" href="/transactions/transaction-history">
			<HugeiconsIcon icon={File01Icon} size={14} />
			Lihat Riwayat
		</Button>
	</div>

	<!-- Tabs -->
	<div class="flex gap-0.5 rounded-lg border bg-muted/30 p-0.5 w-fit">
		{#each [{ key: 'individual', label: 'Individual' }, { key: 'bulk', label: 'Per Program Tabungan' }] as tab}
			<button
				onclick={() => (activeTab = tab.key as 'individual' | 'bulk')}
				class="rounded px-4 py-1.5 text-xs font-semibold transition-colors {activeTab === tab.key
					? 'bg-background text-foreground shadow-sm'
					: 'text-muted-foreground hover:text-foreground'}"
			>
				{tab.label}
			</button>
		{/each}
	</div>

	<!-- ══════════════════════════════════════════════════════ -->
	<!-- TAB: PER SISWA -->
	<!-- ══════════════════════════════════════════════════════ -->
	{#if activeTab === 'individual'}
	<div class="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-5 items-stretch">

		<!-- Form card -->
		<form
			method="POST"
			action="?/withdraw"
			use:enhance={handleEnhance}
			onsubmit={(e) => { if (!canSubmit) e.preventDefault(); }}
			class="rounded-xl border bg-card p-5 flex flex-col gap-5"
		>
			<input type="hidden" name="studentSavingsId" value={selectedEnrollment?.id ?? ''} />
			<input type="hidden" name="amount" value={amount} />

			<div class="flex items-center gap-2.5">
				<span class="text-sm font-semibold">Form Penarikan</span>
				<span class="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">draft</span>
				{#if withdrawSuccess}
					<span class="flex items-center gap-1 text-[10px] font-medium text-emerald-600">
						<HugeiconsIcon icon={Tick02Icon} size={11} /> saved · {lastRefNo}
					</span>
				{:else}
					<span class="text-[10px] text-muted-foreground">· unsaved</span>
				{/if}
			</div>

			{#if withdrawError}
				<div class="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
					{withdrawError}
				</div>
			{/if}

			<Separator />

			<!-- Student field -->
			<Field.Field class="space-y-1.5">
				<Field.Label class="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Siswa</Field.Label>
				<Field.Content>
					{#if selectedStudent}
						<div class="flex items-center gap-3 rounded-lg border bg-muted/40 px-3 py-2.5">
							<span class="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
								{getInitials(selectedStudent.name)}
							</span>
							<div class="flex-1 min-w-0">
								<p class="text-sm font-semibold truncate">{selectedStudent.name}</p>
								<p class="text-[11px] text-muted-foreground">
									{selectedStudent.nis}{selectedStudent.class ? ' · ' + selectedStudent.class : ''}
								</p>
							</div>
							<button type="button" onclick={clearStudent} class="rounded p-1 hover:bg-muted transition-colors">
								<HugeiconsIcon icon={Cancel01Icon} size={14} class="text-muted-foreground" />
							</button>
						</div>
					{:else}
						<div class="relative">
							<div class="flex items-center rounded-lg border bg-muted/40 px-3 gap-2 focus-within:ring-2 focus-within:ring-ring">
								<HugeiconsIcon icon={Search01Icon} size={14} class="text-muted-foreground shrink-0" />
								<input
									type="text"
									bind:value={searchQuery}
									oninput={onSearchInput}
									onfocus={() => { if (searchResults.length > 0) searchOpen = true; }}
									onblur={() => setTimeout(() => { searchOpen = false; }, 150)}
									placeholder="Cari berdasarkan NIS atau nama..."
									class="flex-1 bg-transparent py-2.5 text-sm outline-none placeholder:text-muted-foreground/60"
								/>
								{#if searchLoading}
									<span class="text-[10px] text-muted-foreground">mencari…</span>
								{/if}
							</div>
							{#if searchOpen && searchResults.length > 0}
								<div class="absolute top-full left-0 right-0 z-50 mt-1 rounded-lg border bg-card shadow-lg overflow-hidden">
									{#each searchResults as s (s.id)}
										<button
											type="button"
											onmousedown={() => selectStudent(s)}
											class="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-muted/50 transition-colors text-left"
										>
											<span class="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
												{getInitials(s.name)}
											</span>
											<div class="flex-1 min-w-0">
												<p class="text-sm font-medium truncate">{s.name}</p>
												<p class="text-[11px] text-muted-foreground">{s.nis}{s.class ? ' · ' + s.class : ''}</p>
											</div>
										</button>
									{/each}
								</div>
							{/if}
						</div>
					{/if}
				</Field.Content>
			</Field.Field>

			<!-- Savings Program field -->
			<Field.Field class="space-y-1.5">
				<Field.Label class="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Program Tabungan</Field.Label>
				<Field.Content>
					{#if !selectedStudent}
						<div class="flex items-center gap-3 rounded-lg border bg-muted/20 px-3 py-2.5 opacity-50">
							<span class="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted">
								<HugeiconsIcon icon={PiggyBankIcon} size={14} class="text-muted-foreground" />
							</span>
							<p class="text-sm text-muted-foreground">Pilih siswa terlebih dahulu</p>
						</div>
					{:else if enrollmentsLoading}
						<div class="flex items-center gap-3 rounded-lg border bg-muted/20 px-3 py-2.5">
							<p class="text-sm text-muted-foreground">Memuat program…</p>
						</div>
					{:else if enrollments.length === 0}
						<div class="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5">
							<span class="text-amber-600 text-sm">⚠</span>
							<p class="text-sm text-amber-700">Tidak ada program dengan saldo tersedia untuk ditarik.</p>
						</div>
					{:else}
						<div class="relative">
							<button
								type="button"
								onclick={() => { programOpen = !programOpen; }}
								class="w-full flex items-center gap-3 rounded-lg border bg-muted/40 px-3 py-2.5 text-left hover:bg-muted/60 transition-colors"
							>
								<span class="flex size-8 shrink-0 items-center justify-center rounded-lg {selectedEnrollment ? 'bg-primary/10' : 'bg-muted'}">
									<HugeiconsIcon icon={PiggyBankIcon} size={14} class={selectedEnrollment ? 'text-primary' : 'text-muted-foreground'} />
								</span>
								{#if selectedEnrollment}
									<div class="flex-1 min-w-0">
										<p class="text-sm font-semibold truncate">{selectedEnrollment.planName}</p>
										<p class="text-[11px] text-muted-foreground">
											{selectedEnrollment.planCode} · Saldo: {fmt(selectedEnrollment.currentAmount)}
										</p>
									</div>
								{:else}
									<p class="flex-1 text-sm text-muted-foreground">Pilih program tabungan…</p>
								{/if}
								<HugeiconsIcon icon={ArrowDown01Icon} size={14} class="text-muted-foreground shrink-0" />
							</button>
							{#if programOpen}
								<div class="absolute top-full left-0 right-0 z-50 mt-1 rounded-lg border bg-card shadow-lg overflow-hidden">
									{#each enrollments as e (e.id)}
										<button
											type="button"
											onclick={() => selectEnrollment(e)}
											class="w-full flex items-center justify-between px-3 py-2.5 hover:bg-muted/50 transition-colors text-left {e.id === selectedEnrollment?.id ? 'bg-muted/30' : ''}"
										>
											<div class="min-w-0">
												<p class="text-sm font-medium truncate">{e.planName}</p>
												<p class="text-[11px] text-muted-foreground">{e.planCode}</p>
											</div>
											<span class="text-xs font-semibold text-emerald-700 shrink-0 ml-3">{fmt(e.currentAmount)}</span>
										</button>
									{/each}
								</div>
							{/if}
						</div>
					{/if}
				</Field.Content>
			</Field.Field>

			<!-- Amount field -->
			<Field.Field class="space-y-1.5">
				<Field.Label class="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Jumlah</Field.Label>
				<Field.Content>
					<div class="relative">
						<span class="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-foreground">Rp</span>
						<Input
							type="number"
							bind:value={amount}
							min={0}
							max={selectedEnrollment?.currentAmount ?? undefined}
							disabled={!selectedEnrollment}
							class="pl-10 pr-14 h-12 text-xl font-bold bg-muted/40 border disabled:opacity-40 {isOverdrawn ? 'border-destructive focus-visible:ring-destructive' : ''}"
						/>
						<span class="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-muted-foreground">IDR</span>
					</div>
					{#if isOverdrawn && amount > 0}
						<p class="text-[11px] text-destructive font-medium mt-1">
							Melebihi saldo tersedia sebesar {fmt(amount - balanceBefore)}.
						</p>
					{/if}
					{#if selectedEnrollment}
						<p class="text-[11px] text-muted-foreground mt-1">
							Tersedia: <span class="font-semibold text-foreground">{fmt(balanceBefore)}</span>
						</p>
					{/if}
				</Field.Content>
				<div class="flex flex-wrap gap-1.5 pt-1">
					{#each presets as p}
						<button
							type="button"
							disabled={!selectedEnrollment || p > balanceBefore}
							onclick={() => (amount = p)}
							class="text-[11px] font-semibold px-2.5 py-1 rounded-full border transition-all disabled:opacity-30 {amount === p ? 'bg-destructive text-destructive-foreground border-destructive' : 'bg-muted/50 text-muted-foreground hover:bg-muted border-transparent'}"
						>
							{new Intl.NumberFormat('id-ID').format(p)}
						</button>
					{/each}
					{#if selectedEnrollment && balanceBefore > 0}
						<button
							type="button"
							onclick={() => (amount = balanceBefore)}
							class="text-[11px] font-bold px-3 py-1 rounded-full border transition-all {amount === balanceBefore ? 'bg-destructive text-destructive-foreground border-destructive' : 'bg-amber-100 hover:bg-amber-200 text-amber-800 border-transparent'}"
						>
							Maks ({new Intl.NumberFormat('id-ID').format(balanceBefore)})
						</button>
					{/if}
				</div>
			</Field.Field>

			<div class="flex-1"></div>
			<Separator />

			<div class="flex items-center justify-between">
				<p class="text-[11px] text-muted-foreground">
					Dicatat ke <span class="font-medium text-foreground">entri jurnal</span> · jejak audit aktif
				</p>
				<div class="flex items-center gap-2">
					<Button type="button" variant="ghost" size="sm" class="text-xs h-9" onclick={reset}>Atur Ulang</Button>
					<Button type="submit" size="sm" variant="destructive" class="text-xs h-9 gap-1.5 font-semibold" disabled={!canSubmit}>
						{#if submitting}
							<span class="size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"></span>
							Memproses…
						{:else}
							<HugeiconsIcon icon={ArrowUp01Icon} size={14} />
							Proses Penarikan
						{/if}
					</Button>
				</div>
			</div>
		</form>

		<!-- Summary card -->
		<div class="rounded-xl border bg-card p-5 flex flex-col gap-4">
			<p class="text-sm font-semibold">Ringkasan</p>
			<div class="space-y-0.5">
				<p class="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Saldo Tersedia</p>
				<p class="text-2xl font-bold tracking-tight">{fmt(balanceBefore)}</p>
			</div>
			<div class="flex items-center gap-2">
				<div class="h-px flex-1 bg-border"></div>
				<HugeiconsIcon icon={ArrowUp01Icon} size={16} class="text-destructive" />
				<div class="h-px flex-1 bg-border"></div>
			</div>
			<div class="space-y-0.5">
				<p class="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">− Penarikan</p>
				<p class="text-xl font-bold text-destructive">− {fmt(amount > 0 ? amount : 0)}</p>
			</div>
			<div class="rounded-lg px-4 py-3 space-y-0.5 {isOverdrawn ? 'bg-destructive/10 border border-destructive/20' : 'bg-muted/50'}">
				<p class="text-[10px] font-bold uppercase tracking-widest {isOverdrawn ? 'text-destructive' : 'text-muted-foreground'}">Saldo Setelah</p>
				<p class="text-2xl font-bold tracking-tight {isOverdrawn ? 'text-destructive' : ''}">
					{isOverdrawn ? '−' : ''}{fmt(balanceAfter)}
				</p>
				{#if isOverdrawn}
					<p class="text-[10px] text-destructive font-medium">Saldo tidak mencukupi</p>
				{/if}
			</div>
			<div class="flex-1"></div>
			<Separator />
			<div class="space-y-2.5">
				{#each [
					{ label: 'Program', value: selectedEnrollment?.planCode ?? '—' },
					{ label: 'Tanggal', value: dateLabel },
					{ label: 'Operator', value: data.user?.name ?? '—' },
				] as row}
					<div class="flex items-center justify-between">
						<span class="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{row.label}</span>
						<span class="text-xs font-semibold">{row.value}</span>
					</div>
				{/each}
			</div>
		</div>
	</div>

	<!-- Recent Withdrawals -->
	{#if selectedStudent}
		<div class="rounded-xl border bg-card p-5 space-y-3">
			<div class="flex items-center justify-between">
				<p class="text-sm font-semibold">Penarikan Terbaru</p>
				<span class="text-[11px] text-muted-foreground">{selectedStudent.name}</span>
			</div>
			{#if recentTx.length === 0}
				<p class="py-4 text-center text-sm text-muted-foreground">Belum ada riwayat penarikan.</p>
			{:else}
				<div>
					{#each recentTx as tx, i (tx.id)}
						<div class="flex items-center justify-between py-2.5 {i < recentTx.length - 1 ? 'border-b border-border/50' : ''}">
							<div class="flex items-center gap-3 min-w-0 flex-1">
								<span class="text-[11px] text-muted-foreground tabular-nums shrink-0 w-[110px]">{txDateTime(tx.createdAt)}</span>
								<span class="text-[10px] font-mono font-bold text-muted-foreground bg-muted px-1.5 py-0.5 rounded shrink-0">{tx.planCode}</span>
								<span class="text-xs text-foreground font-semibold truncate max-w-[200px] md:max-w-[300px]">{tx.planName}</span>
								{#if tx.isReversed}
									<span class="text-[10px] text-amber-600 font-medium shrink-0">dibatalkan</span>
								{/if}
							</div>
							<span class="text-xs font-bold tabular-nums {tx.isReversed ? 'text-muted-foreground line-through' : 'text-destructive'}">
								− {fmt(tx.amount)}
							</span>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	{/if}
	{/if}

	<!-- ══════════════════════════════════════════════════════ -->
	<!-- TAB: PER SAVING PLAN -->
	<!-- ══════════════════════════════════════════════════════ -->
	{#if activeTab === 'bulk'}
	<div class="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-5 items-stretch">

		<!-- Bulk form card -->
		<form
			method="POST"
			action="?/bulkWithdraw"
			use:enhance={handleBulkEnhance}
			onsubmit={(e) => { if (!canBulkSubmit) e.preventDefault(); }}
			class="rounded-xl border bg-card p-5 flex flex-col gap-5"
		>
			<input type="hidden" name="savingPlanId" value={bulkPlanId} />
			<input type="hidden" name="totalAmount" value={bulkAmount} />

			<div class="flex items-center gap-2.5">
				<HugeiconsIcon icon={UserGroupIcon} size={15} class="text-muted-foreground" />
				<span class="text-sm font-semibold">Penarikan Massal</span>
				{#if bulkSuccess}
					<span class="flex items-center gap-1 text-[10px] font-medium text-emerald-600">
						<HugeiconsIcon icon={Tick02Icon} size={11} />
						{bulkLastCount} siswa · {fmt(Number(bulkLastTotal))} · {bulkLastRef}
					</span>
				{/if}
			</div>

			{#if bulkError}
				<div class="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
					{bulkError}
				</div>
			{/if}

			<Separator />

			<!-- Saving Plan selector -->
			<Field.Field class="space-y-1.5">
				<Field.Label class="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Program Tabungan</Field.Label>
				<Field.Content>
					<div class="relative">
						<button
							type="button"
							onclick={() => { bulkPlanOpen = !bulkPlanOpen; }}
							class="w-full flex items-center gap-3 rounded-lg border bg-muted/40 px-3 py-2.5 text-left hover:bg-muted/60 transition-colors"
						>
							<span class="flex size-8 shrink-0 items-center justify-center rounded-lg {selectedPlan ? 'bg-primary/10' : 'bg-muted'}">
								<HugeiconsIcon icon={PiggyBankIcon} size={14} class={selectedPlan ? 'text-primary' : 'text-muted-foreground'} />
							</span>
							{#if selectedPlan}
								<div class="flex-1 min-w-0">
									<p class="text-sm font-semibold truncate">{selectedPlan.name}</p>
									<p class="text-[11px] text-muted-foreground">{selectedPlan.code}</p>
								</div>
							{:else}
								<p class="flex-1 text-sm text-muted-foreground">Pilih program tabungan…</p>
							{/if}
							<HugeiconsIcon icon={ArrowDown01Icon} size={14} class="text-muted-foreground shrink-0" />
						</button>
						{#if bulkPlanOpen}
							<div class="absolute top-full left-0 right-0 z-50 mt-1 rounded-lg border bg-card shadow-lg overflow-hidden max-h-56 overflow-y-auto">
								{#each data.plans as p (p.id)}
									<button
										type="button"
										onclick={() => selectBulkPlan(p.id)}
										class="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-muted/50 transition-colors text-left {p.id === bulkPlanId ? 'bg-muted/30' : ''}"
									>
										<div class="flex-1 min-w-0">
											<p class="text-sm font-medium truncate">{p.name}</p>
											<p class="text-[11px] text-muted-foreground font-mono">{p.code}</p>
										</div>
									</button>
								{/each}
							</div>
						{/if}
					</div>
				</Field.Content>
			</Field.Field>

			<!-- Amount field -->
			<Field.Field class="space-y-1.5">
				<Field.Label class="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Total Jumlah</Field.Label>
				<Field.Content>
					<div class="relative">
						<span class="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-foreground">Rp</span>
						<Input
							type="number"
							bind:value={bulkAmount}
							min={0}
							max={totalPlanBalance > 0 ? totalPlanBalance : undefined}
							step={1}
							disabled={!bulkPlanId || bulkMembersLoading}
							class="w-full pl-10 pr-14 h-12 text-xl font-bold bg-muted/40 border disabled:opacity-40 {bulkExceedsBalance ? 'border-destructive focus-visible:ring-destructive' : ''}"
						/>
						<span class="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-muted-foreground">IDR</span>
					</div>
					{#if bulkPlanId && !bulkMembersLoading}
						<p class="text-[11px] text-muted-foreground mt-1">
							Total saldo program: <span class="font-semibold text-foreground">{fmt(totalPlanBalance)}</span>
							· {bulkMembers.length} siswa
						</p>
					{/if}
					{#if bulkAmount > totalPlanBalance && totalPlanBalance > 0}
						<p class="text-[11px] text-destructive font-medium mt-1">
							Melebihi total saldo program. Jumlah akan disesuaikan dengan dana yang tersedia.
						</p>
					{/if}
				</Field.Content>
				{#if bulkPlanId}
					<div class="flex flex-wrap gap-1.5 pt-1">
						{#each presets as p}
							<button
								type="button"
								disabled={!bulkPlanId || bulkMembersLoading}
								onclick={() => (bulkAmount = p)}
								class="text-[11px] font-semibold px-2.5 py-1 rounded-full border transition-all disabled:opacity-30 {bulkAmount === p ? 'bg-destructive text-destructive-foreground border-destructive' : 'bg-muted/50 text-muted-foreground hover:bg-muted border-transparent'}"
							>
								{new Intl.NumberFormat('id-ID').format(p)}
							</button>
						{/each}
					</div>
				{/if}
			</Field.Field>

			<!-- Distribution preview -->
			{#if bulkPlanId && bulkAmount > 0 && bulkMembers.length > 0}
				<div class="space-y-2">
					<div class="flex items-center justify-between">
						<p class="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Distribusi</p>
						{#if cappedCount > 0}
							<span class="text-[10px] font-medium text-amber-600">
								⚠ {cappedCount} siswa memiliki saldo tidak mencukupi
							</span>
						{/if}
					</div>
					<div class="rounded-lg border overflow-hidden">
						<table class="w-full text-xs">
							<thead>
								<tr class="bg-muted/50 border-b">
									<th class="px-3 py-2 text-left font-semibold text-muted-foreground">Siswa</th>
									<th class="px-3 py-2 text-right font-semibold text-muted-foreground">Saldo</th>
									<th class="px-3 py-2 text-right font-semibold text-muted-foreground">Ditarik</th>
									<th class="px-3 py-2 text-right font-semibold text-muted-foreground">Setelah</th>
								</tr>
							</thead>
							<tbody class="divide-y">
								{#each distribution as row (row.id)}
									<tr class="{row.capped ? 'bg-amber-50' : ''}">
										<td class="px-3 py-2">
											<p class="font-medium truncate max-w-[120px]">{row.name}</p>
											<p class="text-[10px] text-muted-foreground">{row.nis}</p>
										</td>
										<td class="px-3 py-2 text-right tabular-nums text-muted-foreground">{fmt(row.currentAmount)}</td>
										<td class="px-3 py-2 text-right tabular-nums font-semibold text-destructive">
											{fmt(row.share)}
											{#if row.capped}
												<span class="text-[9px] text-amber-600 ml-1">maks</span>
											{/if}
										</td>
										<td class="px-3 py-2 text-right tabular-nums {row.balanceAfter === 0 ? 'text-muted-foreground' : ''}">
											{fmt(row.balanceAfter)}
										</td>
									</tr>
								{/each}
							</tbody>
							<tfoot>
								<tr class="bg-muted/30 border-t font-semibold">
									<td class="px-3 py-2 text-muted-foreground">{distribution.length} siswa</td>
									<td class="px-3 py-2 text-right tabular-nums text-muted-foreground">{fmt(totalPlanBalance)}</td>
									<td class="px-3 py-2 text-right tabular-nums text-destructive">
										{fmt(actualTotal)}
										{#if actualTotal < bulkAmount}
											<span class="text-[9px] text-amber-600 ml-1">↓ dari {fmt(bulkAmount)}</span>
										{/if}
									</td>
									<td class="px-3 py-2 text-right tabular-nums">{fmt(totalPlanBalance - actualTotal)}</td>
								</tr>
							</tfoot>
						</table>
					</div>
				</div>
			{:else if bulkMembersLoading}
				<div class="flex items-center gap-2 py-4 text-sm text-muted-foreground">
					<span class="size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"></span>
					Memuat siswa…
				</div>
			{:else if bulkPlanId && bulkMembers.length === 0 && !bulkMembersLoading}
				<div class="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-700">
					Tidak ada siswa dengan saldo di program ini.
				</div>
			{/if}

			<div class="flex-1"></div>
			<Separator />

			<div class="flex items-center justify-between">
				<p class="text-[11px] text-muted-foreground">
					Setiap siswa dicatat sebagai <span class="font-medium text-foreground">entri terpisah</span>
				</p>
				<div class="flex items-center gap-2">
					<Button type="button" variant="ghost" size="sm" class="text-xs h-9" onclick={resetBulk}>Atur Ulang</Button>
					<Button type="submit" size="sm" variant="destructive" class="text-xs h-9 gap-1.5 font-semibold" disabled={!canBulkSubmit}>
						{#if bulkSubmitting}
							<span class="size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"></span>
							Memproses…
						{:else}
							<HugeiconsIcon icon={ArrowUp01Icon} size={14} />
							Proses Penarikan Massal
						{/if}
					</Button>
				</div>
			</div>
		</form>

		<!-- Bulk summary card -->
		<div class="rounded-xl border bg-card p-5 flex flex-col gap-4">
			<p class="text-sm font-semibold">Ringkasan</p>

			<div class="space-y-0.5">
				<p class="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Total Saldo Program</p>
				<p class="text-2xl font-bold tracking-tight">{fmt(totalPlanBalance)}</p>
			</div>

			<div class="space-y-0.5">
				<p class="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Total Siswa</p>
				<p class="text-xl font-bold">{bulkMembers.length} <span class="text-sm font-normal text-muted-foreground">siswa</span></p>
			</div>

			<div class="flex items-center gap-2">
				<div class="h-px flex-1 bg-border"></div>
				<HugeiconsIcon icon={ArrowUp01Icon} size={16} class="text-destructive" />
				<div class="h-px flex-1 bg-border"></div>
			</div>

			<div class="space-y-0.5">
				<p class="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Diminta</p>
				{#if bulkAmount > 0}
					<p class="text-xl font-bold text-destructive">− {fmt(bulkAmount)}</p>
				{:else}
					<p class="text-xl font-bold text-muted-foreground/40">—</p>
				{/if}
			</div>

			{#if bulkAmount > 0 && actualTotal !== bulkAmount && bulkMembers.length > 0}
				<div class="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2.5 space-y-0.5">
					<p class="text-[10px] font-bold uppercase tracking-widest text-amber-700">Aktual Ditarik</p>
					<p class="text-lg font-bold text-amber-700">− {fmt(actualTotal)}</p>
					<p class="text-[10px] text-amber-600">{cappedCount} siswa memiliki saldo tidak mencukupi</p>
				</div>
			{/if}

			<div class="flex-1"></div>
			<Separator />

			<div class="space-y-2.5">
				{#each [
					{ label: 'Program', value: selectedPlan?.code ?? '—' },
					{ label: 'Tanggal', value: dateLabel },
					{ label: 'Operator', value: data.user?.name ?? '—' },
				] as row}
					<div class="flex items-center justify-between">
						<span class="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{row.label}</span>
						<span class="text-xs font-semibold">{row.value}</span>
					</div>
				{/each}
			</div>
		</div>
	</div>
	{/if}

</div>
