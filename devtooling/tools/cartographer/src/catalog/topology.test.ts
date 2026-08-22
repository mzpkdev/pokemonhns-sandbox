import { describe, expect, it } from "vitest"

import { topologyConflicts } from "./topology"
import type { CatalogMap } from "./types"

type TestConnection = {
  direction: "up" | "down" | "left" | "right"
  destinationMap: string
  offsetMetatiles: number
}

const map = (name: string, connections: TestConnection[]): CatalogMap => {
  return {
    name,
    id: `MAP_${name.toUpperCase()}`,
    layout: { widthMetatiles: 10, heightMetatiles: 10 },
    connections: connections.map((connection) => ({
      ...connection,
      destinationMapId: `MAP_${connection.destinationMap.toUpperCase()}`,
    })),
  } as CatalogMap
}

describe("topologyConflicts", () => {
  it("identifies the precise reciprocal records when a direct connection disagrees", () => {
    const diagnostics = topologyConflicts([
      map("Alpha", [{ direction: "right", destinationMap: "Bravo", offsetMetatiles: 0 }]),
      map("Bravo", [{ direction: "left", destinationMap: "Alpha", offsetMetatiles: 1 }]),
    ])

    expect(diagnostics).toMatchObject([
      {
        code: "direct_connection_mismatch",
        connection: {
          source: {
            map: "Alpha",
            header: { path: "data/maps/Alpha/map.json", pointer: "/connections/0" },
          },
          destination: { map: "Bravo" },
          direction: "right",
          offsetMetatiles: 0,
        },
        reverseConnection: {
          source: {
            map: "Bravo",
            header: { path: "data/maps/Bravo/map.json", pointer: "/connections/0" },
          },
          direction: "left",
          offsetMetatiles: 1,
        },
        expectedReverse: { direction: "left", offsetMetatiles: 0 },
        forwardPlacement: { x: 10, y: 0 },
        reversePlacement: { x: 10, y: -1 },
      },
    ])
    expect(diagnostics[0]?.explanation).toContain("reverse record")
  })

  it("reports a missing reciprocal record as a direct diagnostic", () => {
    const diagnostics = topologyConflicts([
      map("Alpha", [{ direction: "right", destinationMap: "Bravo", offsetMetatiles: 3 }]),
      map("Bravo", []),
    ])

    expect(diagnostics).toMatchObject([
      {
        code: "missing_reverse_connection",
        connection: {
          source: { map: "Alpha", header: { pointer: "/connections/0" } },
          destination: { map: "Bravo" },
        },
        expectedReverse: { direction: "left", offsetMetatiles: -3 },
      },
    ])
  })

  it("does not reuse a reverse record when duplicate connections need separate evidence", () => {
    const diagnostics = topologyConflicts([
      map("Alpha", [
        { direction: "right", destinationMap: "Bravo", offsetMetatiles: 0 },
        { direction: "right", destinationMap: "Bravo", offsetMetatiles: 0 },
      ]),
      map("Bravo", [{ direction: "left", destinationMap: "Alpha", offsetMetatiles: 0 }]),
    ])

    expect(diagnostics).toMatchObject([
      {
        code: "missing_reverse_connection",
        connection: { source: { map: "Alpha", header: { pointer: "/connections/1" } } },
      },
    ])
  })

  it("groups a reciprocal Route32, Ruins, Violet, and Route36 loop as one unresolved cycle", () => {
    const diagnostics = topologyConflicts([
      map("Route32", [
        { direction: "up", destinationMap: "VioletCity", offsetMetatiles: 4 },
        { direction: "left", destinationMap: "RuinsOfAlph_Outside", offsetMetatiles: -24 },
      ]),
      map("RuinsOfAlph_Outside", [
        { direction: "up", destinationMap: "Route36", offsetMetatiles: -36 },
        { direction: "right", destinationMap: "Route32", offsetMetatiles: 24 },
      ]),
      map("VioletCity", [
        { direction: "down", destinationMap: "Route32", offsetMetatiles: -4 },
        { direction: "left", destinationMap: "Route36", offsetMetatiles: -2 },
      ]),
      map("Route36", [
        { direction: "right", destinationMap: "VioletCity", offsetMetatiles: 2 },
        { direction: "down", destinationMap: "RuinsOfAlph_Outside", offsetMetatiles: 36 },
      ]),
    ])

    expect(diagnostics).toHaveLength(1)
    const cycle = diagnostics[0]
    if (cycle?.code !== "cycle_closure_mismatch") throw new Error("expected cycle diagnostic")
    expect(cycle.maps).toEqual([
      { map: "Route32", mapId: "MAP_ROUTE32" },
      { map: "Route36", mapId: "MAP_ROUTE36" },
      { map: "RuinsOfAlph_Outside", mapId: "MAP_RUINSOFALPH_OUTSIDE" },
      { map: "VioletCity", mapId: "MAP_VIOLETCITY" },
    ])
    expect(cycle.connections).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          connection: expect.objectContaining({
            source: expect.objectContaining({
              header: {
                path: "data/maps/Route32/map.json",
                pointer: "/connections/0",
                map: "Route32",
              },
            }),
          }),
          reverseConnection: expect.objectContaining({
            source: expect.objectContaining({
              header: {
                path: "data/maps/VioletCity/map.json",
                pointer: "/connections/0",
                map: "VioletCity",
              },
            }),
          }),
        }),
      ]),
    )
    expect(cycle.candidates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          map: "RuinsOfAlph_Outside",
          confidence: "none",
          residualResolved: true,
        }),
      ]),
    )
    expect(cycle.candidates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ map: "RuinsOfAlph_Outside", remainingComponentSize: 3 }),
      ]),
    )
    expect(cycle.residualMetatiles).not.toEqual({ x: 0, y: 0 })
    expect(cycle.connections).toHaveLength(4)
    expect(cycle.explanation).toContain("do not identify")
  })

  it("keeps the path that produces a closure residual when a shorter chord is consistent", () => {
    const diagnostics = topologyConflicts([
      map("Alpha", [
        { direction: "right", destinationMap: "Charlie", offsetMetatiles: 0 },
        { direction: "down", destinationMap: "Bravo", offsetMetatiles: 0 },
      ]),
      map("Bravo", [
        { direction: "up", destinationMap: "Alpha", offsetMetatiles: 0 },
        { direction: "right", destinationMap: "Delta", offsetMetatiles: 0 },
        { direction: "up", destinationMap: "Echo", offsetMetatiles: 0 },
      ]),
      map("Charlie", [
        { direction: "left", destinationMap: "Alpha", offsetMetatiles: 0 },
        { direction: "right", destinationMap: "Delta", offsetMetatiles: 0 },
      ]),
      map("Delta", [
        { direction: "left", destinationMap: "Charlie", offsetMetatiles: 0 },
        { direction: "left", destinationMap: "Bravo", offsetMetatiles: 0 },
        { direction: "up", destinationMap: "Echo", offsetMetatiles: -10 },
      ]),
      map("Echo", [
        { direction: "down", destinationMap: "Bravo", offsetMetatiles: 0 },
        { direction: "down", destinationMap: "Delta", offsetMetatiles: 10 },
      ]),
    ])

    const cycle = diagnostics.find(
      (diagnostic) =>
        diagnostic.code === "cycle_closure_mismatch" &&
        diagnostic.maps.some((map) => map.map === "Bravo") &&
        diagnostic.maps.some((map) => map.map === "Charlie"),
    )
    if (cycle?.code !== "cycle_closure_mismatch") throw new Error("expected chorded cycle")
    expect(cycle.maps.map((map) => map.map)).toEqual(["Alpha", "Bravo", "Charlie", "Delta"])
    expect(cycle.residualMetatiles).toEqual({ x: -10, y: 10 })
    expect(cycle.maps.map((map) => map.map)).not.toContain("Echo")
  })
})
