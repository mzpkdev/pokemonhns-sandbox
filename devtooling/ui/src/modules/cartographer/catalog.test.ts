import { describe, expect, it } from "vitest"

import { CatalogValidationError, validateCatalog } from "./catalog.js"

const catalog = (overrides: Record<string, unknown> = {}): Record<string, unknown> => {
  return {
    schemaVersion: 3,
    pixelsPerMetatile: 16,
    regions: [],
    maps: [],
    topology: { conflicts: [] },
    ...overrides,
  }
}

describe("validateCatalog", () => {
  it("rejects stale catalog schemas before the viewport can interpret their topology", () => {
    expect(() => validateCatalog(catalog({ schemaVersion: 1 }))).toThrow(CatalogValidationError)
    expect(() => validateCatalog(catalog({ schemaVersion: 1 }))).toThrow("schemaVersion must be 3")
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
    expect(validateCatalog(catalog()).schemaVersion).toBe(3)
  })
})
