<script lang="ts">
  import Cartographer from "./modules/cartographer/Cartographer.svelte"
</script>

<svelte:head>
  <title>Cartographer · Wayfarer</title>
  <meta
    name="description"
    content="An interactive terrain index for the Pokémon HnS world source."
  />
</svelte:head>

<main class="min-h-screen">
  <nav
    class="flex items-stretch justify-between border-b border-cartographer-border/80 bg-[#0b1220e8] px-[clamp(1rem,3vw,2.5rem)] backdrop-blur"
    aria-label="Modules"
  >
    <div class="flex items-center gap-3 py-3">
      <span
        class="font-cartographer-mono text-[0.68rem] font-bold tracking-[0.18em] text-cartographer-muted"
        >WAYFARER / DEVTOOLS</span
      >
      <span aria-hidden="true" class="h-3.5 w-px bg-cartographer-border"></span>
      <a
        class="relative inline-flex items-center font-cartographer-mono text-xs font-bold tracking-[0.12em] text-cartographer-signal no-underline after:absolute after:-bottom-3 after:left-0 after:h-px after:w-full after:bg-cartographer-signal"
        href="/"
        aria-current="page"
      >
        CARTOGRAPHER
      </a>
    </div>
    <span
      class="hidden items-center font-cartographer-mono text-[0.68rem] tracking-[0.14em] text-cartographer-muted sm:flex"
      >WORLD SOURCE · LOCAL</span
    >
  </nav>

  <Cartographer />
</main>
