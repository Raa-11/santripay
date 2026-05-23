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

	// Terima data dari server (user yang sedang login)
	let { data }: { data: PageData } = $props();

	// Tipe data siswa yang dicari via pencarian
	type Student = { id: string; nis: string; name: string; class: string | null; gender: string | null };
	// Tipe data rekening tabungan santri di program tertentu
	type Enrollment = {
		id: string; currentAmount: number; status: string;
		planId: string; planName: string; planCode: string; planType: string;
		defaultTargetAmount: number | null;
	};
	// Tipe data riwayat setoran terbaru
	type RecentDeposit = {
		id: string; amount: number; type: string; isReversed: boolean;
		createdAt: string; planCode: string; planName: string;
	};

	// State untuk kotak pencarian siswa
	let searchQuery = $state('');           // Isi teks pencarian
	let searchResults = $state<Student[]>([]); // Hasil siswa yang cocok
	let searchLoading = $state(false);      // Sedang loading hasil pencarian
	let searchOpen = $state(false);         // Dropdown hasil pencarian terbuka/tertutup
	let searchTimeout: ReturnType<typeof setTimeout> | null = null; // Timeout debounce pencarian

	let selectedStudent = $state<Student | null>(null);     // Siswa yang sudah dipilih
	let enrollments = $state<Enrollment[]>([]);             // Daftar program tabungan siswa terpilih
	let enrollmentsLoading = $state(false);                 // Sedang memuat daftar program
	let selectedEnrollment = $state<Enrollment | null>(null); // Program tabungan yang dipilih
	let programOpen = $state(false);                        // Dropdown program terbuka/tertutup

	let recentDeposits = $state<RecentDeposit[]>([]); // Daftar setoran terbaru siswa terpilih

	let amount = $state(0); // Nominal setoran yang diinput
	const presets = [1_000, 2_000, 5_000, 10_000, 20_000, 50_000]; // Tombol preset nominal cepat

	let submitting = $state(false);    // Sedang mengirim form ke server
	let lastRefNo = $state('');        // Nomor referensi transaksi terakhir yang berhasil
	let depositSuccess = $state(false); // Status apakah setoran baru saja sukses
	let depositError = $state('');      // Pesan error jika setoran gagal

	// Saldo sebelum setoran (diambil dari rekening yang dipilih)
	const balanceBefore = $derived(selectedEnrollment?.currentAmount ?? 0);
	// Saldo setelah setoran (saldo lama + nominal setoran)
	const balanceAfter = $derived(balanceBefore + (amount > 0 ? amount : 0));
	// Tombol submit aktif hanya jika program dipilih, nominal > 0, dan tidak sedang submit
	const canSubmit = $derived(!!selectedEnrollment && amount > 0 && !submitting);

	// Label tanggal dan jam saat ini untuk ditampilkan di ringkasan transaksi
	const now = new Date();
	const dateLabel = new Intl.DateTimeFormat('en-GB', {
		day: '2-digit', month: 'short', year: 'numeric',
		hour: '2-digit', minute: '2-digit',
	}).format(now);

	// Format angka ke Rupiah (Contoh: Rp 50.000)
	const fmt = (n: number) => 'Rp ' + new Intl.NumberFormat('id-ID').format(Math.round(n));

	// Ambil inisial nama siswa (Contoh: "Budi Santoso" → "BS")
	function getInitials(name: string) {
		return name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase();
	}

	// Format waktu: kalau transaksi hari ini tampil jam saja, kalau beda hari tampil tanggal + jam
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

	// Fungsi pencarian siswa dengan debounce 280ms (biar tidak terlalu sering hit API)
	function onSearchInput() {
		if (searchTimeout) clearTimeout(searchTimeout); // Batalkan pencarian sebelumnya
		if (searchQuery.length < 2) { searchResults = []; searchOpen = false; return; } // Minimal 2 karakter
		searchTimeout = setTimeout(async () => {
			searchLoading = true;
			try {
				// Hit API pencarian siswa
				const res = await fetch(`/api/students/search?q=${encodeURIComponent(searchQuery)}`);
				searchResults = await res.json();
				searchOpen = searchResults.length > 0; // Buka dropdown kalau ada hasil
			} finally {
				searchLoading = false;
			}
		}, 280);
	}

	// Ketika siswa dipilih dari dropdown: simpan datanya, kosongkan pencarian, lalu muat rekening & riwayat
	async function selectStudent(s: Student) {
		selectedStudent = s;
		searchQuery = '';
		searchResults = [];
		searchOpen = false;
		selectedEnrollment = null;
		recentDeposits = [];
		await Promise.all([loadEnrollments(s.id), loadRecentDeposits(s.id)]);
	}

	// Reset semua state kalau siswa dihapus dari pilihan
	function clearStudent() {
		selectedStudent = null;
		selectedEnrollment = null;
		enrollments = [];
		recentDeposits = [];
		amount = 0;
		depositSuccess = false;
		depositError = '';
	}

	// Muat daftar rekening tabungan milik siswa dari API
	async function loadEnrollments(studentId: string) {
		enrollmentsLoading = true;
		try {
			const res = await fetch(`/api/students/${studentId}/enrollments`);
			enrollments = await res.json();
			// Kalau sudah ada program yang dipilih, refresh saldo terbaru setelah setoran
			if (selectedEnrollment) {
				const updated = enrollments.find((e) => e.id === selectedEnrollment!.id);
				if (updated) selectedEnrollment = updated;
			}
		} finally {
			enrollmentsLoading = false;
		}
	}

	// Tandai program tabungan yang dipilih dan tutup dropdown
	function selectEnrollment(e: Enrollment) {
		selectedEnrollment = e;
		programOpen = false;
	}

	// Muat riwayat setoran terbaru milik siswa dari API
	async function loadRecentDeposits(studentId: string) {
		const res = await fetch(`/api/students/${studentId}/recent-deposits?type=DEPOSIT`);
		recentDeposits = await res.json();
	}

	// Handler enhance SvelteKit: dijalankan saat form disubmit
	const handleEnhance = () => {
		submitting = true; // Tandai form sedang diproses
		depositError = '';
		return async ({ result }: { result: { type: string; data?: Record<string, unknown> } }) => {
			submitting = false;
			if (result.type === 'success') {
				lastRefNo = String(result.data?.referenceNo ?? ''); // Simpan nomor referensi setoran
				depositSuccess = true; // Tandai sukses agar badge hijau muncul
				amount = 0; // Reset nominal
				if (selectedStudent) {
					// Refresh saldo dan riwayat setelah setoran berhasil
					await Promise.all([
						loadEnrollments(selectedStudent.id),
						loadRecentDeposits(selectedStudent.id),
					]);
				}
				setTimeout(() => { depositSuccess = false; }, 4000); // Sembunyikan badge sukses setelah 4 detik
			} else if (result.type === 'failure') {
				depositError = String(result.data?.error ?? 'Failed to record deposit'); // Tampilkan pesan error
			}
		};
	};

	// Reset form ke kondisi awal
	function reset() {
		amount = 0;
		depositSuccess = false;
		depositError = '';
	}
</script>

<svelte:head>
	<title>Setoran</title>
</svelte:head>

<div class="flex flex-col gap-6 flex-1">

	<!-- Header -->
	<div class="flex items-start justify-between">
		<div>
			<h1 class="text-2xl font-semibold tracking-tight">Setoran</h1>
			<p class="text-sm text-muted-foreground mt-1">
				Catat setoran tabungan siswa ke
				<span class="text-primary font-medium">program yang dipilih</span>.
				Setiap entri dicatat ke dalam jurnal.
			</p>
		</div>
		<Button variant="outline" size="sm" class="gap-2 text-xs" href="/transactions/transaction-history">
			<HugeiconsIcon icon={File01Icon} size={14} />
			Lihat Riwayat
		</Button>
	</div>

	<!-- Row 1: Form + Summary -->
	<div class="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-5 items-stretch">

		<!-- Form card -->
		<form method="POST" action="?/deposit" use:enhance={handleEnhance} class="rounded-xl border bg-card p-5 flex flex-col gap-5">
			<input type="hidden" name="studentSavingsId" value={selectedEnrollment?.id ?? ''} />
			<input type="hidden" name="amount" value={amount} />

			<div class="flex items-center gap-2.5">
				<span class="text-sm font-semibold">Form Setoran</span>
				<span class="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">draf</span>
				{#if depositSuccess}
					<span class="flex items-center gap-1 text-[10px] font-medium text-emerald-600">
						<HugeiconsIcon icon={Tick02Icon} size={11} /> tersimpan · {lastRefNo}
					</span>
				{:else}
					<span class="text-[10px] text-muted-foreground">· belum disimpan</span>
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
							{:else if searchQuery.length >= 2 && !searchLoading && searchOpen === false && searchResults.length === 0}
								<div class="absolute top-full left-0 right-0 z-50 mt-1 rounded-lg border bg-card shadow-lg px-3 py-3 text-sm text-muted-foreground">
									Siswa tidak ditemukan.
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
							<p class="text-sm text-amber-700">Siswa tidak terdaftar di program aktif manapun.</p>
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
										{selectedEnrollment.planCode} · {selectedEnrollment.planType === 'FLEXIBLE' ? 'Fleksibel' : 'Target'}
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
												<p class="text-[11px] text-muted-foreground">{e.planCode} · Saldo: {fmt(e.currentAmount)}</p>
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
								<p class="flex-1 text-sm text-muted-foreground">Pilih program tabungan…</p>
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
												<p class="text-[11px] text-muted-foreground">{e.planCode} · Saldo: {fmt(e.currentAmount)}</p>
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
				<Field.Label class="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Jumlah</Field.Label>
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
					Dicatat ke <span class="font-medium text-foreground">entri jurnal</span> · jejak audit aktif
				</p>
				<div class="flex items-center gap-2">
					<Button type="button" variant="ghost" size="sm" class="text-xs h-9" onclick={reset}>
						Atur Ulang
					</Button>
					<Button type="submit" size="sm" class="text-xs h-9 gap-1.5 font-semibold" disabled={!canSubmit}>
						{#if submitting}
							<span class="size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"></span>
							Menyimpan…
						{:else}
							<HugeiconsIcon icon={ArrowDown01Icon} size={14} />
							Catat Setoran
						{/if}
					</Button>
				</div>
			</div>
		</form>

		<!-- Summary card -->
		<div class="rounded-xl border bg-card p-5 flex flex-col gap-4">
			<p class="text-sm font-semibold">Ringkasan</p>

			<div class="space-y-0.5">
				<p class="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Saldo Sebelum</p>
				<p class="text-2xl font-bold tracking-tight">{fmt(balanceBefore)}</p>
			</div>

			<div class="flex items-center gap-2">
				<div class="h-px flex-1 bg-border"></div>
				<HugeiconsIcon icon={ArrowDown01Icon} size={16} class="text-primary" />
				<div class="h-px flex-1 bg-border"></div>
			</div>

			<div class="space-y-0.5">
				<p class="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">+ Setoran</p>
				<p class="text-xl font-bold text-primary">+ {fmt(amount > 0 ? amount : 0)}</p>
			</div>

			<div class="rounded-lg bg-muted/50 px-4 py-3 space-y-0.5">
				<p class="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Saldo Setelah</p>
				<p class="text-2xl font-bold tracking-tight">{fmt(balanceAfter)}</p>
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

	<!-- Recent Deposits (shown only when student is selected) -->
	{#if selectedStudent}
		<div class="rounded-xl border bg-card p-5 space-y-3">
			<div class="flex items-center justify-between">
				<p class="text-sm font-semibold">Setoran Terbaru</p>
				<span class="text-[11px] text-muted-foreground">{selectedStudent.name}</span>
			</div>
			{#if recentDeposits.length === 0}
				<p class="py-4 text-center text-sm text-muted-foreground">Belum ada riwayat setoran.</p>
			{:else}
				<div>
					{#each recentDeposits as tx, i (tx.id)}
						<div class="flex items-center justify-between py-2.5 {i < recentDeposits.length - 1 ? 'border-b border-border/50' : ''}">
							<div class="flex items-center gap-3 min-w-0 flex-1">
								<span class="text-[11px] text-muted-foreground tabular-nums shrink-0 w-[110px]">{txDateTime(tx.createdAt)}</span>
								<span class="text-[10px] font-mono font-bold text-muted-foreground bg-muted px-1.5 py-0.5 rounded shrink-0">{tx.planCode}</span>
								<span class="text-xs text-foreground font-semibold truncate max-w-[200px] md:max-w-[300px]">{tx.planName}</span>
								{#if tx.isReversed}
									<span class="text-[10px] text-amber-600 font-medium shrink-0">dibalik</span>
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
