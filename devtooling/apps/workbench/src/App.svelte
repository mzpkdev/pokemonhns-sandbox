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
  <main class="status-page"><p>Loading the map catalog...</p></main>
{:else if loadState.kind === "error"}
  <main class="status-page error-page">
    <h1>Map atlas unavailable</h1>
    <p>{loadState.message}</p>
    {#if loadState.details.length > 0}
      <ul>{#each loadState.details as detail}<li>{detail}</li>{/each}</ul>
    {/if}
  </main>
{:else if !catalog || !activeRegion}
  <main class="status-page"><p>The catalog has no regions.</p></main>
{:else}
  <main class="app-shell">
    <header class="app-header">
      <div>
        <p class="eyebrow">Pokemon Heart &amp; Soul</p>
        <h1>Map atlas</h1>
      </div>
      <p class="source-state">
        Source {catalog.source.revision.slice(0, 12)}
        <span class:dirty={catalog.source.workingTreeDirty} class:clean={!catalog.source.workingTreeDirty}>
          {catalog.source.workingTreeDirty ? "dirty" : "clean"}
        </span>
      </p>
    </header>
    <div class="atlas-layout">
      <aside class="atlas-sidebar">
        <nav class="region-picker" aria-label="Regions">
          <h2>Regions</h2>
          {#each catalog.regions as region}
            <button type="button" class:selected={region.id === activeRegion.id} onclick={() => selectRegion(region.id)}>
              <span>{region.label}</span>
              <small>{region.mapCount} catalog maps</small>
            </button>
          {/each}
        </nav>
        <section class="map-search" aria-label="Map search">
          <h2>Find a map</h2>
          <label for="map-search-input">Source name or map section</label>
          <input id="map-search-input" type="search" bind:value={searchQuery} placeholder="e.g. Route29 or MAPSEC..." />
          {#if searchQuery.trim()}
            <ul class="search-results" aria-label="Matching maps">
              {#if searchResults.length > 0}
                {#each searchResults as map (map.id)}
                  <li>
                    <button type="button" onclick={() => selectMap(map.name, true)}>
                      <span>{map.name}</span><small>{map.mapSection ?? "No map section"}</small>
                    </button>
                  </li>
                {/each}
              {:else}
                <li class="no-search-results">No source maps or map sections match.</li>
              {/if}
            </ul>
          {/if}
        </section>
      </aside>
      <div class="atlas-content">
        <div class="region-heading">
          <h2>{activeRegion.label}</h2>
          <p>Only default-visible surface maps are drawn. Pan, scroll, or pinch to explore.</p>
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
        <aside class="map-details" aria-live="polite">
          {#if !selectedMap}
            <h3>Map details</h3>
            <p>Select a map or choose a search result to inspect it and its exits.</p>
          {:else}
            <p class="eyebrow">Selected map</p>
            <h3>{selectedMap.name}</h3>
            <dl class="map-facts">
              <div><dt>Source ID</dt><dd><code>{selectedMap.id}</code></dd></div>
              <div><dt>Map section</dt><dd>{selectedMap.mapSection ?? "Not assigned"}</dd></div>
              <div><dt>Layout</dt><dd>{selectedMap.layout.widthMetatiles} × {selectedMap.layout.heightMetatiles} metatiles</dd></div>
              <div><dt>Atlas state</dt><dd>{renderedMapNames.has(selectedMap.name) ? "Rendered default-visible surface map" : "Not visible in the default atlas"}</dd></div>
            </dl>
            <section class="exit-details">
              <h4>Exits ({selectedMap.warps.length})</h4>
              {#if selectedMap.warps.length === 0}
                <p>This map has no catalogued warp exits.</p>
              {:else}
                <ul class="exit-list">
                  {#each selectedMap.warps as warp (warp.warpId)}
                    {@const destination = destinationFor(warp)}
                    <li>
                      <button type="button" class:selected={selectedWarp?.sourceMapName === selectedMap.name && selectedWarp?.warpId === warp.warpId} onclick={() => selectWarp({ sourceMapName: selectedMap!.name, warpId: warp.warpId })}>
                        <span>Warp {warp.warpId} · ({warp.xMetatiles}, {warp.yMetatiles})</span>
                        <small>{destination?.name ?? warp.destinationMap ?? warp.destinationMapId}</small>
                      </button>
                      {#if destination && renderedMapNames.has(destination.name) && selectedWarp?.sourceMapName === selectedMap.name && selectedWarp?.warpId === warp.warpId}
                        <button type="button" class="focus-destination" onclick={() => selectMap(destination!.name, true)}>Focus {destination.name}</button>
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
