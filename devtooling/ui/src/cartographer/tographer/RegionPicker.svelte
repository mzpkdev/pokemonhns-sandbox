<script lang="ts">
  import type { MapCatalog } from "./catalog.js"
  import Button from "../ui-toolkit/Button.svelte"

  type Props = {
    regions: MapCatalog["regions"]
    activeRegionId: string
    onSelectRegion?: (regionId: string) => void
  }

  let { regions, activeRegionId, onSelectRegion }: Props = $props()
</script>

<nav
  class="flex flex-wrap items-center gap-1.5 rounded-xl border border-tographer-border bg-tographer-panel p-4 shadow-[0_5px_18px_#56634c1b] md:block"
  aria-label="Regions"
>
  <h2 class="mb-1 w-full text-base font-semibold md:mb-3">Regions</h2>
  {#each regions as region}
    <Button
      class="flex w-auto items-center justify-between gap-2 rounded-lg px-3 py-2 text-left md:w-full"
      variant={region.id === activeRegionId ? "selected" : "subtle"}
      onclick={() => onSelectRegion?.(region.id)}
    >
      <span>{region.label}</span>
      <small class="opacity-75">{region.mapCount} catalog maps</small>
    </Button>
  {/each}
</nav>
