import { describe, expect, it } from "vitest"

import { topologyConflicts } from "./topology"
import type { CatalogMap } from "./types"

const map = (
  name: string,
  connections: Array<{ direction: "up" | "down" | "left" | "right"; destinationMap: string }>,
): CatalogMap => {
  return {
    name,
    id: `MAP_${name.toUpperCase()}`,
    layout: { widthMetatiles: 10, heightMetatiles: 10 },
    connections: connections.map((connection) => ({
      ...connection,
      offsetMetatiles: 0,
      destinationMapId: `MAP_${connection.destinationMap.toUpperCase()}`,
    })),
  } as CatalogMap
}

describe("topologyConflicts", () => {
  it("emits source records and the placement chain needed to investigate a conflict", () => {
    const conflicts = topologyConflicts([
      map("Alpha", [{ direction: "right", destinationMap: "Bravo" }]),
      map("Bravo", [{ direction: "down", destinationMap: "Charlie" }]),
      map("Charlie", [{ direction: "left", destinationMap: "Alpha" }]),
    ])

    expect(conflicts).toMatchObject([
      {
        code: "connection_placement_mismatch",
        source: {
          map: "Bravo",
          header: { path: "data/maps/Bravo/map.json", pointer: "/connections/0" },
        },
        destination: { map: "Charlie" },
        direction: "down",
        expected: { x: 10, y: 10 },
        actual: { x: 10, y: 0 },
        establishedPlacement: {
          source: [{ map: "Alpha", pointer: "/connections/0" }],
          destination: [{ map: "Charlie", pointer: "/connections/0" }],
        },
      },
    ])
    expect(conflicts[0]?.explanation).toContain("earlier connection records")
  })
})
