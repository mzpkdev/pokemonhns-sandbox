import { catalogUrl } from "./urls.js"

export type CatalogConnection = {
  direction: "up" | "down" | "left" | "right" | "dive" | "emerge"
  offsetMetatiles: number
  destinationMapId: string
  destinationMap: string | null
}

export type CatalogWarp = {
  warpId: string
  xMetatiles: number
  yMetatiles: number
  elevation: number
  destinationWarpId: string
  destinationMapId: string
  destinationMap: string | null
}

export type CatalogMap = {
  name: string
  id: string
  region: string
  category: string
  sourceGroup: string
  sourceRegion: string | null
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
    layer: "surface" | "underwater" | "generated"
    defaultVisible: boolean
    variantGroup: string | null
    variant: string | null
  }
  presentation: {
    music: string | null
    weather: string | null
    showMapName: boolean | null
    requiresFlash: boolean | null
  }
  connections: CatalogConnection[]
  warps: CatalogWarp[]
}

export type MapCatalog = {
  $schema: string
  schemaVersion: number
  format: string
  pixelsPerMetatile: number
  source: {
    revision: string
    workingTreeDirty: boolean
  }
  regions: Array<{
    id: string
    label: string
    mapCount: number
    maps: string[]
  }>
  maps: CatalogMap[]
}

export class CatalogValidationError extends Error {
  constructor(
    readonly details: readonly string[],
    summary: string,
  ) {
    super(`${summary} ${details.join(" ")}`)
  }
}

const asRecord = (value: unknown): Record<string, unknown> | null => {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

const hasString = (value: unknown): value is string => {
  return typeof value === "string"
}

/** Check the catalog fields the tographer relies upon before rendering any map data. */
export const validateCatalog = (value: unknown): MapCatalog => {
  const root = asRecord(value)
  const details: string[] = []
  if (!root) {
    throw new CatalogValidationError(["catalog must be an object."], "The map catalog is invalid.")
  }
  if (!Array.isArray(root.maps)) {
    details.push("maps must be an array.")
  }
  if (!Array.isArray(root.regions)) {
    details.push("regions must be an array.")
  }
  if (typeof root.pixelsPerMetatile !== "number" || root.pixelsPerMetatile < 1) {
    details.push("pixelsPerMetatile must be a positive number.")
  }
  if (details.length > 0) {
    throw new CatalogValidationError(details, "The map catalog is invalid.")
  }

  const catalog = root as unknown as MapCatalog
  const mapNames = new Set<string>()
  const mapIds = new Set<string>()
  const regions = new Set(catalog.regions.map((region) => region.id))
  for (const map of catalog.maps) {
    if (!hasString(map.name) || !hasString(map.id) || !hasString(map.region)) {
      details.push("every map needs a name, id, and region.")
      continue
    }
    if (mapNames.has(map.name)) {
      details.push(`duplicate map name ${JSON.stringify(map.name)}.`)
    }
    if (mapIds.has(map.id)) {
      details.push(`duplicate map id ${JSON.stringify(map.id)}.`)
    }
    if (!regions.has(map.region)) {
      details.push(`${map.name} refers to undeclared region ${JSON.stringify(map.region)}.`)
    }
    if (map.image.widthPixels !== map.layout.widthMetatiles * catalog.pixelsPerMetatile) {
      details.push(`${map.name} has an inconsistent image width.`)
    }
    if (map.image.heightPixels !== map.layout.heightMetatiles * catalog.pixelsPerMetatile) {
      details.push(`${map.name} has an inconsistent image height.`)
    }
    mapNames.add(map.name)
    mapIds.add(map.id)
  }
  if (details.length > 0) {
    throw new CatalogValidationError(details, "The map catalog is inconsistent.")
  }
  return catalog
}

export const loadCatalog = async (signal?: AbortSignal): Promise<MapCatalog> => {
  const response = await fetch(catalogUrl(), { cache: "no-store", signal })
  if (!response.ok) {
    throw new Error(
      `Could not load the map catalog (${response.status} ${response.statusText}). Run pnpm run tographer:catalog first.`,
    )
  }
  return validateCatalog(await response.json())
}
