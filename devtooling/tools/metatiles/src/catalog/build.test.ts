import { describe, expect, it } from "vitest"

import { describeMetatileTiles } from "./build"

describe("metatile catalog decoding", () => {
  it("retains layer, palette, flips, and the primary-tile reference inside secondary data", () => {
    const metatiles = Buffer.alloc(16)
    metatiles.writeUInt16LE(0xa294, 0)
    metatiles.writeUInt16LE(0x0f21, 8)

    const tiles = describeMetatileTiles(metatiles, 0, 640)

    expect(tiles[0]).toMatchObject({
      layer: 0,
      quadrant: 0,
      tileId: 660,
      source: "secondary",
      sourceTileId: 20,
      paletteId: 10,
      horizontalFlip: false,
      verticalFlip: false,
    })
    expect(tiles[4]).toMatchObject({
      layer: 1,
      quadrant: 0,
      tileId: 801,
      source: "secondary",
      sourceTileId: 161,
      paletteId: 0,
      horizontalFlip: true,
      verticalFlip: true,
    })
  })
})
