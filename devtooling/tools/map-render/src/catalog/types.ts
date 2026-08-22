export type MapConnection = {
  map: string
  offset: number
  direction: "up" | "down" | "left" | "right" | "dive" | "emerge"
}

export type WarpEvent = {
  x: number
  y: number
  elevation: number
  dest_map: string
  dest_warp_id: string
}

export type SourceMap = {
  id: string
  layout: string
  music?: string
  region_map_section?: string
  requires_flash?: boolean
  weather?: string
  map_type: string
  show_map_name?: boolean
  connections?: MapConnection[]
  warp_events?: WarpEvent[]
}

export type Layout = {
  id: string
  width: number
  height: number
  format?: string
  primary_tileset: string
  secondary_tileset: string
}

export type LayoutDocument = {
  layouts: Layout[]
}

export type MapGroups = {
  group_order: string[]
  [group: string]: string[]
}

export type CatalogRegion = {
  id: string
  label: string
}

export type CatalogMap = {
  name: string
  id: string
  region: string
  category: string
  sourceGroup: string
  sourceRegion: null
  mapType: string
  mapSection: string | null
  image: {
    path: string
    sha256: string
    widthPixels: number
    heightPixels: number
    overview: {
      path: string
      sha256: string
      widthPixels: number
      heightPixels: number
    }
  }
  layout: {
    id: string
    format: string
    widthMetatiles: number
    heightMetatiles: number
    primaryTileset: string
    secondaryTileset: string
  }
  world: {
    layer: "surface" | "underwater"
    defaultVisible: boolean
    variantGroup: null
    variant: null
  }
  presentation: {
    music: string | null
    weather: string | null
    showMapName: boolean | null
    requiresFlash: boolean | null
  }
  connections: Array<{
    direction: MapConnection["direction"]
    offsetMetatiles: number
    destinationMapId: string
    destinationMap: string | null
  }>
  warps: Array<{
    warpId: string
    xMetatiles: number
    yMetatiles: number
    elevation: number
    destinationWarpId: string
    destinationMapId: string
    destinationMap: string | null
  }>
}

export type MapCatalog = {
  $schema: "catalog.schema.json"
  schemaVersion: 1
  format: "pokemonhns-exterior-map-catalog"
  pixelsPerMetatile: 16
  source: {
    revision: string
    workingTreeDirty: boolean
  }
  regions: Array<CatalogRegion & { mapCount: number; maps: string[] }>
  maps: CatalogMap[]
}

export type RenderCatalogResult = {
  mapCount: number
  output: string
}
