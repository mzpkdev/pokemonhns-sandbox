<script lang="ts">
  import type { CatalogMap, CatalogWarp } from "./catalog.js"
  import type { WarpSelection } from "./types.js"
  import Button from "./ui-toolkit/Button.svelte"
  import { cn } from "./lib/cn.js"

  type Props = {
    maps: readonly CatalogMap[]
    selectedMap: CatalogMap | null
    selectedWarp: WarpSelection | null
    renderedMapNames: ReadonlySet<string>
    onSelectWarp?: (warp: CatalogWarp) => void
    onFocusMap?: (name: string) => void
  }

  let { maps, selectedMap, selectedWarp, renderedMapNames, onSelectWarp, onFocusMap }: Props =
    $props()

  const destinationFor = (warp: CatalogWarp): CatalogMap | null => {
    return (
      maps.find((map) => map.name === warp.destinationMap || map.id === warp.destinationMapId) ??
      null
    )
  }
</script>

<aside
  class="mt-4 rounded-xl border border-cartographer-border bg-cartographer-panel p-4 shadow-[0_5px_18px_#56634c1b]"
  aria-live="polite"
>
  {#if !selectedMap}
    <h3 class="mb-3 text-base font-semibold">Map details</h3>
    <p>Select a map or choose a search result to inspect it and its exits.</p>
  {:else}
    <p class="mb-1 text-xs font-bold tracking-[0.12em] text-[#577044] uppercase">Selected map</p>
    <h3 class="mb-3 text-xl font-semibold">{selectedMap.name}</h3>
    <dl class="m-0 grid gap-2">
      <div class="grid gap-1 md:grid-cols-[minmax(7rem,10rem)_minmax(0,1fr)] md:gap-3">
        <dt class="font-bold text-cartographer-muted">Source ID</dt>
        <dd class="m-0 break-words"><code>{selectedMap.id}</code></dd>
      </div>
      <div class="grid gap-1 md:grid-cols-[minmax(7rem,10rem)_minmax(0,1fr)] md:gap-3">
        <dt class="font-bold text-cartographer-muted">Map section</dt>
        <dd class="m-0 break-words">{selectedMap.mapSection ?? "Not assigned"}</dd>
      </div>
      <div class="grid gap-1 md:grid-cols-[minmax(7rem,10rem)_minmax(0,1fr)] md:gap-3">
        <dt class="font-bold text-cartographer-muted">Layout</dt>
        <dd class="m-0 break-words">
          {selectedMap.layout.widthMetatiles} × {selectedMap.layout.heightMetatiles} metatiles
        </dd>
      </div>
      <div class="grid gap-1 md:grid-cols-[minmax(7rem,10rem)_minmax(0,1fr)] md:gap-3">
        <dt class="font-bold text-cartographer-muted">Cartographer state</dt>
        <dd class="m-0 break-words">
          {renderedMapNames.has(selectedMap.name)
            ? "Rendered default-visible surface map"
            : "Not visible in the default cartographer"}
        </dd>
      </div>
    </dl>
    <section class="mt-4">
      <h4 class="mb-2 text-base font-semibold">Exits ({selectedMap.warps.length})</h4>
      {#if selectedMap.warps.length === 0}
        <p>This map has no catalogued warp exits.</p>
      {:else}
        <ul class="m-0 grid list-none gap-1.5 p-0">
          {#each selectedMap.warps as warp (warp.warpId)}
            {@const destination = destinationFor(warp)}
            <li>
              <Button
                class={cn(
                  "flex w-full items-center justify-between gap-3 rounded-lg border-[#c5d1c2] px-3 py-2 text-left hover:bg-[#e5efdc] focus-visible:outline-[#53704e]",
                  selectedWarp?.sourceMapName === selectedMap.name &&
                    selectedWarp?.warpId === warp.warpId &&
                    "bg-[#e5efdc]",
                )}
                onclick={() => onSelectWarp?.(warp)}
              >
                <span>Warp {warp.warpId} · ({warp.xMetatiles}, {warp.yMetatiles})</span>
                <small class="text-right break-words text-cartographer-muted"
                  >{destination?.name ?? warp.destinationMap ?? warp.destinationMapId}</small
                >
              </Button>
              {#if destination && renderedMapNames.has(destination.name) && selectedWarp?.sourceMapName === selectedMap.name && selectedWarp?.warpId === warp.warpId}
                <Button
                  class="mt-2 min-h-9"
                  variant="solid"
                  onclick={() => onFocusMap?.(destination.name)}>Focus {destination.name}</Button
                >
              {/if}
            </li>
          {/each}
        </ul>
      {/if}
    </section>
  {/if}
</aside>
