<script lang="ts">
  import { HugeiconsIcon } from "@hugeicons/svelte";
  import { fade, scale } from "svelte/transition";
  import { backOut } from "svelte/easing";

  interface Props {
    open: boolean;
    title: string;
    description?: string;
    icon: any;
    variant?: "default" | "danger";
    onClose: () => void;
    children: import("svelte").Snippet;
  }

  let {
    open,
    title,
    description,
    icon,
    variant = "danger",
    onClose,
    children,
  }: Props = $props();

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Escape" && open) onClose();
  }
</script>

<svelte:window onkeydown={handleKeydown} />

{#if open}
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="fixed inset-0 bg-slate-950/40 backdrop-blur-sm"
      onclick={onClose}
      transition:fade={{ duration: 200 }}
    ></div>

    <div
      class="relative w-full max-w-[400px] bg-background rounded-2xl border shadow-2xl overflow-hidden"
      transition:scale={{
        duration: 300,
        start: 0.9,
        opacity: 0,
        easing: backOut,
      }}
    >
      <div class="p-8 text-center space-y-5">
        <!-- Centered Icon -->
        <div
          class="size-16 mx-auto rounded-full flex items-center justify-center animate-in zoom-in duration-500 {variant ===
          'danger'
            ? 'bg-red-50 text-red-600'
            : 'bg-primary/10 text-primary'}"
        >
          <HugeiconsIcon {icon} size={32} />
        </div>

        <!-- Text Content -->
        <div class="space-y-2">
          <h2 class="text-xl font-bold tracking-tight text-foreground">
            {title}
          </h2>
          {#if description}
            <p class="text-sm text-muted-foreground leading-relaxed px-2">
              {description}
            </p>
          {/if}
        </div>

        <!-- Action Buttons / Form -->
        <div class="pt-2">
          {@render children()}
        </div>
      </div>
    </div>
  </div>
{/if}
