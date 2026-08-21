<script lang="ts">
  import { onMount } from "svelte";
  import Feature from "ol/Feature";
  import Point from "ol/geom/Point";
  import { fromExtent as polygonFromExtent } from "ol/geom/Polygon";
  import ImageLayer from "ol/layer/Image";
  import VectorLayer from "ol/layer/Vector";
  import Map from "ol/Map";
  import Projection from "ol/proj/Projection";
  import ImageStatic from "ol/source/ImageStatic";
  import VectorSource from "ol/source/Vector";
  import Fill from "ol/style/Fill";
  import CircleStyle from "ol/style/Circle";
  import Stroke from "ol/style/Stroke";
  import Style from "ol/style/Style";
  import View from "ol/View";
  import "ol/ol.css";

  import MapToolbar from "./MapToolbar.svelte";
  import type { CatalogMap, MapCatalog } from "./catalog.js";
  import { atlasExtent, solveGeography, toOpenLayersExtent, visibleSurfaceMaps } from "./geography.js";
  import type { FocusRequest, WarpSelection } from "./types.js";
  import { mapImageUrl, type AtlasViewState } from "./urls.js";

  type Props = {
    catalog: MapCatalog;
    maps: CatalogMap[];
    selectedMapName?: string | null;
    selectedWarp?: WarpSelection | null;
    initialView?: AtlasViewState | null;
    focusRequest?: FocusRequest | null;
    showExits?: boolean;
    onSelectMap?: (name: string) => void;
    onSelectWarp?: (selection: WarpSelection) => void;
    onCameraChange?: (view: AtlasViewState) => void;
    onToggleExits?: (value: boolean) => void;
  };

  let {
    catalog,
    maps,
    selectedMapName = null,
    selectedWarp = null,
    initialView = null,
    focusRequest = null,
    showExits = false,
    onSelectMap,
    onSelectWarp,
    onCameraChange,
    onToggleExits,
  }: Props = $props();

  const baseStyle = new Style({
    fill: new Fill({ color: "rgba(0, 0, 0, 0)" }),
    stroke: new Stroke({ color: "rgba(0, 0, 0, 0)", width: 1 }),
  });
  const selectedStyle = new Style({
    fill: new Fill({ color: "rgba(255, 211, 95, 0.16)" }),
    stroke: new Stroke({ color: "#ffb703", width: 3 }),
  });
  const hoverStyle = new Style({
    fill: new Fill({ color: "rgba(229, 238, 123, 0.22)" }),
    stroke: new Stroke({ color: "#d8ee78", width: 2 }),
  });
  const exitStyle = new Style({
    image: new CircleStyle({
      radius: 9,
      fill: new Fill({ color: "#ee6c4d" }),
      stroke: new Stroke({ color: "#fffdf7", width: 3 }),
    }),
  });
  const selectedExitStyle = new Style({
    image: new CircleStyle({
      radius: 11,
      fill: new Fill({ color: "#f77f00" }),
      stroke: new Stroke({ color: "#432818", width: 3 }),
    }),
  });

  let host = $state<HTMLDivElement | undefined>(undefined);
  let instance = $state<
    | {
        map: Map;
        view: View;
        exits: VectorLayer<VectorSource>;
        geography: ReturnType<typeof solveGeography>;
        extent: [number, number, number, number];
      }
    | undefined
  >(undefined);
  let hoveredMap = $state<string | null>(null);

  let surfaceMaps = $derived(visibleSurfaceMaps(maps));
  let geography = $derived(solveGeography(surfaceMaps));
  let extent = $derived(atlasExtent(geography.placements, catalog.pixelsPerMetatile));

  function updateExitVisibility(): void {
    if (!instance) return;
    instance.exits.setVisible(showExits || (instance.view.getResolution() ?? Number.POSITIVE_INFINITY) <= 16);
  }

  function focusMap(name: string): void {
    if (!instance) return;
    const placement = instance.geography.placements[name];
    if (!placement) return;
    instance.view.fit(toOpenLayersExtent(placement, catalog.pixelsPerMetatile), {
      padding: [72, 72, 72, 72],
      maxZoom: 3,
    });
  }

  $effect(() => {
    if (!instance) return;
    updateExitVisibility();
    instance.map.render();
  });

  $effect(() => {
    if (focusRequest) focusMap(focusRequest.mapName);
  });

  onMount(() => {
    if (!extent || !host) return;
    const mapHost = host;
    const projection = new Projection({ code: "pokemonhns-atlas-pixels", units: "pixels", extent });
    function createImageSource(map: CatalogMap, imageExtent: [number, number, number, number], overview: boolean): ImageStatic {
      return new ImageStatic({
        url: mapImageUrl(overview ? map.image.overview.path : map.image.path),
        imageExtent,
        projection,
        interpolate: false,
      })
    }
    const imageRecords = surfaceMaps.map((map) => {
      const placement = geography.placements[map.name]!;
      const imageExtent = toOpenLayersExtent(placement, catalog.pixelsPerMetatile);
      return { map, imageExtent, layer: new ImageLayer({ source: createImageSource(map, imageExtent, true) }) };
    });
    const hitSource = new VectorSource();
    const exitSource = new VectorSource();
    for (const map of surfaceMaps) {
      const placement = geography.placements[map.name]!;
      hitSource.addFeature(
        new Feature({ geometry: polygonFromExtent(toOpenLayersExtent(placement, catalog.pixelsPerMetatile)), mapName: map.name }),
      );
      for (const warp of map.warps) {
        exitSource.addFeature(
          new Feature({
            geometry: new Point([
              (placement.x + warp.xMetatiles + 0.5) * catalog.pixelsPerMetatile,
              -(placement.y + warp.yMetatiles + 0.5) * catalog.pixelsPerMetatile,
            ]),
            mapName: map.name,
            warpId: warp.warpId,
          }),
        );
      }
    }
    const hitLayer = new VectorLayer({
      source: hitSource,
      style: (feature) => {
        const name = feature.get("mapName") as string | undefined;
        if (name === selectedMapName) return selectedStyle;
        return name === hoveredMap ? hoverStyle : baseStyle;
      },
    });
    const exits = new VectorLayer({
      source: exitSource,
      style: (feature) =>
        selectedWarp?.sourceMapName === feature.get("mapName") && selectedWarp?.warpId === feature.get("warpId")
          ? selectedExitStyle
          : exitStyle,
    });
    const view = new View({
      projection,
      center: [(extent[0] + extent[2]) / 2, (extent[1] + extent[3]) / 2],
      zoom: 0,
    });
    const map = new Map({
      target: mapHost,
      controls: [],
      layers: [...imageRecords.map((record) => record.layer), hitLayer, exits],
      view,
    });
    let showingNative = false;
    function reportCamera(): void {
      const center = view.getCenter();
      const zoom = view.getZoom();
      const [x, y] = center ?? [];
      if (x !== undefined && y !== undefined && zoom !== undefined) {
        onCameraChange?.({ center: [x, y], zoom });
      }
      updateExitVisibility();
      const shouldShowNative = (view.getResolution() ?? Number.POSITIVE_INFINITY) <= 16;
      if (shouldShowNative === showingNative) return;
      showingNative = shouldShowNative;
      for (const record of imageRecords) {
        record.layer.setSource(createImageSource(record.map, record.imageExtent, !showingNative));
      }
    }
    map.on("moveend", reportCamera);
    map.on("pointermove", (event) => {
      if (event.dragging) return;
      let name: string | null = null;
      map.forEachFeatureAtPixel(event.pixel, (feature) => {
        const candidate = feature.get("mapName");
        if (typeof candidate === "string") name = candidate;
      });
      if (hoveredMap !== name) {
        hoveredMap = name;
        map.render();
      }
      mapHost.style.cursor = name ? "pointer" : "";
    });
    map.on("singleclick", (event) => {
      const chosen: { value: { mapName: string; warpId?: string } | null } = { value: null };
      map.forEachFeatureAtPixel(event.pixel, (feature) => {
        const mapName = feature.get("mapName");
        if (typeof mapName !== "string") return undefined;
        const warpId = feature.get("warpId");
        chosen.value = { mapName, ...(typeof warpId === "string" ? { warpId } : {}) };
        return typeof warpId === "string";
      }, { hitTolerance: 12, layerFilter: (layer) => layer === hitLayer || layer === exits });
      if (!chosen.value) return;
      onSelectMap?.(chosen.value.mapName);
      if (chosen.value.warpId) onSelectWarp?.({ sourceMapName: chosen.value.mapName, warpId: chosen.value.warpId });
    });
    instance = { map, view, exits, geography, extent };
    view.fit(extent, { padding: [40, 40, 40, 40], maxZoom: 3 });
    if (initialView) {
      view.setCenter(initialView.center);
      view.setZoom(initialView.zoom);
    }
    reportCamera();
    return () => {
      map.setTarget(undefined);
      instance = undefined;
    };
  });
</script>

{#if extent}
  <section class="overflow-hidden rounded-xl border border-atlas-border bg-atlas-panel shadow-[0_5px_18px_#56634c1b]" aria-label="Interactive map atlas">
    <MapToolbar
      surfaceMapCount={surfaceMaps.length}
      componentCount={geography.components.length}
      residualCount={geography.residualCount}
      {showExits}
      onToggleExits={onToggleExits}
      onZoomOut={() => instance?.view.setZoom((instance.view.getZoom() ?? 0) - 1)}
      onZoomIn={() => instance?.view.setZoom((instance.view.getZoom() ?? 0) + 1)}
      onFit={() => instance?.view.fit(extent, { padding: [40, 40, 40, 40], maxZoom: 3 })}
    />
    <div class="h-[60vh] min-h-88 border-t border-[#d6dfd3] bg-[#cfdacc] md:h-[min(70vh,48rem)] md:min-h-112" bind:this={host} aria-label="Interactive regional map"></div>
    <p class="m-0 px-4 py-3 text-sm text-atlas-muted">Pan, scroll, or pinch to explore. Click a map for details; exits appear when zoomed in or when Exits is enabled.</p>
  </section>
{:else}
  <p class="p-8">This region has no default-visible surface maps.</p>
{/if}
