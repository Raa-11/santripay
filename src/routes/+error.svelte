<script lang="ts">
  import { page } from '$app/stores';
  import './layout.css';
  import { Button } from '$lib/components/ui/button';

  const goBack = () => {
    if (typeof window !== 'undefined') window.history.back();
  };

  const getInfo = (status: number) => {
    switch (status) {
      case 404: return { title: 'Page not found',    desc: 'The page you\'re looking for doesn\'t exist or has been moved.' };
      case 403: return { title: 'Access denied',     desc: 'You don\'t have permission to view this page.' };
      case 500: return { title: 'Server error',      desc: 'Something went wrong on our end. We\'re working on it.' };
      default:  return { title: 'Something went wrong', desc: $page.error?.message ?? 'An unexpected error occurred.' };
    }
  };

  let info = $derived(getInfo($page.status ?? 404));
  let code = $derived($page.status ?? 404);
</script>

<svelte:head>
  <title>{info.title} — SantriPay</title>
</svelte:head>

<div class="min-h-svh w-full flex flex-col items-center justify-center gap-6 px-4 text-center bg-background font-sans animate-in fade-in duration-500">

  <!-- Status code -->
  <p class="text-[7rem] sm:text-[10rem] font-black leading-none tracking-tighter text-foreground/10 select-none animate-bounce-slow">
    {code}
  </p>

  <!-- Text -->
  <div class="flex flex-col gap-2 -mt-4">
    <h1 class="text-2xl font-bold tracking-tight text-foreground">{info.title}</h1>
    <p class="text-sm text-muted-foreground max-w-sm leading-relaxed">{info.desc}</p>
  </div>

  <!-- Actions -->
  <div class="flex items-center gap-3">
    <Button href="/dashboard">Back to dashboard</Button>
    <Button variant="outline" onclick={goBack}>Go back</Button>
  </div>

  <!-- Brand -->
  <p class="text-xs text-muted-foreground/50 tracking-widest uppercase mt-4">SantriPay</p>
</div>

<style>
  @keyframes bounce-slow {
    0%, 100% { transform: translateY(0); }
    50%       { transform: translateY(-10px); }
  }
  .animate-bounce-slow {
    animation: bounce-slow 4s ease-in-out infinite;
  }
</style>
