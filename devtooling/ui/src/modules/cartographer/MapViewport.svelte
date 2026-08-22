<script lang="ts">
  import { onMount } from "svelte"
  import Feature from "ol/Feature"
  import Point from "ol/geom/Point"
  import LineString from "ol/geom/LineString"
  import { fromExtent as polygonFromExtent } from "ol/geom/Polygon"
  import ImageLayer from "ol/layer/Image"
  import VectorLayer from "ol/layer/Vector"
  import OpenLayersMap from "ol/Map"
  import Projection from "ol/proj/Projection"
  import ImageStatic from "ol/source/ImageStatic"
  import VectorSource from "ol/source/Vector"
  import Fill from "ol/style/Fill"
  import Icon from "ol/style/Icon"
  import RegularShape from "ol/style/RegularShape"
  import Stroke from "ol/style/Stroke"
  import Style from "ol/style/Style"
  import Text from "ol/style/Text"
  import View from "ol/View"
  import "ol/ol.css"

  import MapToolbar from "./MapToolbar.svelte"
  import AtlasOverlapPanel from "./AtlasOverlapPanel.svelte"
  import TopologyConflictPanel from "./TopologyConflictPanel.svelte"
  import type {
    CatalogMap,
    CatalogObject,
    CatalogPlacement,
    CatalogDirectTopologyMismatch,
    CatalogMissingReverseConnection,
    CatalogTopologyDiagnostic,
    MapCatalog,
  } from "./catalog.js"
  import {
    cartographerExtent,
    solveGeography,
    toOpenLayersExtent,
    visibleSurfaceMaps,
  } from "./geography.js"
  import type { FocusRequest, ObjectSelection, WarpSelection } from "./types.js"
  import { mapImageUrl, type CartographerViewState } from "./urls.js"
  import { objectPlaceholderFor, type ObjectPlaceholderKind } from "./object-placeholders.js"
  import { cartographerColor, cartographerColorWithAlpha } from "./palette.js"

  type Props = {
    catalog: MapCatalog
    maps: CatalogMap[]
    selectedMapName?: string | null
    selectedWarp?: WarpSelection | null
    selectedObject?: ObjectSelection | null
    initialView?: CartographerViewState | null
    focusRequest?: FocusRequest | null
    showExits?: boolean
    showObjects?: boolean
    onSelectMap?: (name: string) => void
    onSelectWarp?: (selection: WarpSelection) => void
    onSelectObject?: (selection: ObjectSelection) => void
    onCameraChange?: (view: CartographerViewState) => void
    onToggleExits?: (value: boolean) => void
    onToggleObjects?: (value: boolean) => void
  }

  let {
    catalog,
    maps,
    selectedMapName = null,
    selectedWarp = null,
    selectedObject = null,
    initialView = null,
    focusRequest = null,
    showExits = false,
    showObjects = false,
    onSelectMap,
    onSelectWarp,
    onSelectObject,
    onCameraChange,
    onToggleExits,
    onToggleObjects,
  }: Props = $props()

  const baseStyle = new Style({
    fill: new Fill({ color: "rgba(0, 0, 0, 0)" }),
    stroke: new Stroke({ color: "rgba(0, 0, 0, 0)", width: 1 }),
  })
  const selectedStyle = new Style({
    fill: new Fill({ color: cartographerColorWithAlpha("signal", 0.2) }),
    stroke: new Stroke({ color: cartographerColor("signal"), width: 3 }),
  })
  const hoverStyle = new Style({
    fill: new Fill({ color: cartographerColorWithAlpha("amber", 0.18) }),
    stroke: new Stroke({ color: cartographerColor("amber"), width: 2 }),
  })
  const exitStyle = new Style({
    image: new RegularShape({
      points: 4,
      radius: 6,
      angle: Math.PI / 4,
      fill: new Fill({ color: cartographerColorWithAlpha("field", 0.72) }),
      stroke: new Stroke({ color: cartographerColor("muted-soft"), width: 1.5 }),
    }),
  })
  const selectedExitStyle = new Style({
    image: new RegularShape({
      points: 4,
      radius: 8,
      angle: Math.PI / 4,
      fill: new Fill({ color: cartographerColorWithAlpha("signal", 0.32) }),
      stroke: new Stroke({ color: cartographerColor("signal-strong"), width: 2 }),
    }),
  })
  const selectedObjectStyle = new Style({
    image: new RegularShape({
      points: 4,
      radius: 9,
      angle: Math.PI / 4,
      fill: new Fill({ color: cartographerColorWithAlpha("signal", 0.24) }),
      stroke: new Stroke({ color: cartographerColor("ink"), width: 2 }),
    }),
  })
  const lightSourceStyle = new Style({
    image: new RegularShape({
      points: 4,
      radius: 5,
      angle: Math.PI / 4,
      fill: new Fill({ color: cartographerColor("signal-soft") }),
      stroke: new Stroke({ color: cartographerColor("border-strong"), width: 1 }),
    }),
  })
  const directMismatchStyles = new Map<string, Style>()
  const directMismatchStyleFor = (mapName: string): Style => {
    const existing = directMismatchStyles.get(mapName)
    if (existing) return existing
    const style = new Style({
      fill: new Fill({ color: cartographerColorWithAlpha("diagnostic", 0.1) }),
      stroke: new Stroke({ color: cartographerColor("diagnostic-ink"), width: 3 }),
      text: new Text({
        text: `Forward ${mapName}`,
        font: "600 11px 'IBM Plex Mono', monospace",
        fill: new Fill({ color: cartographerColor("diagnostic-ink") }),
        backgroundFill: new Fill({ color: cartographerColorWithAlpha("diagnostic-panel", 0.86) }),
        padding: [3, 5, 3, 5],
        textAlign: "left",
        textBaseline: "top",
        offsetX: 7,
        offsetY: 7,
        overflow: true,
      }),
      zIndex: 2,
    })
    directMismatchStyles.set(mapName, style)
    return style
  }
  const mismatchLineStyle = new Style({
    stroke: new Stroke({ color: cartographerColor("diagnostic-line"), width: 2, lineDash: [5, 5] }),
    zIndex: 1,
  })
  const atlasOverlapStyle = new Style({
    fill: new Fill({ color: cartographerColorWithAlpha("layout-overlap", 0.32) }),
    stroke: new Stroke({ color: cartographerColor("layout-overlap"), width: 3 }),
    zIndex: 1,
  })
  const placeholderStyles: Record<ObjectPlaceholderKind, Style> = {
    stateful: new Style({
      image: new RegularShape({
        points: 4,
        radius: 6,
        angle: Math.PI / 4,
        fill: new Fill({ color: cartographerColor("object-stateful") }),
        stroke: new Stroke({ color: cartographerColor("field"), width: 2 }),
      }),
    }),
    variable: new Style({
      image: new RegularShape({
        points: 4,
        radius: 6,
        angle: Math.PI / 4,
        fill: new Fill({ color: cartographerColor("object-variable") }),
        stroke: new Stroke({ color: cartographerColor("field"), width: 2 }),
      }),
    }),
    expression: new Style({
      image: new RegularShape({
        points: 3,
        radius: 7,
        fill: new Fill({ color: cartographerColor("object-expression") }),
        stroke: new Stroke({ color: cartographerColor("field"), width: 2 }),
      }),
    }),
    unresolved: new Style({
      image: new RegularShape({
        points: 4,
        radius: 6,
        angle: Math.PI / 4,
        fill: new Fill({ color: cartographerColor("object-unresolved") }),
        stroke: new Stroke({ color: cartographerColor("field"), width: 2 }),
      }),
    }),
  }
  const objectStyles = new Map<string, Style>()
  const styleScales = new WeakMap<Style, number>()

  const scaleForResolution = (resolution: number): number => {
    const safeResolution = Math.max(resolution, 0.1)
    return Math.min(1.8, Math.max(0.5, (6 / safeResolution) ** 0.4))
  }

  const scaledStyle = (style: Style, resolution: number): Style => {
    const scale = scaleForResolution(resolution)
    if (styleScales.get(style) !== scale) {
      style.getImage()?.setScale(scale)
      styleScales.set(style, scale)
    }
    return style
  }

  let host = $state<HTMLDivElement | undefined>(undefined)
  let instance = $state<
    | {
        map: OpenLayersMap
        view: View
        exits: VectorLayer<VectorSource>
        objects: VectorLayer<VectorSource>
        topologyConflicts: VectorLayer<VectorSource>
        atlasOverlaps: VectorLayer<VectorSource>
        imageLayers: ReadonlyMap<string, ImageLayer<ImageStatic>>
        geography: ReturnType<typeof solveGeography>
        extent: [number, number, number, number]
      }
    | undefined
  >(undefined)
  let hoveredMap = $state<string | null>(null)
  let showTopologyConflicts = $state(false)
  let showAtlasOverlaps = $state(false)

  let surfaceMaps = $derived(visibleSurfaceMaps(maps))
  let geography = $derived(solveGeography(surfaceMaps))
  let extent = $derived(cartographerExtent(geography.placements, catalog.pixelsPerMetatile))
  const isDirectMismatch = (
    diagnostic: CatalogTopologyDiagnostic,
  ): diagnostic is CatalogDirectTopologyMismatch => {
    return diagnostic.code === "direct_connection_mismatch"
  }

  const isDirectDiagnostic = (
    diagnostic: CatalogTopologyDiagnostic,
  ): diagnostic is CatalogDirectTopologyMismatch | CatalogMissingReverseConnection => {
    return (
      diagnostic.code === "direct_connection_mismatch" ||
      diagnostic.code === "missing_reverse_connection"
    )
  }

  let topologyDiagnostics = $derived(
    catalog.topology.conflicts.filter((diagnostic) => {
      return (
        isDirectDiagnostic(diagnostic) &&
        geography.placements[diagnostic.connection.source.map] &&
        geography.placements[diagnostic.connection.destination.map]
      )
    }),
  )
  let directTopologyMismatches = $derived(topologyDiagnostics.filter(isDirectMismatch))
  let atlasOverlaps = $derived(geography.overlaps)
  let atlasOverlapMapNames = $derived(new Set(atlasOverlaps.flatMap((overlap) => overlap.maps)))

  const visualDirectMismatchFor = (
    diagnostic: CatalogDirectTopologyMismatch,
  ): { expected: CatalogPlacement; actual: CatalogPlacement } => {
    const source = geography.placements[diagnostic.connection.source.map]!
    return {
      expected: {
        ...diagnostic.forwardPlacement,
        x: source.x + diagnostic.forwardPlacement.x,
        y: source.y + diagnostic.forwardPlacement.y,
      },
      actual: {
        ...diagnostic.reversePlacement,
        x: source.x + diagnostic.reversePlacement.x,
        y: source.y + diagnostic.reversePlacement.y,
      },
    }
  }

  const placementsOverlap = (left: CatalogPlacement, right: CatalogPlacement): boolean => {
    return (
      left.x < right.x + right.width &&
      left.x + left.width > right.x &&
      left.y < right.y + right.height &&
      left.y + left.height > right.y
    )
  }

  const updateExitVisibility = (): void => {
    if (!instance) return
    instance.exits.setVisible(
      showExits || (instance.view.getResolution() ?? Number.POSITIVE_INFINITY) <= 16,
    )
  }

  const updateObjectVisibility = (): void => {
    if (!instance) return
    instance.objects.setVisible(
      showObjects || (instance.view.getResolution() ?? Number.POSITIVE_INFINITY) <= 10,
    )
  }

  const updateTopologyConflictVisibility = (): void => {
    if (!instance) return
    instance.topologyConflicts.setVisible(showTopologyConflicts)
  }

  const updateAtlasOverlapVisibility = (): void => {
    if (!instance) return
    instance.atlasOverlaps.setVisible(showAtlasOverlaps)
    for (const [name, layer] of instance.imageLayers) {
      layer.setOpacity(showAtlasOverlaps && atlasOverlapMapNames.has(name) ? 0.5 : 1)
    }
  }

  const objectStyleFor = (object: CatalogObject): Style => {
    if (object.graphicsId === "OBJ_EVENT_GFX_LIGHT_SPRITE") return lightSourceStyle
    const placeholder = objectPlaceholderFor(object)
    if (placeholder) return placeholderStyles[placeholder.kind]
    if (!object.sprite) return placeholderStyles.unresolved
    const existing = objectStyles.get(object.sprite.path)
    if (existing) return existing
    const style = new Style({
      image: new Icon({
        src: mapImageUrl(object.sprite.path),
        width: object.sprite.widthPixels,
        height: object.sprite.heightPixels,
        anchor: [object.sprite.anchor.xPixels, object.sprite.anchor.yPixels],
        anchorXUnits: "pixels",
        anchorYUnits: "pixels",
        crossOrigin: "anonymous",
      }),
    })
    objectStyles.set(object.sprite.path, style)
    return style
  }

  const focusMap = (name: string): void => {
    if (!instance) return
    const placement = instance.geography.placements[name]
    if (!placement) return
    instance.view.fit(toOpenLayersExtent(placement, catalog.pixelsPerMetatile), {
      padding: [72, 72, 72, 72],
      maxZoom: 3,
    })
  }

  $effect(() => {
    if (!instance) return
    updateExitVisibility()
    updateObjectVisibility()
    updateTopologyConflictVisibility()
    updateAtlasOverlapVisibility()
    instance.map.render()
  })

  $effect(() => {
    if (focusRequest) focusMap(focusRequest.mapName)
  })

  onMount(() => {
    if (!extent || !host) return
    const mapHost = host
    const projection = new Projection({
      code: "pokemonhns-cartographer-pixels",
      units: "pixels",
      extent,
    })
    const createImageSource = (
      map: CatalogMap,
      imageExtent: [number, number, number, number],
      overview: boolean,
    ): ImageStatic => {
      return new ImageStatic({
        url: mapImageUrl(overview ? map.image.overview.path : map.image.path),
        imageExtent,
        projection,
        interpolate: false,
      })
    }
    const imageRecords = surfaceMaps.map((map) => {
      const placement = geography.placements[map.name]!
      const imageExtent = toOpenLayersExtent(placement, catalog.pixelsPerMetatile)
      return {
        map,
        imageExtent,
        layer: new ImageLayer({ source: createImageSource(map, imageExtent, true) }),
      }
    })
    const hitSource = new VectorSource()
    const exitSource = new VectorSource()
    const objectSource = new VectorSource()
    const conflictSource = new VectorSource()
    const overlapSource = new VectorSource()
    for (const map of surfaceMaps) {
      const placement = geography.placements[map.name]!
      hitSource.addFeature(
        new Feature({
          geometry: polygonFromExtent(toOpenLayersExtent(placement, catalog.pixelsPerMetatile)),
          mapName: map.name,
        }),
      )
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
        )
      }
      for (const object of map.objects ?? []) {
        objectSource.addFeature(
          new Feature({
            geometry: new Point([
              (placement.x + object.xMetatiles + 0.5) * catalog.pixelsPerMetatile,
              -(placement.y + object.yMetatiles + 1) * catalog.pixelsPerMetatile,
            ]),
            mapName: map.name,
            objectId: object.objectId,
            object,
          }),
        )
      }
    }
    for (const diagnostic of directTopologyMismatches) {
      const visual = visualDirectMismatchFor(diagnostic)
      const expectedExtent = toOpenLayersExtent(visual.expected, catalog.pixelsPerMetatile)
      const actualExtent = toOpenLayersExtent(visual.actual, catalog.pixelsPerMetatile)
      conflictSource.addFeature(
        new Feature({
          geometry: polygonFromExtent(expectedExtent),
          kind: "forward",
          expectedMapName: diagnostic.connection.destination.map,
        }),
      )
      if (!placementsOverlap(visual.expected, visual.actual)) {
        conflictSource.addFeature(
          new Feature({
            geometry: new LineString([
              [
                (expectedExtent[0] + expectedExtent[2]) / 2,
                (expectedExtent[1] + expectedExtent[3]) / 2,
              ],
              [(actualExtent[0] + actualExtent[2]) / 2, (actualExtent[1] + actualExtent[3]) / 2],
            ]),
            kind: "connection",
          }),
        )
      }
    }
    for (const overlap of atlasOverlaps) {
      overlapSource.addFeature(
        new Feature({
          geometry: polygonFromExtent(toOpenLayersExtent(overlap.area, catalog.pixelsPerMetatile)),
        }),
      )
    }
    const hitLayer = new VectorLayer({
      source: hitSource,
      style: (feature) => {
        const name = feature.get("mapName") as string | undefined
        if (name === selectedMapName) return selectedStyle
        return name === hoveredMap ? hoverStyle : baseStyle
      },
    })
    const exits = new VectorLayer({
      source: exitSource,
      style: (feature, resolution) =>
        scaledStyle(
          selectedWarp?.sourceMapName === feature.get("mapName") &&
            selectedWarp?.warpId === feature.get("warpId")
            ? selectedExitStyle
            : exitStyle,
          resolution,
        ),
    })
    const objects = new VectorLayer({
      source: objectSource,
      style: (feature, resolution) => {
        const object = feature.get("object") as CatalogObject | undefined
        if (!object) return scaledStyle(placeholderStyles.unresolved, resolution)
        const selected =
          selectedObject?.sourceMapName === feature.get("mapName") &&
          selectedObject?.objectId === feature.get("objectId")
        const objectStyle = objectStyleFor(object)
        if (!selected) return scaledStyle(objectStyle, resolution)
        return [scaledStyle(selectedObjectStyle, resolution), scaledStyle(objectStyle, resolution)]
      },
    })
    const topologyConflicts = new VectorLayer({
      source: conflictSource,
      style: (feature) => {
        if (feature.get("kind") !== "forward") return mismatchLineStyle
        return directMismatchStyleFor(feature.get("expectedMapName") as string)
      },
      visible: showTopologyConflicts,
    })
    const atlasOverlapLayer = new VectorLayer({
      source: overlapSource,
      style: atlasOverlapStyle,
      visible: showAtlasOverlaps,
    })
    const view = new View({
      projection,
      center: [(extent[0] + extent[2]) / 2, (extent[1] + extent[3]) / 2],
      zoom: 0,
    })
    const map = new OpenLayersMap({
      target: mapHost,
      controls: [],
      layers: [
        ...imageRecords.map((record) => record.layer),
        hitLayer,
        exits,
        objects,
        topologyConflicts,
        atlasOverlapLayer,
      ],
      view,
    })
    let showingNative = false
    const reportCamera = (): void => {
      const center = view.getCenter()
      const zoom = view.getZoom()
      const [x, y] = center ?? []
      if (x !== undefined && y !== undefined && zoom !== undefined) {
        onCameraChange?.({ center: [x, y], zoom })
      }
      updateExitVisibility()
      updateObjectVisibility()
      const shouldShowNative = (view.getResolution() ?? Number.POSITIVE_INFINITY) <= 16
      if (shouldShowNative === showingNative) return
      showingNative = shouldShowNative
      for (const record of imageRecords) {
        record.layer.setSource(createImageSource(record.map, record.imageExtent, !showingNative))
      }
    }
    map.on("moveend", reportCamera)
    map.on("pointermove", (event) => {
      if (event.dragging) return
      let name: string | null = null
      map.forEachFeatureAtPixel(event.pixel, (feature) => {
        const candidate = feature.get("mapName")
        if (typeof candidate === "string") name = candidate
      })
      if (hoveredMap !== name) {
        hoveredMap = name
        map.render()
      }
      mapHost.style.cursor = name ? "pointer" : ""
    })
    map.on("singleclick", (event) => {
      const chosen: {
        value: { mapName: string; warpId?: string; objectId?: string } | null
      } = { value: null }
      map.forEachFeatureAtPixel(
        event.pixel,
        (feature) => {
          const mapName = feature.get("mapName")
          if (typeof mapName !== "string") return undefined
          const warpId = feature.get("warpId")
          const objectId = feature.get("objectId")
          chosen.value = {
            mapName,
            ...(typeof warpId === "string" ? { warpId } : {}),
            ...(typeof objectId === "string" ? { objectId } : {}),
          }
          return typeof warpId === "string" || typeof objectId === "string"
        },
        {
          hitTolerance: 12,
          layerFilter: (layer) => layer === hitLayer || layer === exits || layer === objects,
        },
      )
      if (!chosen.value) return
      onSelectMap?.(chosen.value.mapName)
      if (chosen.value.warpId)
        onSelectWarp?.({ sourceMapName: chosen.value.mapName, warpId: chosen.value.warpId })
      if (chosen.value.objectId)
        onSelectObject?.({ sourceMapName: chosen.value.mapName, objectId: chosen.value.objectId })
    })
    instance = {
      map,
      view,
      exits,
      objects,
      topologyConflicts,
      atlasOverlaps: atlasOverlapLayer,
      imageLayers: new Map(imageRecords.map((record) => [record.map.name, record.layer])),
      geography,
      extent,
    }
    view.fit(extent, { padding: [40, 40, 40, 40], maxZoom: 3 })
    if (initialView) {
      view.setCenter(initialView.center)
      view.setZoom(initialView.zoom)
    }
    reportCamera()
    return () => {
      map.setTarget(undefined)
      instance = undefined
    }
  })
</script>

{#if extent}
  <section
    class="overflow-hidden border border-cartographer-border bg-cartographer-panel shadow-cartographer-panel"
    aria-label="Interactive cartographer"
  >
    <MapToolbar
      surfaceMapCount={surfaceMaps.length}
      componentCount={geography.components.length}
      topologyDiagnosticCount={topologyDiagnostics.length}
      atlasOverlapCount={atlasOverlaps.length}
      {showTopologyConflicts}
      {showAtlasOverlaps}
      {showExits}
      {showObjects}
      {onToggleExits}
      {onToggleObjects}
      onToggleTopologyConflicts={(value) => (showTopologyConflicts = value)}
      onToggleAtlasOverlaps={(value) => (showAtlasOverlaps = value)}
      onZoomOut={() => instance?.view.setZoom((instance.view.getZoom() ?? 0) - 1)}
      onZoomIn={() => instance?.view.setZoom((instance.view.getZoom() ?? 0) + 1)}
      onFit={() => instance?.view.fit(extent, { padding: [40, 40, 40, 40], maxZoom: 3 })}
    />
    <div
      class="cartographer-map-field h-[58vh] min-h-88 border-t border-cartographer-border md:h-[min(70vh,48rem)] md:min-h-112"
      bind:this={host}
      aria-label="Interactive regional map"
    ></div>
    <TopologyConflictPanel diagnostics={topologyDiagnostics} visible={showTopologyConflicts} />
    <AtlasOverlapPanel overlaps={atlasOverlaps} visible={showAtlasOverlaps} />
    <p
      class="m-0 border-t border-cartographer-border px-4 py-3 font-cartographer-mono text-[0.68rem] leading-5 tracking-[0.04em] text-cartographer-muted"
    >
      Pan, scroll, or pinch to inspect. Select a map for source details. Exits and objects appear at
      close range.
    </p>
  </section>
{:else}
  <p class="p-8">This region has no default-visible surface maps.</p>
{/if}

<style>
  .cartographer-map-field {
    background-color: var(--color-cartographer-field);
    background-image:
      linear-gradient(
        color-mix(in srgb, var(--color-cartographer-ink) 3%, transparent) 1px,
        transparent 1px
      ),
      linear-gradient(
        90deg,
        color-mix(in srgb, var(--color-cartographer-ink) 3%, transparent) 1px,
        transparent 1px
      ),
      radial-gradient(
        circle at center,
        var(--color-cartographer-slate-700) 0,
        var(--color-cartographer-field) 75%
      );
    background-size:
      32px 32px,
      32px 32px,
      auto;
  }

  .cartographer-map-field :global(.ol-viewport) {
    font-family: var(--font-cartographer-mono);
  }
</style>
