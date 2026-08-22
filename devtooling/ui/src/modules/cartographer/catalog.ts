import { catalogUrl } from "./urls.js"

export type CatalogConnection = {
  direction: "up" | "down" | "left" | "right" | "dive" | "emerge"
  offsetMetatiles: number
  destinationMapId: string
  destinationMap: string | null
}

export type CatalogPlacement = {
  x: number
  y: number
  width: number
  height: number
}

export type CatalogTopologyHeader = {
  map: string
  path: string
  pointer: string
}

export type CatalogTopologyConnection = {
  source: {
    map: string
    mapId: string
    header: CatalogTopologyHeader
  }
  destination: {
    map: string
    mapId: string
  }
  direction: "up" | "down" | "left" | "right"
  offsetMetatiles: number
}

export type CatalogTopologyConnectionPair = {
  connection: CatalogTopologyConnection
  reverseConnection: CatalogTopologyConnection
}

export type CatalogDirectTopologyMismatch = {
  code: "direct_connection_mismatch"
  explanation: string
  connection: CatalogTopologyConnection
  reverseConnection: CatalogTopologyConnection
  expectedReverse: {
    direction: "up" | "down" | "left" | "right"
    offsetMetatiles: number
  }
  forwardPlacement: CatalogPlacement
  reversePlacement: CatalogPlacement
}

export type CatalogMissingReverseConnection = {
  code: "missing_reverse_connection"
  explanation: string
  connection: CatalogTopologyConnection
  expectedReverse: {
    direction: "up" | "down" | "left" | "right"
    offsetMetatiles: number
  }
}

export type CatalogCycleTopologyMismatch = {
  code: "cycle_closure_mismatch"
  explanation: string
  maps: Array<{
    map: string
    mapId: string
  }>
  connections: CatalogTopologyConnectionPair[]
  residualMetatiles: {
    x: number
    y: number
  }
  candidates: Array<{
    map: string
    mapId: string
    rank: number
    confidence: "none" | "low"
    independentConnectionCount: number
    remainingComponentSize: number
    residualResolved: boolean
    rationale: string
  }>
}

export type CatalogTopologyDiagnostic =
  | CatalogDirectTopologyMismatch
  | CatalogMissingReverseConnection
  | CatalogCycleTopologyMismatch

export type CatalogWarp = {
  warpId: string
  xMetatiles: number
  yMetatiles: number
  elevation: number
  destinationWarpId: string
  destinationMapId: string
  destinationMap: string | null
}

export type CatalogObjectSprite = {
  path: string
  sha256: string
  widthPixels: number
  heightPixels: number
  anchor: {
    xPixels: number
    yPixels: number
  }
  source: string
}

export type CatalogObject = {
  objectId: string
  kind: {
    id: string
    label: string
    evidence: "trainer-type" | "graphics" | "script" | "fallback"
    action: string | null
  }
  graphicsId: string
  xMetatiles: number
  yMetatiles: number
  elevation: number
  movementType: string
  movementRange: { x: number; y: number }
  trainerType: string
  trainerSightOrBerryTreeId: string
  script: string
  flag: string
  sprite: CatalogObjectSprite | null
  diagnostic: { code: string; message: string } | null
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
  objects: CatalogObject[]
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
  topology: {
    conflicts: CatalogTopologyDiagnostic[]
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

const hasNumber = (value: unknown): value is number => {
  return typeof value === "number" && Number.isFinite(value)
}

const hasCardinalDirection = (value: unknown): boolean => {
  return value === "up" || value === "down" || value === "left" || value === "right"
}

const hasTopologyHeader = (value: unknown): boolean => {
  const header = asRecord(value)
  return !!header && hasString(header.map) && hasString(header.path) && hasString(header.pointer)
}

const hasTopologyConnection = (value: unknown): boolean => {
  const connection = asRecord(value)
  const source = asRecord(connection?.source)
  const destination = asRecord(connection?.destination)
  return (
    !!connection &&
    !!source &&
    !!destination &&
    hasString(source.map) &&
    hasString(source.mapId) &&
    hasTopologyHeader(source.header) &&
    hasString(destination.map) &&
    hasString(destination.mapId) &&
    hasCardinalDirection(connection.direction) &&
    hasNumber(connection.offsetMetatiles)
  )
}

const hasPlacement = (value: unknown): boolean => {
  const placement = asRecord(value)
  return (
    !!placement &&
    hasNumber(placement.x) &&
    hasNumber(placement.y) &&
    hasNumber(placement.width) &&
    hasNumber(placement.height)
  )
}

const hasExpectedReverse = (value: unknown): boolean => {
  const expected = asRecord(value)
  return (
    !!expected && hasCardinalDirection(expected.direction) && hasNumber(expected.offsetMetatiles)
  )
}

const hasCycleCandidate = (value: unknown): boolean => {
  const candidate = asRecord(value)
  return (
    !!candidate &&
    hasString(candidate.map) &&
    hasString(candidate.mapId) &&
    hasNumber(candidate.rank) &&
    (candidate.confidence === "none" || candidate.confidence === "low") &&
    hasNumber(candidate.independentConnectionCount) &&
    hasNumber(candidate.remainingComponentSize) &&
    typeof candidate.residualResolved === "boolean" &&
    hasString(candidate.rationale)
  )
}

const topologyDiagnosticIssue = (value: unknown): string | null => {
  const diagnostic = asRecord(value)
  if (!diagnostic || !hasString(diagnostic.code) || !hasString(diagnostic.explanation)) {
    return "must include a supported code and explanation."
  }
  if (diagnostic.code === "direct_connection_mismatch") {
    return hasTopologyConnection(diagnostic.connection) &&
      hasTopologyConnection(diagnostic.reverseConnection) &&
      hasExpectedReverse(diagnostic.expectedReverse) &&
      hasPlacement(diagnostic.forwardPlacement) &&
      hasPlacement(diagnostic.reversePlacement)
      ? null
      : "has an invalid direct reciprocal mismatch payload."
  }
  if (diagnostic.code === "missing_reverse_connection") {
    return hasTopologyConnection(diagnostic.connection) &&
      hasExpectedReverse(diagnostic.expectedReverse)
      ? null
      : "has an invalid missing reverse connection payload."
  }
  if (diagnostic.code !== "cycle_closure_mismatch") {
    return `uses unsupported code ${JSON.stringify(diagnostic.code)}.`
  }
  const residual = asRecord(diagnostic.residualMetatiles)
  const maps = diagnostic.maps
  const connections = diagnostic.connections
  const candidates = diagnostic.candidates
  const mapsValid =
    Array.isArray(maps) &&
    maps.every((map) => {
      const entry = asRecord(map)
      return !!entry && hasString(entry.map) && hasString(entry.mapId)
    })
  const connectionsValid =
    Array.isArray(connections) &&
    connections.every((pair) => {
      const entry = asRecord(pair)
      return (
        !!entry &&
        hasTopologyConnection(entry.connection) &&
        hasTopologyConnection(entry.reverseConnection)
      )
    })
  return mapsValid &&
    connectionsValid &&
    Array.isArray(candidates) &&
    candidates.every(hasCycleCandidate) &&
    !!residual &&
    hasNumber(residual.x) &&
    hasNumber(residual.y)
    ? null
    : "has an invalid cycle closure payload."
}

/** Check the catalog fields the cartographer relies upon before rendering any map data. */
export const validateCatalog = (value: unknown): MapCatalog => {
  const root = asRecord(value)
  const details: string[] = []
  if (!root) {
    throw new CatalogValidationError(["catalog must be an object."], "The map catalog is invalid.")
  }
  if (root.schemaVersion !== 2) {
    details.push(
      "schemaVersion must be 2. Regenerate the catalog with pnpm run cartographer:catalog.",
    )
  }
  if (!Array.isArray(root.maps)) {
    details.push("maps must be an array.")
  }
  if (!Array.isArray(root.regions)) {
    details.push("regions must be an array.")
  }
  if (!asRecord(root.topology) || !Array.isArray(asRecord(root.topology)?.conflicts)) {
    details.push("topology.conflicts must be an array.")
  }
  if (typeof root.pixelsPerMetatile !== "number" || root.pixelsPerMetatile < 1) {
    details.push("pixelsPerMetatile must be a positive number.")
  }
  if (details.length > 0) {
    throw new CatalogValidationError(details, "The map catalog is invalid.")
  }

  const catalog = root as unknown as MapCatalog
  for (const [index, diagnostic] of catalog.topology.conflicts.entries()) {
    const issue = topologyDiagnosticIssue(diagnostic)
    if (issue) details.push(`topology.conflicts[${index}] ${issue}`)
  }
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
      `Could not load the map catalog (${response.status} ${response.statusText}). Run pnpm run cartographer:catalog first.`,
    )
  }
  return validateCatalog(await response.json())
}
