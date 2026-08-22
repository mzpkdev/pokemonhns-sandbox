<script lang="ts">
  import { onMount } from "svelte"
  import Feature from "ol/Feature"
  import Point from "ol/geom/Point"
  import { fromExtent as polygonFromExtent } from "ol/geom/Polygon"
  import ImageLayer from "ol/layer/Image"
  import VectorLayer from "ol/layer/Vector"
  import OpenLayersMap from "ol/Map"
  import Projection from "ol/proj/Projection"
  import ImageStatic from "ol/source/ImageStatic"
  import VectorSource from "ol/source/Vector"
  import Fill from "ol/style/Fill"
  import CircleStyle from "ol/style/Circle"
  import Icon from "ol/style/Icon"
  import RegularShape from "ol/style/RegularShape"
  import Stroke from "ol/style/Stroke"
  import Style from "ol/style/Style"
  import View from "ol/View"
  import "ol/ol.css"

  import MapToolbar from "./MapToolbar.svelte"
  import type { CatalogMap, CatalogObject, MapCatalog } from "./catalog.js"
  import {
    cartographerExtent,
    solveGeography,
    toOpenLayersExtent,
    visibleSurfaceMaps,
  } from "./geography.js"
  import type { FocusRequest, ObjectSelection, WarpSelection } from "./types.js"
  import { mapImageUrl, type CartographerViewState } from "./urls.js"
  import { objectPlaceholderFor, type ObjectPlaceholderKind } from "./object-placeholders.js"

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
    fill: new Fill({ color: "rgba(143, 167, 189, 0.20)" }),
    stroke: new Stroke({ color: "#8fa7bd", width: 3 }),
  })
  const hoverStyle = new Style({
    fill: new Fill({ color: "rgba(192, 167, 120, 0.18)" }),
    stroke: new Stroke({ color: "#c0a778", width: 2 }),
  })
  const exitStyle = new Style({
    image: new CircleStyle({
      radius: 9,
      fill: new Fill({ color: "#c0a778" }),
      stroke: new Stroke({ color: "#14171a", width: 3 }),
    }),
  })
  const selectedExitStyle = new Style({
    image: new CircleStyle({
      radius: 11,
      fill: new Fill({ color: "#8fa7bd" }),
      stroke: new Stroke({ color: "#e5e7eb", width: 3 }),
    }),
  })
  const selectedObjectStyle = new Style({
    image: new CircleStyle({
      radius: 9,
      fill: new Fill({ color: "rgba(143, 167, 189, 0.24)" }),
      stroke: new Stroke({ color: "#e5e7eb", width: 2 }),
    }),
  })
  const placeholderStyles: Record<ObjectPlaceholderKind, Style> = {
    stateful: new Style({
      image: new RegularShape({
        points: 4,
        radius: 6,
        angle: Math.PI / 4,
        fill: new Fill({ color: "#7f9875" }),
        stroke: new Stroke({ color: "#14171a", width: 2 }),
      }),
    }),
    variable: new Style({
      image: new RegularShape({
        points: 4,
        radius: 6,
        angle: Math.PI / 4,
        fill: new Fill({ color: "#8295a7" }),
        stroke: new Stroke({ color: "#14171a", width: 2 }),
      }),
    }),
    expression: new Style({
      image: new RegularShape({
        points: 3,
        radius: 7,
        fill: new Fill({ color: "#b19a6a" }),
        stroke: new Stroke({ color: "#14171a", width: 2 }),
      }),
    }),
    unresolved: new Style({
      image: new RegularShape({
        points: 4,
        radius: 6,
        angle: Math.PI / 4,
        fill: new Fill({ color: "#a86772" }),
        stroke: new Stroke({ color: "#14171a", width: 2 }),
      }),
    }),
  }
  const objectStyles = new Map<string, Style>()

  let host = $state<HTMLDivElement | undefined>(undefined)
  let instance = $state<
    | {
        map: OpenLayersMap
        view: View
        exits: VectorLayer<VectorSource>
        objects: VectorLayer<VectorSource>
        geography: ReturnType<typeof solveGeography>
        extent: [number, number, number, number]
      }
    | undefined
  >(undefined)
  let hoveredMap = $state<string | null>(null)

  let surfaceMaps = $derived(visibleSurfaceMaps(maps))
  let geography = $derived(solveGeography(surfaceMaps))
  let extent = $derived(cartographerExtent(geography.placements, catalog.pixelsPerMetatile))

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

  const objectStyleFor = (object: CatalogObject): Style => {
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
      style: (feature) =>
        selectedWarp?.sourceMapName === feature.get("mapName") &&
        selectedWarp?.warpId === feature.get("warpId")
          ? selectedExitStyle
          : exitStyle,
    })
    const objects = new VectorLayer({
      source: objectSource,
      style: (feature) => {
        const object = feature.get("object") as CatalogObject | undefined
        if (!object) return placeholderStyles.unresolved
        const selected =
          selectedObject?.sourceMapName === feature.get("mapName") &&
          selectedObject?.objectId === feature.get("objectId")
        const objectStyle = objectStyleFor(object)
        return selected ? [selectedObjectStyle, objectStyle] : objectStyle
      },
    })
    const view = new View({
      projection,
      center: [(extent[0] + extent[2]) / 2, (extent[1] + extent[3]) / 2],
      zoom: 0,
    })
    const map = new OpenLayersMap({
      target: mapHost,
      controls: [],
      layers: [...imageRecords.map((record) => record.layer), hitLayer, exits, objects],
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
    instance = { map, view, exits, objects, geography, extent }
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
    class="overflow-hidden border border-cartographer-border bg-cartographer-panel shadow-[0_1.5rem_4rem_#02061199]"
    aria-label="Interactive cartographer"
  >
    <MapToolbar
      surfaceMapCount={surfaceMaps.length}
      componentCount={geography.components.length}
      residualCount={geography.residualCount}
      {showExits}
      {showObjects}
      {onToggleExits}
      {onToggleObjects}
      onZoomOut={() => instance?.view.setZoom((instance.view.getZoom() ?? 0) - 1)}
      onZoomIn={() => instance?.view.setZoom((instance.view.getZoom() ?? 0) + 1)}
      onFit={() => instance?.view.fit(extent, { padding: [40, 40, 40, 40], maxZoom: 3 })}
    />
    <div
      class="cartographer-map-field h-[58vh] min-h-88 border-t border-cartographer-border md:h-[min(70vh,48rem)] md:min-h-112"
      bind:this={host}
      aria-label="Interactive regional map"
    ></div>
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
    background-color: #14171a;
    background-image:
      linear-gradient(#ffffff08 1px, transparent 1px),
      linear-gradient(90deg, #ffffff08 1px, transparent 1px),
      radial-gradient(circle at center, #292f36 0, #14171a 75%);
    background-size:
      32px 32px,
      32px 32px,
      auto;
  }

  .cartographer-map-field :global(.ol-viewport) {
    font-family: var(--font-cartographer-mono);
  }
</style>
