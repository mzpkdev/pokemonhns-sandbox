<script lang="ts">
  import { onMount } from "svelte"

  import CartographerHeader from "./CartographerHeader.svelte"
  import MapDetails from "./MapDetails.svelte"
  import MapSearch from "./MapSearch.svelte"
  import MapViewport from "./MapViewport.svelte"
  import RegionPicker from "./RegionPicker.svelte"
  import {
    CatalogValidationError,
    loadCatalog,
    type CatalogMap,
    type CatalogWarp,
    type MapCatalog,
  } from "./catalog.js"
  import { visibleSurfaceMaps } from "./geography.js"
  import type { WarpSelection } from "./types.js"
  import {
    cartographerUrlWithState,
    parseCartographerUrlState,
    type CartographerViewState,
  } from "./urls.js"

  type LoadState =
    | { kind: "loading" }
    | { kind: "ready"; catalog: MapCatalog }
    | { kind: "error"; message: string; details: string[] }

  let loadState = $state<LoadState>({ kind: "loading" })
  let requestedRegion = $state<string | null>(null)
  let requestedMap = $state<string | null>(null)
  let initialView = $state<CartographerViewState | null>(null)
  let currentView = $state<CartographerViewState | null>(null)
  let searchQuery = $state("")
  let selectedWarp = $state<WarpSelection | null>(null)
  let showExits = $state(false)
  let focusToken = $state(0)

  onMount(() => {
    const state = parseCartographerUrlState(window.location.href)
    requestedRegion = state.region
    requestedMap = state.selectedMap
    initialView = state.view
    const controller = new AbortController()
    loadCatalog(controller.signal)
      .then((catalog) => {
        loadState = { kind: "ready", catalog }
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        loadState = {
          kind: "error",
          message: error instanceof Error ? error.message : "The map catalog could not be read.",
          details: error instanceof CatalogValidationError ? [...error.details] : [],
        }
      })
    return () => controller.abort()
  })

  let catalog = $derived(loadState.kind === "ready" ? loadState.catalog : null)
  let selectedCandidate = $derived(
    catalog?.maps.find((map) => map.name === requestedMap || map.id === requestedMap) ?? null,
  )
  let activeRegion = $derived(
    catalog
      ? (selectedCandidate &&
          catalog.regions.find((region) => region.id === selectedCandidate.region)) ||
          catalog.regions.find((region) => region.id === requestedRegion) ||
          catalog.regions[0] ||
          null
      : null,
  )
  let maps = $derived(
    catalog && activeRegion ? catalog.maps.filter((map) => map.region === activeRegion.id) : [],
  )
  let selectedMap = $derived(
    selectedCandidate?.region === activeRegion?.id ? selectedCandidate : null,
  )
  let renderedMapNames = $derived(
    new Set(visibleSurfaceMaps(catalog?.maps ?? []).map((map) => map.name)),
  )

  const replaceUrl = (): void => {
    if (!activeRegion) return
    const next = cartographerUrlWithState(window.location.href, {
      region: activeRegion.id,
      selectedMap: selectedMap?.name ?? null,
      view: currentView,
    })
    const current = `${window.location.pathname}${window.location.search}${window.location.hash}`
    if (next !== current) window.history.replaceState(window.history.state, "", next)
  }

  const selectMap = (name: string, focus = false): void => {
    const map = catalog?.maps.find((candidate) => candidate.name === name) ?? null
    if (!map) return
    if (map.region !== activeRegion?.id) currentView = null
    requestedRegion = map.region
    requestedMap = map.name
    selectedWarp = null
    if (focus && renderedMapNames.has(map.name)) focusToken += 1
    queueMicrotask(replaceUrl)
  }

  const selectRegion = (region: string): void => {
    requestedRegion = region
    requestedMap = null
    selectedWarp = null
    currentView = null
    queueMicrotask(replaceUrl)
  }

  const selectWarp = (warp: CatalogWarp): void => {
    if (!selectedMap) return
    selectedWarp = { sourceMapName: selectedMap.name, warpId: warp.warpId }
    showExits = true
  }

  const handleCameraChange = (view: CartographerViewState): void => {
    currentView = view
    replaceUrl()
  }
</script>

{#if loadState.kind === "loading"}
  <main class="mx-auto mt-[12vh] max-w-2xl p-8"><p>Loading the map catalog...</p></main>
{:else if loadState.kind === "error"}
  <main class="mx-auto mt-[12vh] max-w-2xl border-l-[0.35rem] border-[#af3f2e] bg-[#fff4ee] p-8">
    <h1 class="mb-3 text-3xl font-bold">Cartographer unavailable</h1>
    <p>{loadState.message}</p>
    {#if loadState.details.length > 0}
      <ul>
        {#each loadState.details as detail}<li>{detail}</li>{/each}
      </ul>
    {/if}
  </main>
{:else if !catalog || !activeRegion}
  <main class="mx-auto mt-[12vh] max-w-2xl p-8"><p>The catalog has no regions.</p></main>
{:else}
  <main class="min-h-screen p-[clamp(1rem,3vw,2.5rem)]">
    <CartographerHeader {catalog} />
    <div class="grid gap-4 md:grid-cols-[minmax(14rem,18rem)_minmax(0,1fr)]">
      <aside class="grid content-start gap-4">
        <RegionPicker
          regions={catalog.regions}
          activeRegionId={activeRegion.id}
          onSelectRegion={selectRegion}
        />
        <MapSearch maps={catalog.maps} bind:query={searchQuery} onSelectMap={selectMap} />
      </aside>
      <div>
        <div
          class="mb-2 flex flex-col items-start justify-between gap-4 md:flex-row md:items-baseline"
        >
          <h2 class="mb-0 text-2xl font-semibold">{activeRegion.label}</h2>
          <p class="m-0 text-sm text-cartographer-muted md:text-right">
            Only default-visible surface maps are drawn. Pan, scroll, or pinch to explore.
          </p>
        </div>
        {#key activeRegion.id}
          <MapViewport
            {catalog}
            {maps}
            selectedMapName={selectedMap?.name}
            {selectedWarp}
            {initialView}
            focusRequest={focusToken > 0 && selectedMap
              ? { mapName: selectedMap.name, token: focusToken }
              : null}
            {showExits}
            onSelectMap={selectMap}
            onSelectWarp={(selection) => {
              selectMap(selection.sourceMapName)
              selectedWarp = selection
              showExits = true
            }}
            onCameraChange={handleCameraChange}
            onToggleExits={(value) => (showExits = value)}
          />
        {/key}
        <MapDetails
          maps={catalog.maps}
          {selectedMap}
          {selectedWarp}
          {renderedMapNames}
          onSelectWarp={selectWarp}
          onFocusMap={(name) => selectMap(name, true)}
        />
      </div>
    </div>
  </main>
{/if}
