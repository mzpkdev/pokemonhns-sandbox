import { describe, expect, it } from "vitest"

import type { CatalogMap } from "./catalog.js"
import { solveGeography } from "./geography.js"

const map = (
  name: string,
  connections: Array<{ direction: "up" | "down" | "left" | "right"; destinationMap: string }>,
): CatalogMap => {
  return {
    name,
    layout: { widthMetatiles: 10, heightMetatiles: 10 },
    connections: connections.map((connection) => ({
      ...connection,
      offsetMetatiles: 0,
      destinationMapId: connection.destinationMap,
    })),
  } as CatalogMap
}

describe("solveGeography", () => {
  it("keeps conflicting connection evidence after packing map components", () => {
    const geography = solveGeography([
      map("Alpha", [{ direction: "right", destinationMap: "Bravo" }]),
      map("Bravo", [{ direction: "down", destinationMap: "Charlie" }]),
      map("Charlie", [{ direction: "left", destinationMap: "Alpha" }]),
    ])

    expect(geography.residualCount).toBe(1)
    expect(geography.conflicts).toMatchObject([
      {
        sourceMap: "Bravo",
        destinationMap: "Charlie",
        direction: "down",
        expected: { x: 10, y: 10 },
        actual: { x: 10, y: 0 },
      },
    ])
  })
})
