<script lang="ts">
  import type { MapCatalog } from "./catalog.js"
  import Button from "./ui-toolkit/Button.svelte"

  type Props = {
    regions: MapCatalog["regions"]
    activeRegionId: string
    onSelectRegion?: (regionId: string) => void
  }

  let { regions, activeRegionId, onSelectRegion }: Props = $props()
</script>

<nav
  class="flex flex-wrap items-center gap-1.5 border border-cartographer-border bg-cartographer-panel p-3 shadow-[0_1.5rem_4rem_#02061166] md:block"
  aria-label="Regions"
>
  <div
    class="mb-2 flex w-full items-center justify-between border-b border-cartographer-border pb-2 md:mb-3"
  >
    <h2
      class="m-0 font-cartographer-mono text-[0.68rem] font-bold tracking-[0.14em] text-cartographer-signal"
    >
      REGIONS
    </h2>
    <span class="font-cartographer-mono text-[0.68rem] text-cartographer-muted"
      >{regions.length}</span
    >
  </div>
  {#each regions as region}
    <Button
      class="flex w-auto items-center justify-between gap-2 rounded-sm px-2.5 py-2 text-left text-sm md:w-full"
      variant={region.id === activeRegionId ? "selected" : "subtle"}
      onclick={() => onSelectRegion?.(region.id)}
    >
      <span>{region.label}</span>
      <small class="font-cartographer-mono text-[0.62rem] opacity-75">{region.mapCount} MAPS</small>
    </Button>
  {/each}
</nav>
