import { describe, expect, it } from "vitest"

import { CatalogValidationError, validateCatalog } from "./catalog.js"

const catalog = (overrides: Record<string, unknown> = {}): Record<string, unknown> => {
  return {
    schemaVersion: 4,
    pixelsPerMetatile: 16,
    regions: [],
    maps: [],
    topology: { conflicts: [] },
    ...overrides,
  }
}

const mapWithWildEncounters = (
  wildEncounters: Record<string, unknown>,
): Record<string, unknown> => {
  return {
    name: "Route101",
    id: "MAP_ROUTE101",
    region: "routes",
    image: { widthPixels: 16, heightPixels: 16 },
    layout: { widthMetatiles: 1, heightMetatiles: 1 },
    wildEncounters,
  }
}

const wildEncounters = (): Record<string, unknown> => {
  return {
    sets: [
      {
        mapId: "MAP_ROUTE101",
        mapName: "Route101",
        baseLabel: "gRoute101",
        header: { groupLabel: "gWildMonHeaders", groupIndex: 0, headerIndex: 0 },
        source: {
          path: "src/data/wild_encounters.json",
          pointer: "/wild_encounter_groups/0/encounters/0",
        },
        methods: [
          {
            type: "land_mons",
            encounterRate: 20,
            source: {
              path: "src/data/wild_encounters.json",
              pointer: "/wild_encounter_groups/0/encounters/0/land_mons",
            },
            slots: [
              {
                slotIndex: 0,
                slotRate: 20,
                slotRateSource: {
                  path: "src/data/wild_encounters.json",
                  pointer: "/wild_encounter_groups/0/fields/0/encounter_rates/0",
                },
                groups: [],
                minLevel: 2,
                maxLevel: 3,
                speciesId: "SPECIES_ESPEON",
                speciesLabel: "Espeon",
                sprite: null,
                source: {
                  path: "src/data/wild_encounters.json",
                  pointer: "/wild_encounter_groups/0/encounters/0/land_mons/mons/0",
                },
              },
            ],
          },
        ],
      },
    ],
    variants: [
      {
        id: "base",
        timeBasedEncounterValue: 0,
        offset: 0,
        headerIndex: 0,
        availability: "available",
        set: {
          baseLabel: "gRoute101",
          source: {
            path: "src/data/wild_encounters.json",
            pointer: "/wild_encounter_groups/0/encounters/0",
          },
        },
      },
      {
        id: "normal_night",
        timeBasedEncounterValue: 2,
        offset: 1,
        headerIndex: 1,
        availability: "missing_contiguous_header",
        set: null,
      },
    ],
    diagnostics: [
      {
        code: "unaddressable_source_slot",
        setBaseLabel: "gRoute101",
        methodType: "fishing_mons",
        slotIndex: 10,
        speciesId: "SPECIES_MAGIKARP",
        source: {
          path: "src/data/wild_encounters.json",
          pointer: "/wild_encounter_groups/0/encounters/0/fishing_mons/mons/10",
        },
      },
    ],
  }
}

describe("validateCatalog", () => {
  it("rejects stale catalog schemas before the viewport can interpret their topology", () => {
    expect(() => validateCatalog(catalog({ schemaVersion: 1 }))).toThrow(CatalogValidationError)
    expect(() => validateCatalog(catalog({ schemaVersion: 1 }))).toThrow("schemaVersion must be 4")
  })

  it("rejects unsupported topology diagnostic codes", () => {
    expect(() =>
      validateCatalog(
        catalog({
          topology: {
            conflicts: [{ code: "connection_placement_mismatch", explanation: "old contract" }],
          },
        }),
      ),
    ).toThrow("unsupported code")
  })

  it("accepts the current empty diagnostic contract", () => {
    expect(validateCatalog(catalog()).schemaVersion).toBe(4)
  })

  it("accepts source-backed wild encounter sets and explicit missing runtime variants", () => {
    const value = catalog({
      regions: [{ id: "routes", label: "Routes", mapCount: 1, maps: ["Route101"] }],
      maps: [mapWithWildEncounters(wildEncounters())],
    })

    expect(validateCatalog(value).maps[0]?.wildEncounters.variants[1]?.availability).toBe(
      "missing_contiguous_header",
    )
  })

  it("rejects incomplete source encounter data", () => {
    const encounters = wildEncounters()
    encounters.variants = [{ id: "base", availability: "available" }]
    const value = catalog({
      regions: [{ id: "routes", label: "Routes", mapCount: 1, maps: ["Route101"] }],
      maps: [mapWithWildEncounters(encounters)],
    })

    expect(() => validateCatalog(value)).toThrow(
      "wildEncounters must contain valid source encounter data",
    )
  })
})
