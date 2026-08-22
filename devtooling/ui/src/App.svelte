<script lang="ts">
  import Cartographer from "./modules/cartographer/Cartographer.svelte"
</script>

<main class="min-h-screen">
  <nav
    class="border-b border-cartographer-border bg-cartographer-panel px-[clamp(1rem,3vw,2.5rem)]"
    aria-label="Modules"
  >
    <a
      class="inline-flex border-b-2 border-cartographer-forest px-4 py-3 font-semibold text-cartographer-forest no-underline"
      href="/"
      aria-current="page"
    >
      Cartographer
    </a>
  </nav>

  <Cartographer />
</main>
