<script lang="ts">
  import { onMount } from "svelte";

  import MapViewport from "./atlas/MapViewport.svelte";
  import {
    CatalogValidationError,
    loadCatalog,
    type CatalogMap,
    type CatalogWarp,
    type MapCatalog,
  } from "./atlas/catalog.js";
  import { visibleSurfaceMaps } from "./atlas/geography.js";
  import { atlasUrlWithState, parseAtlasUrlState, type AtlasViewState } from "./atlas/urls.js";
  import { cn } from "./lib/cn.js";

  type LoadState =
    | { kind: "loading" }
    | { kind: "ready"; catalog: MapCatalog }
    | { kind: "error"; message: string; details: string[] };

  type WarpSelection = { sourceMapName: string; warpId: string };

  let loadState = $state<LoadState>({ kind: "loading" });
  let requestedRegion = $state<string | null>(null);
  let requestedMap = $state<string | null>(null);
  let initialView = $state<AtlasViewState | null>(null);
  let currentView = $state<AtlasViewState | null>(null);
  let searchQuery = $state("");
  let selectedWarp = $state<WarpSelection | null>(null);
  let showExits = $state(false);
  let focusToken = $state(0);

  const panelClass = cn("rounded-xl border border-atlas-border bg-atlas-panel shadow-[0_5px_18px_#56634c1b]");
  const listButtonClass = cn(
    "flex w-full items-center justify-between gap-3 rounded-lg border border-[#c5d1c2] bg-white px-3 py-2 text-left transition hover:bg-[#e5efdc] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#53704e]",
  );

  onMount(() => {
    const state = parseAtlasUrlState(window.location.href);
    requestedRegion = state.region;
    requestedMap = state.selectedMap;
    initialView = state.view;
    const controller = new AbortController();
    loadCatalog(controller.signal)
      .then((catalog) => {
        loadState = { kind: "ready", catalog };
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        loadState = {
          kind: "error",
          message: error instanceof Error ? error.message : "The map catalog could not be read.",
          details: error instanceof CatalogValidationError ? [...error.details] : [],
        };
      });
    return () => controller.abort();
  });

  let catalog = $derived(loadState.kind === "ready" ? loadState.catalog : null);
  let selectedCandidate = $derived(catalog?.maps.find((map) => map.name === requestedMap || map.id === requestedMap) ?? null);
  let activeRegion = $derived(
    catalog
      ? (selectedCandidate && catalog.regions.find((region) => region.id === selectedCandidate.region)) ||
        catalog.regions.find((region) => region.id === requestedRegion) ||
        catalog.regions[0] ||
        null
      : null,
  );
  let maps = $derived(catalog && activeRegion ? catalog.maps.filter((map) => map.region === activeRegion.id) : []);
  let selectedMap = $derived(selectedCandidate?.region === activeRegion?.id ? selectedCandidate : null);
  let renderedMapNames = $derived(new Set(visibleSurfaceMaps(catalog?.maps ?? []).map((map) => map.name)));
  let searchResults = $derived(search(catalog?.maps ?? [], searchQuery));

  function search(maps: readonly CatalogMap[], query: string): CatalogMap[] {
    const needle = query.toLocaleLowerCase("en").replace(/[^a-z0-9]+/g, "");
    if (!needle) return [];
    return maps
      .filter((map) => [map.name, map.mapSection ?? ""].some((value) => value.toLocaleLowerCase("en").replace(/[^a-z0-9]+/g, "").includes(needle)))
      .sort((left, right) => left.name.localeCompare(right.name, "en") || left.id.localeCompare(right.id, "en"));
  }

  function replaceUrl(): void {
    if (!activeRegion) return;
    const next = atlasUrlWithState(window.location.href, {
      region: activeRegion.id,
      selectedMap: selectedMap?.name ?? null,
      view: currentView,
    });
    const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (next !== current) window.history.replaceState(window.history.state, "", next);
  }

  function selectMap(name: string, focus = false): void {
    const map = catalog?.maps.find((candidate) => candidate.name === name) ?? null;
    if (!map) return;
    if (map.region !== activeRegion?.id) currentView = null;
    requestedRegion = map.region;
    requestedMap = map.name;
    selectedWarp = null;
    if (focus && renderedMapNames.has(map.name)) focusToken += 1;
    queueMicrotask(replaceUrl);
  }

  function selectRegion(region: string): void {
    requestedRegion = region;
    requestedMap = null;
    selectedWarp = null;
    currentView = null;
    queueMicrotask(replaceUrl);
  }

  function selectWarp(selection: WarpSelection): void {
    selectMap(selection.sourceMapName);
    selectedWarp = selection;
    showExits = true;
  }

  function destinationFor(warp: CatalogWarp): CatalogMap | null {
    return catalog?.maps.find((map) => map.name === warp.destinationMap || map.id === warp.destinationMapId) ?? null;
  }
</script>

{#if loadState.kind === "loading"}
  <main class="mx-auto mt-[12vh] max-w-2xl p-8"><p>Loading the map catalog...</p></main>
{:else if loadState.kind === "error"}
  <main class="mx-auto mt-[12vh] max-w-2xl border-l-[0.35rem] border-[#af3f2e] bg-[#fff4ee] p-8">
    <h1 class="mb-3 text-3xl font-bold">Map atlas unavailable</h1>
    <p>{loadState.message}</p>
    {#if loadState.details.length > 0}
      <ul>{#each loadState.details as detail}<li>{detail}</li>{/each}</ul>
    {/if}
  </main>
{:else if !catalog || !activeRegion}
  <main class="mx-auto mt-[12vh] max-w-2xl p-8"><p>The catalog has no regions.</p></main>
{:else}
  <main class="min-h-screen p-[clamp(1rem,3vw,2.5rem)]">
    <header class="mb-6 flex flex-col items-start justify-between gap-4 md:flex-row md:items-end">
      <div>
        <p class="mb-1 text-xs font-bold tracking-[0.12em] text-[#577044] uppercase">Pokemon Heart &amp; Soul</p>
        <h1 class="m-0 text-[clamp(1.7rem,4vw,2.6rem)] font-bold">Map atlas</h1>
      </div>
      <p class="m-0 flex items-center gap-2 text-sm text-[#4b5a4c]">
        Source {catalog.source.revision.slice(0, 12)}
        <span class={cn("rounded-full px-2 py-0.5 font-bold", catalog.source.workingTreeDirty ? "bg-[#f8d7a8] text-[#7b4411]" : "bg-[#d3ebcf] text-[#1d672b]")}>
          {catalog.source.workingTreeDirty ? "dirty" : "clean"}
        </span>
      </p>
    </header>
    <div class="grid gap-4 md:grid-cols-[minmax(14rem,18rem)_minmax(0,1fr)]">
      <aside class="grid content-start gap-4">
        <nav class={`${panelClass} flex flex-wrap items-center gap-1.5 p-4 md:block`} aria-label="Regions">
          <h2 class="mb-1 w-full text-base font-semibold md:mb-3">Regions</h2>
          {#each catalog.regions as region}
            <button type="button" class={cn("flex w-auto items-center justify-between gap-2 rounded-lg px-3 py-2 text-left transition hover:bg-atlas-forest hover:text-white focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#53704e] md:w-full", region.id === activeRegion.id && "bg-atlas-forest text-white")} onclick={() => selectRegion(region.id)}>
              <span>{region.label}</span>
              <small class="opacity-75">{region.mapCount} catalog maps</small>
            </button>
          {/each}
        </nav>
        <section class={`${panelClass} p-4`} aria-label="Map search">
          <h2 class="mb-3 text-base font-semibold">Find a map</h2>
          <label class="mb-1 block text-sm font-bold text-atlas-muted" for="map-search-input">Source name or map section</label>
          <input class="w-full rounded-md border border-[#9eaf9b] bg-white px-2.5 py-2 text-inherit focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#53704e]" id="map-search-input" type="search" bind:value={searchQuery} placeholder="e.g. Route29 or MAPSEC..." />
          {#if searchQuery.trim()}
            <ul class="mt-3 grid max-h-72 list-none gap-1.5 overflow-auto p-0" aria-label="Matching maps">
              {#if searchResults.length > 0}
                {#each searchResults as map (map.id)}
                  <li>
                    <button class={listButtonClass} type="button" onclick={() => selectMap(map.name, true)}>
                      <span>{map.name}</span><small class="text-right break-words text-atlas-muted">{map.mapSection ?? "No map section"}</small>
                    </button>
                  </li>
                {/each}
              {:else}
                <li class="text-sm text-atlas-muted">No source maps or map sections match.</li>
              {/if}
            </ul>
          {/if}
        </section>
      </aside>
      <div>
        <div class="mb-2 flex flex-col items-start justify-between gap-4 md:flex-row md:items-baseline">
          <h2 class="mb-0 text-2xl font-semibold">{activeRegion.label}</h2>
          <p class="m-0 text-sm text-atlas-muted md:text-right">Only default-visible surface maps are drawn. Pan, scroll, or pinch to explore.</p>
        </div>
        {#key activeRegion.id}
          <MapViewport
            {catalog}
            {maps}
            selectedMapName={selectedMap?.name}
            {selectedWarp}
            {initialView}
            focusRequest={focusToken > 0 && selectedMap ? { mapName: selectedMap.name, token: focusToken } : null}
            {showExits}
            onSelectMap={selectMap}
            onSelectWarp={selectWarp}
            onCameraChange={(view) => { currentView = view; replaceUrl(); }}
            onToggleExits={(value) => (showExits = value)}
          />
        {/key}
        <aside class={`${panelClass} mt-4 p-4`} aria-live="polite">
          {#if !selectedMap}
            <h3 class="mb-3 text-base font-semibold">Map details</h3>
            <p>Select a map or choose a search result to inspect it and its exits.</p>
          {:else}
            <p class="mb-1 text-xs font-bold tracking-[0.12em] text-[#577044] uppercase">Selected map</p>
            <h3 class="mb-3 text-xl font-semibold">{selectedMap.name}</h3>
            <dl class="m-0 grid gap-2">
              <div class="grid gap-1 md:grid-cols-[minmax(7rem,10rem)_minmax(0,1fr)] md:gap-3"><dt class="font-bold text-atlas-muted">Source ID</dt><dd class="m-0 break-words"><code>{selectedMap.id}</code></dd></div>
              <div class="grid gap-1 md:grid-cols-[minmax(7rem,10rem)_minmax(0,1fr)] md:gap-3"><dt class="font-bold text-atlas-muted">Map section</dt><dd class="m-0 break-words">{selectedMap.mapSection ?? "Not assigned"}</dd></div>
              <div class="grid gap-1 md:grid-cols-[minmax(7rem,10rem)_minmax(0,1fr)] md:gap-3"><dt class="font-bold text-atlas-muted">Layout</dt><dd class="m-0 break-words">{selectedMap.layout.widthMetatiles} × {selectedMap.layout.heightMetatiles} metatiles</dd></div>
              <div class="grid gap-1 md:grid-cols-[minmax(7rem,10rem)_minmax(0,1fr)] md:gap-3"><dt class="font-bold text-atlas-muted">Atlas state</dt><dd class="m-0 break-words">{renderedMapNames.has(selectedMap.name) ? "Rendered default-visible surface map" : "Not visible in the default atlas"}</dd></div>
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
                      <button class={cn(listButtonClass, selectedWarp?.sourceMapName === selectedMap.name && selectedWarp?.warpId === warp.warpId && "bg-[#e5efdc]")} type="button" onclick={() => selectWarp({ sourceMapName: selectedMap!.name, warpId: warp.warpId })}>
                        <span>Warp {warp.warpId} · ({warp.xMetatiles}, {warp.yMetatiles})</span>
                        <small class="text-right break-words text-atlas-muted">{destination?.name ?? warp.destinationMap ?? warp.destinationMapId}</small>
                      </button>
                      {#if destination && renderedMapNames.has(destination.name) && selectedWarp?.sourceMapName === selectedMap.name && selectedWarp?.warpId === warp.warpId}
                        <button type="button" class="mt-2 min-h-9 rounded-md border border-[#8a5b10] bg-[#8a5b10] px-3 py-1.5 text-white hover:bg-[#704707] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#704707]" onclick={() => selectMap(destination!.name, true)}>Focus {destination.name}</button>
                      {/if}
                    </li>
                  {/each}
                </ul>
              {/if}
            </section>
          {/if}
        </aside>
      </div>
    </div>
  </main>
{/if}
