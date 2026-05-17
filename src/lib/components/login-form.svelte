<script lang="ts">
	import { enhance } from '$app/forms';
	import Button from "$lib/components/ui/button/button.svelte";
	import Input from "$lib/components/ui/input/input.svelte";
	import Label from "$lib/components/ui/label/label.svelte";

	let { form }: { form?: { message?: string } | null } = $props();
	let loading = $state(false);
</script>

<div class="flex min-h-screen items-center justify-center bg-muted/40 px-4 py-12">
	<div class="w-full max-w-[440px]">

		<div class="overflow-hidden rounded-2xl border bg-card shadow-xl">

			<!-- Branded header panel -->
			<div class="relative overflow-hidden bg-primary px-10 py-9">
				<!-- Dot grid texture -->
				<div
					class="pointer-events-none absolute inset-0"
					style="background-image: radial-gradient(circle, rgba(255,255,255,0.15) 1px, transparent 1px); background-size: 22px 22px;"
				></div>
				<!-- Decorative circles -->
				<div class="pointer-events-none absolute -bottom-12 -right-12 size-48 rounded-full bg-white/10"></div>
				<div class="pointer-events-none absolute -top-10 right-16 size-28 rounded-full bg-white/8"></div>

				<div class="relative flex items-center gap-4">
					<div class="flex size-12 shrink-0 items-center justify-center rounded-xl bg-white text-primary text-base font-extrabold shadow-md">
						SP
					</div>
					<div>
						<p class="text-lg font-bold leading-tight text-white">SantriPay</p>
						<p class="text-[11px] font-medium tracking-wide text-white/60 uppercase">Savings Management System</p>
					</div>
				</div>
			</div>

			<!-- Form section -->
			<div class="px-10 py-8">
				<div class="mb-7">
					<h2 class="text-xl font-bold tracking-tight text-foreground">Welcome back</h2>
					<p class="mt-1 text-sm text-muted-foreground">Enter your credentials to continue</p>
				</div>

				<form
					method="POST"
					action="?/signIn"
					use:enhance={() => {
						loading = true;
						return async ({ update }) => {
							await update();
							loading = false;
						};
					}}
					class="space-y-5"
				>
					{#if form?.message}
						<div class="rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
							{form.message}
						</div>
					{/if}

					<div class="space-y-2">
						<Label for="email" class="text-sm font-medium">Email address</Label>
						<Input
							type="email"
							required
							name="email"
							id="email"
							placeholder="you@example.com"
							class="h-10 border-border bg-muted/50 transition-colors focus:bg-background"
						/>
					</div>

					<div class="space-y-2">
						<Label for="password" class="text-sm font-medium">Password</Label>
						<Input
							type="password"
							required
							name="password"
							id="password"
							placeholder="••••••••"
							class="h-10 border-border bg-muted/50 transition-colors focus:bg-background"
						/>
					</div>

					<div class="flex items-center gap-2.5">
						<input
							type="checkbox"
							name="rememberMe"
							id="rememberMe"
							class="size-4 cursor-pointer rounded border-border accent-primary"
						/>
						<Label for="rememberMe" class="cursor-pointer select-none text-sm font-normal text-muted-foreground">
							Remember me for 30 days
						</Label>
					</div>

					<Button type="submit" class="w-full h-10 font-semibold" disabled={loading}>
						{#if loading}
							<svg class="mr-2 size-4 animate-spin" viewBox="0 0 24 24" fill="none">
								<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
								<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
							</svg>
							Signing in...
						{:else}
							Sign In
						{/if}
					</Button>
				</form>
			</div>

			<div class="border-t bg-muted/30 px-10 py-4">
				<p class="text-center text-xs text-muted-foreground">
					Don't have an account? Contact your administrator.
				</p>
			</div>
		</div>

		<p class="mt-5 text-center text-xs text-muted-foreground/40">
			&copy; {new Date().getFullYear()} SantriPay &mdash; All rights reserved.
		</p>
	</div>
</div>
