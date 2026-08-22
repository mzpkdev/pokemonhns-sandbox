import type {
  CatalogMap,
  CatalogPlacement,
  TopologyConnectionPair,
  TopologyConnectionRecord,
  TopologyCycleCandidate,
  TopologyDiagnostic,
  TopologySourceHeader,
} from "./types"

type CardinalDirection = "up" | "down" | "left" | "right"

type ConnectionRecord = TopologyConnectionRecord & {
  connectionIndex: number
}

type ConnectionPair = {
  id: string
  connection: ConnectionRecord
  reverseConnection: ConnectionRecord
}

type Parent = {
  map: string
  pair: ConnectionPair
}

type PendingCycle = {
  pair: ConnectionPair
  sourceMap: string
  destinationMap: string
  sourcePlacement: CatalogPlacement
  expected: CatalogPlacement
  actual: CatalogPlacement
  componentRoot: string
  parents: Record<string, Parent | undefined>
}

const cardinalDirections = new Set<CardinalDirection>(["up", "down", "left", "right"])

const dimensions = (map: CatalogMap): Pick<CatalogPlacement, "width" | "height"> => {
  return { width: map.layout.widthMetatiles, height: map.layout.heightMetatiles }
}

const placementEqual = (left: CatalogPlacement, right: CatalogPlacement): boolean => {
  return (
    left.x === right.x &&
    left.y === right.y &&
    left.width === right.width &&
    left.height === right.height
  )
}

const placeConnection = (
  source: CatalogPlacement,
  destination: Pick<CatalogPlacement, "width" | "height">,
  direction: CardinalDirection,
  offset: number,
): CatalogPlacement => {
  if (direction === "right")
    return { x: source.x + source.width, y: source.y + offset, ...destination }
  if (direction === "left")
    return { x: source.x - destination.width, y: source.y + offset, ...destination }
  if (direction === "down")
    return { x: source.x + offset, y: source.y + source.height, ...destination }
  return { x: source.x + offset, y: source.y - destination.height, ...destination }
}

const placeSourceFromDestination = (
  destination: CatalogPlacement,
  source: Pick<CatalogPlacement, "width" | "height">,
  direction: CardinalDirection,
  offset: number,
): CatalogPlacement => {
  if (direction === "right")
    return { x: destination.x - source.width, y: destination.y - offset, ...source }
  if (direction === "left")
    return { x: destination.x + destination.width, y: destination.y - offset, ...source }
  if (direction === "down")
    return { x: destination.x - offset, y: destination.y - source.height, ...source }
  return { x: destination.x - offset, y: destination.y + destination.height, ...source }
}

const headerFor = (map: string, connectionIndex: number): TopologySourceHeader => {
  return {
    map,
    path: `data/maps/${map}/map.json`,
    pointer: `/connections/${connectionIndex}`,
  }
}

const oppositeDirection = (direction: CardinalDirection): CardinalDirection => {
  if (direction === "up") return "down"
  if (direction === "down") return "up"
  if (direction === "left") return "right"
  return "left"
}

const inverseOffset = (offset: number): number => {
  return offset === 0 ? 0 : -offset
}

const recordKey = (record: ConnectionRecord): string => {
  return `${record.source.map}:${record.connectionIndex}`
}

const pairKey = (left: ConnectionRecord, right: ConnectionRecord): string => {
  return [recordKey(left), recordKey(right)]
    .sort((first, second) => first.localeCompare(second, "en"))
    .join("|")
}

const asConnection = ({
  connectionIndex: _connectionIndex,
  ...connection
}: ConnectionRecord): TopologyConnectionRecord => {
  return connection
}

const asPair = (pair: ConnectionPair): TopologyConnectionPair => {
  return {
    connection: asConnection(pair.connection),
    reverseConnection: asConnection(pair.reverseConnection),
  }
}

const connectionFrom = (pair: ConnectionPair, map: string): ConnectionRecord | null => {
  if (pair.connection.source.map === map) return pair.connection
  if (pair.reverseConnection.source.map === map) return pair.reverseConnection
  return null
}

const treePathPairs = (
  sourceMap: string,
  destinationMap: string,
  parents: Record<string, Parent | undefined>,
): ConnectionPair[] => {
  const sourceParents = new Map<string, ConnectionPair[]>()
  let source = sourceMap
  let sourcePairs: ConnectionPair[] = []
  sourceParents.set(source, sourcePairs)
  for (let parent = parents[source]; parent; parent = parents[source]) {
    sourcePairs = [...sourcePairs, parent.pair]
    source = parent.map
    sourceParents.set(source, sourcePairs)
  }
  let destination = destinationMap
  const destinationPairs: ConnectionPair[] = []
  while (!sourceParents.has(destination)) {
    const parent = parents[destination]
    if (!parent) return []
    destinationPairs.push(parent.pair)
    destination = parent.map
  }
  return [...sourceParents.get(destination)!, ...destinationPairs]
}

type PathState = {
  map: string
  placement: CatalogPlacement
  pairs: ConnectionPair[]
  visited: ReadonlySet<string>
}

const shortestCyclePairsForResidual = (
  sourceMap: string,
  destinationMap: string,
  finalPair: ConnectionPair,
  sourcePlacement: CatalogPlacement,
  actual: CatalogPlacement,
  treePairs: readonly ConnectionPair[],
  adjacency: ReadonlyMap<string, readonly ConnectionPair[]>,
  mapsByName: ReadonlyMap<string, CatalogMap>,
): ConnectionPair[] => {
  const source = { x: 0, y: 0, width: sourcePlacement.width, height: sourcePlacement.height }
  const target = {
    ...actual,
    x: actual.x - sourcePlacement.x,
    y: actual.y - sourcePlacement.y,
  }
  const queue: PathState[] = [
    { map: sourceMap, placement: source, pairs: [], visited: new Set([sourceMap]) },
  ]
  const explored = new Map<string, number>()
  for (let index = 0; index < queue.length; index += 1) {
    const state = queue[index]!
    if (state.pairs.length >= treePairs.length) continue
    for (const pair of adjacency.get(state.map) ?? []) {
      if (pair.id === finalPair.id) continue
      const connection = connectionFrom(pair, state.map)
      const nextMap = connection?.destination.map
      if (!connection || !nextMap || state.visited.has(nextMap)) continue
      const placement = placeConnection(
        state.placement,
        dimensions(mapsByName.get(nextMap)!),
        connection.direction,
        connection.offsetMetatiles,
      )
      const pairs = [...state.pairs, pair]
      if (nextMap === destinationMap && placementEqual(placement, target)) {
        return [...pairs, finalPair].sort((left, right) => left.id.localeCompare(right.id, "en"))
      }
      const key = `${nextMap}:${placement.x}:${placement.y}`
      if (pairs.length >= treePairs.length || (explored.get(key) ?? Infinity) <= pairs.length)
        continue
      explored.set(key, pairs.length)
      queue.push({
        map: nextMap,
        placement,
        pairs,
        visited: new Set([...state.visited, nextMap]),
      })
    }
  }
  return [...treePairs, finalPair].sort((left, right) => left.id.localeCompare(right.id, "en"))
}

const largestComponentWithout = (
  maps: readonly string[],
  adjacency: ReadonlyMap<string, readonly ConnectionPair[]>,
  excludedMap: string,
): number => {
  const available = new Set(maps.filter((map) => map !== excludedMap))
  let largest = 0
  while (available.size > 0) {
    const root = [...available].sort((left, right) => left.localeCompare(right, "en"))[0]
    if (!root) break
    available.delete(root)
    const queue = [root]
    let size = 0
    for (let index = 0; index < queue.length; index += 1) {
      const map = queue[index]!
      size += 1
      for (const pair of adjacency.get(map) ?? []) {
        const destination = connectionFrom(pair, map)?.destination.map
        if (!destination || !available.has(destination)) continue
        available.delete(destination)
        queue.push(destination)
      }
    }
    largest = Math.max(largest, size)
  }
  return largest
}

const candidatesFor = (
  cyclePairs: readonly ConnectionPair[],
  componentMaps: readonly string[],
  adjacency: ReadonlyMap<string, readonly ConnectionPair[]>,
  mapsByName: ReadonlyMap<string, CatalogMap>,
): TopologyCycleCandidate[] => {
  const cyclePairIds = new Set(cyclePairs.map((pair) => pair.id))
  const candidates = new Set(
    cyclePairs.flatMap((pair) => [pair.connection.source.map, pair.connection.destination.map]),
  )
  const ranked = [...candidates]
    .map((map) => {
      const independentConnectionCount = (adjacency.get(map) ?? []).filter(
        (pair) => !cyclePairIds.has(pair.id),
      ).length
      return {
        map,
        mapId: mapsByName.get(map)!.id,
        confidence: "none" as const,
        independentConnectionCount,
        remainingComponentSize: largestComponentWithout(componentMaps, adjacency, map),
        residualResolved: true,
      }
    })
    .sort(
      (left, right) =>
        right.remainingComponentSize - left.remainingComponentSize ||
        left.independentConnectionCount - right.independentConnectionCount ||
        left.map.localeCompare(right.map, "en"),
    )
  return ranked.map((candidate, index) => ({
    ...candidate,
    rank: index + 1,
    rationale: `Removing ${candidate.map} breaks this cycle, as removing every other map in the cycle would. It has ${candidate.independentConnectionCount} valid connection${candidate.independentConnectionCount === 1 ? "" : "s"} outside this cycle, and the remaining largest component contains ${candidate.remainingComponentSize} map${candidate.remainingComponentSize === 1 ? "" : "s"}.`,
  }))
}

const directMismatch = (
  connection: ConnectionRecord,
  reverseConnection: ConnectionRecord,
  mapsByName: ReadonlyMap<string, CatalogMap>,
): TopologyDiagnostic => {
  const source = { x: 0, y: 0, ...dimensions(mapsByName.get(connection.source.map)!) }
  const destination = dimensions(mapsByName.get(connection.destination.map)!)
  const forwardPlacement = placeConnection(
    source,
    destination,
    connection.direction,
    connection.offsetMetatiles,
  )
  const reversePlacement = placeSourceFromDestination(
    source,
    destination,
    reverseConnection.direction,
    reverseConnection.offsetMetatiles,
  )
  return {
    code: "direct_connection_mismatch",
    explanation: `${connection.source.map} declares ${connection.destination.map} ${connection.direction} at offset ${connection.offsetMetatiles}, but ${reverseConnection.source.map}'s reverse record declares ${reverseConnection.direction} at offset ${reverseConnection.offsetMetatiles}.`,
    connection: asConnection(connection),
    reverseConnection: asConnection(reverseConnection),
    expectedReverse: {
      direction: oppositeDirection(connection.direction),
      offsetMetatiles: inverseOffset(connection.offsetMetatiles),
    },
    forwardPlacement,
    reversePlacement,
  }
}

const missingReverseConnection = (connection: ConnectionRecord): TopologyDiagnostic => {
  return {
    code: "missing_reverse_connection",
    explanation: `${connection.source.map} declares ${connection.destination.map} ${connection.direction} at offset ${connection.offsetMetatiles}, but ${connection.destination.map} has no distinct reverse connection record back to ${connection.source.map}.`,
    connection: asConnection(connection),
    expectedReverse: {
      direction: oppositeDirection(connection.direction),
      offsetMetatiles: inverseOffset(connection.offsetMetatiles),
    },
  }
}

const cycleMismatch = (
  pending: PendingCycle,
  componentMaps: readonly string[],
  adjacency: ReadonlyMap<string, readonly ConnectionPair[]>,
  mapsByName: ReadonlyMap<string, CatalogMap>,
): TopologyDiagnostic => {
  const treePairs = treePathPairs(pending.sourceMap, pending.destinationMap, pending.parents)
  const cyclePairs = shortestCyclePairsForResidual(
    pending.sourceMap,
    pending.destinationMap,
    pending.pair,
    pending.sourcePlacement,
    pending.actual,
    treePairs,
    adjacency,
    mapsByName,
  )
  const residualMetatiles = {
    x: pending.expected.x - pending.actual.x,
    y: pending.expected.y - pending.actual.y,
  }
  const maps = [
    ...new Set(
      cyclePairs.flatMap((pair) => [pair.connection.source.map, pair.connection.destination.map]),
    ),
  ]
    .sort((left, right) => left.localeCompare(right, "en"))
    .map((map) => ({ map, mapId: mapsByName.get(map)!.id }))
  return {
    code: "cycle_closure_mismatch",
    explanation: `All ${cyclePairs.length} reciprocal connection pairs agree in isolation, but the cycle closes with a displacement of (${residualMetatiles.x}, ${residualMetatiles.y}) metatiles. The source records do not identify which map or connection is wrong.`,
    maps,
    connections: cyclePairs.map(asPair),
    residualMetatiles,
    candidates: candidatesFor(cyclePairs, componentMaps, adjacency, mapsByName),
  }
}

/**
 * Classify direct reciprocal disagreements separately from globally inconsistent cycles.
 * A cycle diagnostic keeps the source evidence and an advisory ranking, never an assertion
 * that a particular map is at fault.
 */
export const topologyConflicts = (maps: readonly CatalogMap[]): TopologyDiagnostic[] => {
  const ordered = [...maps].sort((left, right) => left.name.localeCompare(right.name, "en"))
  const mapsByName = new Map(ordered.map((map) => [map.name, map]))
  const records = ordered.flatMap((map) =>
    map.connections.flatMap((connection, connectionIndex) => {
      if (
        !connection.destinationMap ||
        !mapsByName.has(connection.destinationMap) ||
        !cardinalDirections.has(connection.direction as CardinalDirection)
      )
        return []
      return [
        {
          source: {
            map: map.name,
            mapId: map.id,
            header: headerFor(map.name, connectionIndex),
          },
          destination: {
            map: connection.destinationMap,
            mapId: mapsByName.get(connection.destinationMap)!.id,
          },
          direction: connection.direction as CardinalDirection,
          offsetMetatiles: connection.offsetMetatiles,
          connectionIndex,
        },
      ]
    }),
  )
  const recordsBySource = new Map<string, ConnectionRecord[]>()
  for (const record of records) {
    const sourceRecords = recordsBySource.get(record.source.map) ?? []
    sourceRecords.push(record)
    recordsBySource.set(record.source.map, sourceRecords)
  }

  const directDiagnostics: TopologyDiagnostic[] = []
  const pairs: ConnectionPair[] = []
  const pairedRecords = new Set<string>()
  for (const record of records) {
    if (pairedRecords.has(recordKey(record))) continue
    const reverseCandidates = (recordsBySource.get(record.destination.map) ?? [])
      .filter((candidate) => candidate.destination.map === record.source.map)
      .sort((left, right) => recordKey(left).localeCompare(recordKey(right), "en"))
    const availableReverseCandidates = reverseCandidates.filter(
      (candidate) => !pairedRecords.has(recordKey(candidate)),
    )
    if (availableReverseCandidates.length === 0) {
      directDiagnostics.push(missingReverseConnection(record))
      pairedRecords.add(recordKey(record))
      continue
    }
    const matchingReverse = availableReverseCandidates.find(
      (candidate) =>
        candidate.direction === oppositeDirection(record.direction) &&
        candidate.offsetMetatiles === inverseOffset(record.offsetMetatiles),
    )
    const reverse = matchingReverse ?? availableReverseCandidates[0]!
    const id = pairKey(record, reverse)
    pairedRecords.add(recordKey(record))
    pairedRecords.add(recordKey(reverse))
    if (!matchingReverse) {
      directDiagnostics.push(directMismatch(record, reverse, mapsByName))
      continue
    }
    const connection =
      recordKey(record).localeCompare(recordKey(reverse), "en") <= 0 ? record : reverse
    const reverseConnection = connection === record ? reverse : record
    pairs.push({ id, connection, reverseConnection })
  }

  const adjacency = new Map<string, ConnectionPair[]>()
  for (const pair of pairs) {
    for (const map of [pair.connection.source.map, pair.connection.destination.map]) {
      const mapPairs = adjacency.get(map) ?? []
      mapPairs.push(pair)
      adjacency.set(map, mapPairs)
    }
  }
  for (const mapPairs of adjacency.values()) {
    mapPairs.sort((left, right) => left.id.localeCompare(right.id, "en"))
  }

  const placements: Record<string, CatalogPlacement> = {}
  const parents: Record<string, Parent | undefined> = {}
  const pendingCycles: PendingCycle[] = []
  const components = new Map<string, string[]>()
  const examinedPairs = new Set<string>()
  for (const root of ordered) {
    if (placements[root.name]) continue
    placements[root.name] = { x: 0, y: 0, ...dimensions(root) }
    const queue = [root.name]
    const componentMaps: string[] = []
    for (let index = 0; index < queue.length; index += 1) {
      const sourceMap = queue[index]!
      componentMaps.push(sourceMap)
      const sourcePlacement = placements[sourceMap]!
      for (const pair of adjacency.get(sourceMap) ?? []) {
        const connection = connectionFrom(pair, sourceMap)
        if (!connection) continue
        const destinationMap = connection.destination.map
        const expected = placeConnection(
          sourcePlacement,
          dimensions(mapsByName.get(destinationMap)!),
          connection.direction,
          connection.offsetMetatiles,
        )
        const actual = placements[destinationMap]
        if (!actual) {
          placements[destinationMap] = expected
          parents[destinationMap] = { map: sourceMap, pair }
          queue.push(destinationMap)
          continue
        }
        if (parents[sourceMap]?.pair.id === pair.id || parents[destinationMap]?.pair.id === pair.id)
          continue
        if (examinedPairs.has(pair.id)) continue
        examinedPairs.add(pair.id)
        if (!placementEqual(actual, expected)) {
          pendingCycles.push({
            pair,
            sourceMap,
            destinationMap,
            sourcePlacement,
            expected,
            actual,
            componentRoot: root.name,
            parents: { ...parents },
          })
        }
      }
    }
    components.set(root.name, componentMaps)
  }

  const cycleDiagnostics = pendingCycles.map((pending) =>
    cycleMismatch(pending, components.get(pending.componentRoot) ?? [], adjacency, mapsByName),
  )
  return [...directDiagnostics, ...cycleDiagnostics]
}
