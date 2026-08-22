import type { CatalogMap, CatalogPlacement, TopologyConflict, TopologySourceHeader } from "./types"

type CardinalDirection = "up" | "down" | "left" | "right"

type Neighbor = {
  name: string
  direction: CardinalDirection
  offsetMetatiles: number
  forward: boolean
  sourceMap: string
  sourceConnectionIndex: number
}

type PendingConflict = {
  sourceMap: string
  destinationMap: string
  direction: CardinalDirection
  offsetMetatiles: number
  header: TopologySourceHeader
}

const cardinalDirections = new Set<CardinalDirection>(["up", "down", "left", "right"])
const componentGap = 8

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

const boundsFor = (
  names: readonly string[],
  placements: Record<string, CatalogPlacement>,
): CatalogPlacement => {
  const firstName = names[0]
  if (!firstName) throw new Error("a map component cannot be empty")
  const first = placements[firstName]!
  let left = first.x
  let top = first.y
  let right = first.x + first.width
  let bottom = first.y + first.height
  for (const name of names.slice(1)) {
    const placement = placements[name]!
    left = Math.min(left, placement.x)
    top = Math.min(top, placement.y)
    right = Math.max(right, placement.x + placement.width)
    bottom = Math.max(bottom, placement.y + placement.height)
  }
  return { x: left, y: top, width: right - left, height: bottom - top }
}

const headerFor = (map: string, connectionIndex: number): TopologySourceHeader => {
  return {
    map,
    path: `data/maps/${map}/map.json`,
    pointer: `/connections/${connectionIndex}`,
  }
}

/** Diagnose contradictory cardinal map connections while retaining their source records. */
export const topologyConflicts = (maps: readonly CatalogMap[]): TopologyConflict[] => {
  const ordered = [...maps].sort((left, right) => left.name.localeCompare(right.name, "en"))
  const byName = new Map(ordered.map((map) => [map.name, map]))
  const placements: Record<string, CatalogPlacement> = {}
  const placementPaths: Record<string, TopologySourceHeader[]> = {}
  const components: Array<{ id: string; maps: string[]; bounds: CatalogPlacement }> = []
  const pending: PendingConflict[] = []
  const connections = new Map<string, Neighbor[]>()

  for (const map of ordered) {
    for (const [connectionIndex, connection] of map.connections.entries()) {
      if (
        !connection.destinationMap ||
        !cardinalDirections.has(connection.direction as CardinalDirection)
      )
        continue
      const direction = connection.direction as CardinalDirection
      const forward = connections.get(map.name) ?? []
      forward.push({
        name: connection.destinationMap,
        direction,
        offsetMetatiles: connection.offsetMetatiles,
        forward: true,
        sourceMap: map.name,
        sourceConnectionIndex: connectionIndex,
      })
      connections.set(map.name, forward)
      const reverse = connections.get(connection.destinationMap) ?? []
      reverse.push({
        name: map.name,
        direction,
        offsetMetatiles: connection.offsetMetatiles,
        forward: false,
        sourceMap: map.name,
        sourceConnectionIndex: connectionIndex,
      })
      connections.set(connection.destinationMap, reverse)
    }
  }

  for (const root of ordered) {
    if (placements[root.name]) continue
    placements[root.name] = { x: 0, y: 0, ...dimensions(root) }
    placementPaths[root.name] = []
    const queue = [root.name]
    const names: string[] = []
    for (let index = 0; index < queue.length; index += 1) {
      const name = queue[index]!
      names.push(name)
      const current = placements[name]!
      for (const neighbor of connections.get(name) ?? []) {
        const neighborMap = byName.get(neighbor.name)
        if (!neighborMap) continue
        const expected = neighbor.forward
          ? placeConnection(
              current,
              dimensions(neighborMap),
              neighbor.direction,
              neighbor.offsetMetatiles,
            )
          : placeSourceFromDestination(
              current,
              dimensions(neighborMap),
              neighbor.direction,
              neighbor.offsetMetatiles,
            )
        const actual = placements[neighbor.name]
        const header = headerFor(neighbor.sourceMap, neighbor.sourceConnectionIndex)
        if (!actual) {
          placements[neighbor.name] = expected
          placementPaths[neighbor.name] = [...placementPaths[name]!, header]
          queue.push(neighbor.name)
        } else if (neighbor.forward && !placementEqual(actual, expected)) {
          pending.push({
            sourceMap: name,
            destinationMap: neighbor.name,
            direction: neighbor.direction,
            offsetMetatiles: neighbor.offsetMetatiles,
            header,
          })
        }
      }
    }
    names.sort((left, right) => left.localeCompare(right, "en"))
    components.push({ id: names[0]!, maps: names, bounds: boundsFor(names, placements) })
  }

  const packed = [...components].sort(
    (left, right) =>
      right.bounds.height - left.bounds.height ||
      right.bounds.width - left.bounds.width ||
      left.id.localeCompare(right.id, "en"),
  )
  const targetWidth = Math.max(
    1,
    Math.ceil(
      Math.sqrt(
        packed.reduce(
          (total, component) => total + component.bounds.width * component.bounds.height,
          0,
        ),
      ),
    ),
  )
  let x = 0
  let y = 0
  let shelfHeight = 0
  for (const component of packed) {
    if (x > 0 && x + component.bounds.width > targetWidth) {
      x = 0
      y += shelfHeight + componentGap
      shelfHeight = 0
    }
    const shiftX = x - component.bounds.x
    const shiftY = y - component.bounds.y
    for (const name of component.maps) {
      const placement = placements[name]!
      placements[name] = { ...placement, x: placement.x + shiftX, y: placement.y + shiftY }
    }
    component.bounds = boundsFor(component.maps, placements)
    x += component.bounds.width + componentGap
    shelfHeight = Math.max(shelfHeight, component.bounds.height)
  }

  return pending.map((conflict) => {
    const source = placements[conflict.sourceMap]!
    const destination = placements[conflict.destinationMap]!
    const expected = placeConnection(
      source,
      dimensions(byName.get(conflict.destinationMap)!),
      conflict.direction,
      conflict.offsetMetatiles,
    )
    return {
      code: "connection_placement_mismatch",
      explanation: `${conflict.sourceMap} declares ${conflict.destinationMap} ${conflict.direction} at offset ${conflict.offsetMetatiles}, but the earlier connection records place it at (${destination.x}, ${destination.y}) instead of (${expected.x}, ${expected.y}).`,
      source: {
        map: conflict.sourceMap,
        mapId: byName.get(conflict.sourceMap)!.id,
        header: conflict.header,
      },
      destination: {
        map: conflict.destinationMap,
        mapId: byName.get(conflict.destinationMap)!.id,
      },
      direction: conflict.direction,
      offsetMetatiles: conflict.offsetMetatiles,
      expected,
      actual: destination,
      establishedPlacement: {
        source: placementPaths[conflict.sourceMap]!,
        destination: placementPaths[conflict.destinationMap]!,
      },
    }
  })
}
