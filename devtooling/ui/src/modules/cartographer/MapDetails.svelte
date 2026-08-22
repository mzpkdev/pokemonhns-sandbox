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
  class="border border-cartographer-border bg-cartographer-panel p-4 shadow-[0_1.5rem_4rem_#02061166] xl:min-h-[34rem]"
  aria-live="polite"
>
  {#if !selectedMap}
    <p
      class="m-0 font-cartographer-mono text-[0.68rem] font-bold tracking-[0.15em] text-cartographer-signal"
    >
      Inspector
    </p>
    <h3 class="mb-3 mt-3 text-lg font-semibold">No map selected</h3>
    <p class="m-0 leading-6 text-cartographer-muted">
      Select a plotted map or use the source search to inspect its layout and exits.
    </p>
  {:else}
    <p
      class="mb-1 font-cartographer-mono text-[0.68rem] font-bold tracking-[0.15em] text-cartographer-signal"
    >
      Map inspector
    </p>
    <h3 class="mb-4 text-xl font-semibold tracking-[-0.02em]">{selectedMap.name}</h3>
    <dl class="m-0 grid gap-3 border-y border-cartographer-border py-3 text-sm">
      <div class="grid gap-1 md:grid-cols-[minmax(7rem,10rem)_minmax(0,1fr)] md:gap-3">
        <dt
          class="font-cartographer-mono text-[0.68rem] font-bold tracking-[0.08em] text-cartographer-muted"
        >
          Source ID
        </dt>
        <dd class="m-0 break-words font-cartographer-mono text-xs text-cartographer-signal-soft">
          <code>{selectedMap.id}</code>
        </dd>
      </div>
      <div class="grid gap-1 md:grid-cols-[minmax(7rem,10rem)_minmax(0,1fr)] md:gap-3">
        <dt
          class="font-cartographer-mono text-[0.68rem] font-bold tracking-[0.08em] text-cartographer-muted"
        >
          Section
        </dt>
        <dd class="m-0 break-words">{selectedMap.mapSection ?? "Not assigned"}</dd>
      </div>
      <div class="grid gap-1 md:grid-cols-[minmax(7rem,10rem)_minmax(0,1fr)] md:gap-3">
        <dt
          class="font-cartographer-mono text-[0.68rem] font-bold tracking-[0.08em] text-cartographer-muted"
        >
          Layout
        </dt>
        <dd class="m-0 break-words">
          {selectedMap.layout.widthMetatiles} × {selectedMap.layout.heightMetatiles} metatiles
        </dd>
      </div>
      <div class="grid gap-1 md:grid-cols-[minmax(7rem,10rem)_minmax(0,1fr)] md:gap-3">
        <dt
          class="font-cartographer-mono text-[0.68rem] font-bold tracking-[0.08em] text-cartographer-muted"
        >
          Render state
        </dt>
        <dd class="m-0 break-words">
          {renderedMapNames.has(selectedMap.name)
            ? "Rendered default-visible surface map"
            : "Not visible in the default cartographer"}
        </dd>
      </div>
    </dl>
    <section class="mt-4">
      <div class="mb-2 flex items-center justify-between gap-3">
        <h4 class="m-0 text-base font-semibold">Exits</h4>
        <span class="font-cartographer-mono text-xs text-cartographer-amber"
          >{selectedMap.warps.length}</span
        >
      </div>
      {#if selectedMap.warps.length === 0}
        <p>This map has no catalogued warp exits.</p>
      {:else}
        <ul class="m-0 grid list-none gap-1.5 p-0">
          {#each selectedMap.warps as warp (warp.warpId)}
            {@const destination = destinationFor(warp)}
            <li>
              <Button
                class={cn(
                  "flex w-full items-center justify-between gap-3 border-cartographer-border px-3 py-2 text-left font-cartographer-mono text-xs hover:border-cartographer-signal hover:bg-cartographer-signal/10 focus-visible:outline-cartographer-signal",
                  selectedWarp?.sourceMapName === selectedMap.name &&
                    selectedWarp?.warpId === warp.warpId &&
                    "border-cartographer-signal bg-cartographer-signal/10",
                )}
                onclick={() => onSelectWarp?.(warp)}
              >
                <span>Warp {warp.warpId} · ({warp.xMetatiles}, {warp.yMetatiles})</span>
                <small
                  class="text-right break-words font-cartographer-mono text-[0.68rem] text-cartographer-muted"
                  >{destination?.name ?? warp.destinationMap ?? warp.destinationMapId}</small
                >
              </Button>
              {#if destination && renderedMapNames.has(destination.name) && selectedWarp?.sourceMapName === selectedMap.name && selectedWarp?.warpId === warp.warpId}
                <Button
                  class="mt-2 min-h-9 text-xs"
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
