<script lang="ts">
	import type { PageData } from './$types';
	import { enhance } from '$app/forms';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import * as Field from '$lib/components/ui/field/index.js';
	import { Separator } from '$lib/components/ui/separator/index.js';
	import { HugeiconsIcon } from '@hugeicons/svelte';
	import {
		Search01Icon,
		Cancel01Icon,
		ArrowDown01Icon,
		PiggyBankIcon,
		File01Icon,
		Tick02Icon,
	} from '@hugeicons/core-free-icons';

	let { data }: { data: PageData } = $props();

	// ── Types ────────────────────────────────────────────
	type Student = { id: string; nis: string; name: string; class: string | null; gender: string | null };
	type Enrollment = {
		id: string; currentAmount: number; status: string;
		planId: string; planName: string; planCode: string; planType: string;
		defaultTargetAmount: number | null;
	};
	type RecentDeposit = {
		id: string; amount: number; type: string; isReversed: boolean;
		createdAt: string; planCode: string; planName: string;
	};

	// ── State ─────────────────────────────────────────────
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

	let recentDeposits = $state<RecentDeposit[]>([]);

	let amount = $state(0);
	const presets = [1_000, 2_000, 5_000, 10_000, 20_000, 50_000];

	let submitting = $state(false);
	let lastRefNo = $state('');
	let depositSuccess = $state(false);
	let depositError = $state('');

	// ── Derived ───────────────────────────────────────────
	const balanceBefore = $derived(selectedEnrollment?.currentAmount ?? 0);
	const balanceAfter = $derived(balanceBefore + (amount > 0 ? amount : 0));
	const canSubmit = $derived(!!selectedEnrollment && amount > 0 && !submitting);

	const now = new Date();
	const dateLabel = new Intl.DateTimeFormat('en-GB', {
		day: '2-digit', month: 'short', year: 'numeric',
		hour: '2-digit', minute: '2-digit',
	}).format(now);

	const fmt = (n: number) => 'Rp ' + new Intl.NumberFormat('id-ID').format(Math.round(n));

	function getInitials(name: string) {
		return name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase();
	}

	function txDateTime(iso: string): string {
		const d = new Date(iso);
		const today = new Date();
		const isToday = d.toDateString() === today.toDateString();
		if (isToday) {
			return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
		}
		return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) +
			' · ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
	}

	// ── Search logic ──────────────────────────────────────
	function onSearchInput() {
		if (searchTimeout) clearTimeout(searchTimeout);
		if (searchQuery.length < 2) { searchResults = []; searchOpen = false; return; }
		searchTimeout = setTimeout(async () => {
			searchLoading = true;
			try {
				const res = await fetch(`/api/students/search?q=${encodeURIComponent(searchQuery)}`);
				searchResults = await res.json();
				searchOpen = searchResults.length > 0;
			} finally {
				searchLoading = false;
			}
		}, 280);
	}

	async function selectStudent(s: Student) {
		selectedStudent = s;
		searchQuery = '';
		searchResults = [];
		searchOpen = false;
		selectedEnrollment = null;
		recentDeposits = [];
		await Promise.all([loadEnrollments(s.id), loadRecentDeposits(s.id)]);
	}

	function clearStudent() {
		selectedStudent = null;
		selectedEnrollment = null;
		enrollments = [];
		recentDeposits = [];
		amount = 0;
		depositSuccess = false;
		depositError = '';
	}

	// ── Enrollments ───────────────────────────────────────
	async function loadEnrollments(studentId: string) {
		enrollmentsLoading = true;
		try {
			const res = await fetch(`/api/students/${studentId}/enrollments`);
			enrollments = await res.json();
			// Sync selected enrollment balance if still selected
			if (selectedEnrollment) {
				const updated = enrollments.find((e) => e.id === selectedEnrollment!.id);
				if (updated) selectedEnrollment = updated;
			}
		} finally {
			enrollmentsLoading = false;
		}
	}

	function selectEnrollment(e: Enrollment) {
		selectedEnrollment = e;
		programOpen = false;
	}

	// ── Recent deposits ───────────────────────────────────
	async function loadRecentDeposits(studentId: string) {
		const res = await fetch(`/api/students/${studentId}/recent-deposits?type=DEPOSIT`);
		recentDeposits = await res.json();
	}

	// ── Form submit ───────────────────────────────────────
	const handleEnhance = () => {
		submitting = true;
		depositError = '';
		return async ({ result }: { result: { type: string; data?: Record<string, unknown> } }) => {
			submitting = false;
			if (result.type === 'success') {
				lastRefNo = String(result.data?.referenceNo ?? '');
				depositSuccess = true;
				amount = 0;
				if (selectedStudent) {
					await Promise.all([
						loadEnrollments(selectedStudent.id),
						loadRecentDeposits(selectedStudent.id),
					]);
				}
				setTimeout(() => { depositSuccess = false; }, 4000);
			} else if (result.type === 'failure') {
				depositError = String(result.data?.error ?? 'Failed to record deposit');
			}
		};
	};

	function reset() {
		amount = 0;
		depositSuccess = false;
		depositError = '';
	}
</script>

<svelte:head>
	<title>Deposits</title>
</svelte:head>

<div class="flex flex-col gap-6 flex-1">

	<!-- Header -->
	<div class="flex items-start justify-between">
		<div>
			<h1 class="text-2xl font-semibold tracking-tight">Deposits</h1>
			<p class="text-sm text-muted-foreground mt-1">
				Record student savings deposits to their
				<span class="text-primary font-medium">selected program</span>.
				Each entry is logged to the journal.
			</p>
		</div>
		<Button variant="outline" size="sm" class="gap-2 text-xs" href="/transactions/transaction-history">
			<HugeiconsIcon icon={File01Icon} size={14} />
			View History
		</Button>
	</div>

	<!-- Row 1: Form + Summary -->
	<div class="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-5 items-stretch">

		<!-- Form card -->
		<form method="POST" action="?/deposit" use:enhance={handleEnhance} class="rounded-xl border bg-card p-5 flex flex-col gap-5">
			<input type="hidden" name="studentSavingsId" value={selectedEnrollment?.id ?? ''} />
			<input type="hidden" name="amount" value={amount} />

			<div class="flex items-center gap-2.5">
				<span class="text-sm font-semibold">Deposit Form</span>
				<span class="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">draft</span>
				{#if depositSuccess}
					<span class="flex items-center gap-1 text-[10px] font-medium text-emerald-600">
						<HugeiconsIcon icon={Tick02Icon} size={11} /> saved · {lastRefNo}
					</span>
				{:else}
					<span class="text-[10px] text-muted-foreground">· unsaved</span>
				{/if}
			</div>

			{#if depositError}
				<div class="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
					{depositError}
				</div>
			{/if}

			<Separator />

			<!-- Student field -->
			<Field.Field class="space-y-1.5">
				<Field.Label class="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Student</Field.Label>
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
									placeholder="Search by NIS or name..."
									class="flex-1 bg-transparent py-2.5 text-sm outline-none placeholder:text-muted-foreground/60"
								/>
								{#if searchLoading}
									<span class="text-[10px] text-muted-foreground">searching…</span>
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
							{:else if searchQuery.length >= 2 && !searchLoading && searchOpen === false && searchResults.length === 0}
								<div class="absolute top-full left-0 right-0 z-50 mt-1 rounded-lg border bg-card shadow-lg px-3 py-3 text-sm text-muted-foreground">
									No students found.
								</div>
							{/if}
						</div>
					{/if}
				</Field.Content>
			</Field.Field>

			<!-- Savings Program field -->
			<Field.Field class="space-y-1.5">
				<Field.Label class="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Savings Program</Field.Label>
				<Field.Content>
					{#if !selectedStudent}
						<div class="flex items-center gap-3 rounded-lg border bg-muted/20 px-3 py-2.5 opacity-50">
							<span class="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted">
								<HugeiconsIcon icon={PiggyBankIcon} size={14} class="text-muted-foreground" />
							</span>
							<p class="text-sm text-muted-foreground">Select a student first</p>
						</div>
					{:else if enrollmentsLoading}
						<div class="flex items-center gap-3 rounded-lg border bg-muted/20 px-3 py-2.5">
							<p class="text-sm text-muted-foreground">Loading programs…</p>
						</div>
					{:else if enrollments.length === 0}
						<div class="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5">
							<span class="text-amber-600 text-sm">⚠</span>
							<p class="text-sm text-amber-700">Student is not enrolled in any active program.</p>
						</div>
					{:else if selectedEnrollment}
						<div class="relative">
							<button
								type="button"
								onclick={() => { programOpen = !programOpen; }}
								class="w-full flex items-center gap-3 rounded-lg border bg-muted/40 px-3 py-2.5 text-left hover:bg-muted/60 transition-colors"
							>
								<span class="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
									<HugeiconsIcon icon={PiggyBankIcon} size={14} class="text-primary" />
								</span>
								<div class="flex-1 min-w-0">
									<p class="text-sm font-semibold truncate">{selectedEnrollment.planName}</p>
									<p class="text-[11px] text-muted-foreground">
										{selectedEnrollment.planCode} · {selectedEnrollment.planType === 'FLEXIBLE' ? 'Flexible' : 'Goal'}
									</p>
								</div>
								<HugeiconsIcon icon={ArrowDown01Icon} size={14} class="text-muted-foreground shrink-0" />
							</button>
							{#if programOpen}
								<div class="absolute top-full left-0 right-0 z-50 mt-1 rounded-lg border bg-card shadow-lg overflow-hidden">
									{#each enrollments as e (e.id)}
										<button
											type="button"
											onclick={() => selectEnrollment(e)}
											class="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-muted/50 transition-colors text-left {e.id === selectedEnrollment?.id ? 'bg-muted/30' : ''}"
										>
											<div class="flex-1 min-w-0">
												<p class="text-sm font-medium truncate">{e.planName}</p>
												<p class="text-[11px] text-muted-foreground">{e.planCode} · Balance: {fmt(e.currentAmount)}</p>
											</div>
										</button>
									{/each}
								</div>
							{/if}
						</div>
					{:else}
						<!-- No program selected yet, show program picker -->
						<div class="relative">
							<button
								type="button"
								onclick={() => { programOpen = !programOpen; }}
								class="w-full flex items-center gap-3 rounded-lg border bg-muted/40 px-3 py-2.5 text-left hover:bg-muted/60 transition-colors"
							>
								<span class="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted">
									<HugeiconsIcon icon={PiggyBankIcon} size={14} class="text-muted-foreground" />
								</span>
								<p class="flex-1 text-sm text-muted-foreground">Select a savings program…</p>
								<HugeiconsIcon icon={ArrowDown01Icon} size={14} class="text-muted-foreground shrink-0" />
							</button>
							{#if programOpen}
								<div class="absolute top-full left-0 right-0 z-50 mt-1 rounded-lg border bg-card shadow-lg overflow-hidden">
									{#each enrollments as e (e.id)}
										<button
											type="button"
											onclick={() => selectEnrollment(e)}
											class="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-muted/50 transition-colors text-left"
										>
											<div class="flex-1 min-w-0">
												<p class="text-sm font-medium truncate">{e.planName}</p>
												<p class="text-[11px] text-muted-foreground">{e.planCode} · Balance: {fmt(e.currentAmount)}</p>
											</div>
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
				<Field.Label class="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Amount</Field.Label>
				<Field.Content>
					<div class="relative">
						<span class="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-foreground">Rp</span>
						<Input
							type="number"
							bind:value={amount}
							min={0}
							disabled={!selectedEnrollment}
							class="pl-10 pr-14 h-12 text-xl font-bold bg-muted/40 border disabled:opacity-40"
						/>
						<span class="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-muted-foreground">IDR</span>
					</div>
				</Field.Content>
				<div class="flex flex-wrap gap-1.5 pt-1">
					{#each presets as p}
						<button
							type="button"
							disabled={!selectedEnrollment}
							onclick={() => (amount = p)}
							class="text-[11px] font-semibold px-2.5 py-1 rounded-full border transition-all disabled:opacity-30 {amount === p ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted/50 text-muted-foreground hover:bg-muted border-transparent'}"
						>
							{new Intl.NumberFormat('id-ID').format(p)}
						</button>
					{/each}
				</div>
			</Field.Field>

			<div class="flex-1"></div>
			<Separator />

			<!-- Footer -->
			<div class="flex items-center justify-between">
				<p class="text-[11px] text-muted-foreground">
					Logged to <span class="font-medium text-foreground">journal entry</span> · audit trail active
				</p>
				<div class="flex items-center gap-2">
					<Button type="button" variant="ghost" size="sm" class="text-xs h-9" onclick={reset}>
						Reset
					</Button>
					<Button type="submit" size="sm" class="text-xs h-9 gap-1.5 font-semibold" disabled={!canSubmit}>
						{#if submitting}
							<span class="size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"></span>
							Recording…
						{:else}
							<HugeiconsIcon icon={ArrowDown01Icon} size={14} />
							Record Deposit
						{/if}
					</Button>
				</div>
			</div>
		</form>

		<!-- Summary card -->
		<div class="rounded-xl border bg-card p-5 flex flex-col gap-4">
			<p class="text-sm font-semibold">Summary</p>

			<div class="space-y-0.5">
				<p class="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Balance Before</p>
				<p class="text-2xl font-bold tracking-tight">{fmt(balanceBefore)}</p>
			</div>

			<div class="flex items-center gap-2">
				<div class="h-px flex-1 bg-border"></div>
				<HugeiconsIcon icon={ArrowDown01Icon} size={16} class="text-primary" />
				<div class="h-px flex-1 bg-border"></div>
			</div>

			<div class="space-y-0.5">
				<p class="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">+ Deposit</p>
				<p class="text-xl font-bold text-primary">+ {fmt(amount > 0 ? amount : 0)}</p>
			</div>

			<div class="rounded-lg bg-muted/50 px-4 py-3 space-y-0.5">
				<p class="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Balance After</p>
				<p class="text-2xl font-bold tracking-tight">{fmt(balanceAfter)}</p>
			</div>

			<div class="flex-1"></div>
			<Separator />

			<div class="space-y-2.5">
				{#each [
					{ label: 'Program', value: selectedEnrollment?.planCode ?? '—' },
					{ label: 'Date', value: dateLabel },
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

	<!-- Recent Deposits (shown only when student is selected) -->
	{#if selectedStudent}
		<div class="rounded-xl border bg-card p-5 space-y-3">
			<div class="flex items-center justify-between">
				<p class="text-sm font-semibold">Recent Deposits</p>
				<span class="text-[11px] text-muted-foreground">{selectedStudent.name}</span>
			</div>
			{#if recentDeposits.length === 0}
				<p class="py-4 text-center text-sm text-muted-foreground">No deposit history yet.</p>
			{:else}
				<div>
					{#each recentDeposits as tx, i (tx.id)}
						<div class="flex items-center justify-between py-2.5 {i < recentDeposits.length - 1 ? 'border-b border-border/50' : ''}">
							<div class="flex items-center gap-3 min-w-0 flex-1">
								<span class="text-[11px] text-muted-foreground tabular-nums shrink-0 w-[110px]">{txDateTime(tx.createdAt)}</span>
								<span class="text-[10px] font-mono font-bold text-muted-foreground bg-muted px-1.5 py-0.5 rounded shrink-0">{tx.planCode}</span>
								<span class="text-xs text-foreground font-semibold truncate max-w-[200px] md:max-w-[300px]">{tx.planName}</span>
								{#if tx.isReversed}
									<span class="text-[10px] text-amber-600 font-medium shrink-0">reversed</span>
								{/if}
							</div>
							<span class="text-xs font-bold tabular-nums {tx.isReversed ? 'text-muted-foreground line-through' : tx.type === 'DEPOSIT' ? 'text-primary' : 'text-red-600'}">
								{tx.type === 'DEPOSIT' ? '+ ' : '- '}{fmt(tx.amount)}
							</span>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	{/if}

</div>
