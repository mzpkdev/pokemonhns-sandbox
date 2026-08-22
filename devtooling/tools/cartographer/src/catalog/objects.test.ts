import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"

import { afterAll, describe, expect, it } from "vitest"

import { cropSpriteFrame } from "../renderer/png"
import { catalogObjects, objectSourceTables } from "./objects"
import type { ObjectEvent } from "./types"

const sourceRoot = path.resolve(import.meta.dirname, "../../../../..")
const outputRoot = fs.mkdtempSync(path.join(os.tmpdir(), "cartographer-objects-"))

const event = (graphicsId: string): ObjectEvent => ({
  graphics_id: graphicsId,
  x: 4,
  y: 9,
  elevation: 3,
  movement_type: "MOVEMENT_TYPE_NONE",
  movement_range_x: 0,
  movement_range_y: 0,
  trainer_type: "TRAINER_TYPE_NONE",
  trainer_sight_or_berry_tree_id: "0",
  script: "EventScript_None",
  flag: "FLAG_NONE",
})

const tables = objectSourceTables(sourceRoot)

afterAll(() => {
  fs.rmSync(outputRoot, { recursive: true, force: true })
})

describe("source-backed object graphics", () => {
  it("resolves NPCs, aliases, species expressions, static objects, and field effects", () => {
    const objects = catalogObjects(
      sourceRoot,
      outputRoot,
      [
        event("OBJ_EVENT_GFX_LITTLE_BOY"),
        event("OBJ_EVENT_GFX_ITEM_BALL"),
        event("OBJ_EVENT_GFX_MON_BASE + SPECIES_HOPPIP"),
        event("OBJ_EVENT_GFX_BREAKABLE_ROCK"),
        event("OBJ_EVENT_GFX_LIGHT_SPRITE"),
      ],
      tables,
    )

    expect(objects.map((object) => object.diagnostic)).toEqual([null, null, null, null, null])
    expect(objects.map((object) => object.sprite?.widthPixels)).toEqual([16, 16, 32, 16, 32])
    expect(objects.map((object) => object.sprite?.heightPixels)).toEqual([32, 32, 32, 16, 32])
    expect(objects[0]?.sprite?.source).toMatch(
      /graphics\/object_events\/pics\/people\/little_boy\.png$/,
    )
    expect(objects[1]?.sprite?.source).toMatch(
      /graphics\/object_events\/pics\/misc\/ball_poke\.png$/,
    )
    expect(objects[2]?.sprite?.source).toMatch(
      /graphics\/object_events\/pics\/pokemon\/hoppip\.png$/,
    )
    expect(objects[3]?.sprite?.source).toMatch(
      /graphics\/object_events\/pics\/misc\/breakable_rock\.png$/,
    )
    expect(objects[4]?.sprite?.source).toMatch(/graphics\/object_events\/pics\/misc\/light\.png$/)

    for (const object of objects) {
      expect(object.sprite).not.toBeNull()
      expect(fs.existsSync(path.join(outputRoot, object.sprite!.path))).toBe(true)
    }
  })

  it("crops indexed source PNGs to RGBA while retaining index-zero transparency", () => {
    const cropped = cropSpriteFrame(
      path.join(sourceRoot, "graphics/object_events/pics/people/little_boy.png"),
      { index: 1, width: 16, height: 32 },
    )

    expect(cropped).toMatchObject({ width: 16, height: 32 })
    const alpha = cropped.pixels.filter((_, index) => index % 4 === 3)
    expect(alpha).toContain(0)
    expect(alpha).toContain(255)
  })

  it("keeps unresolved graphics explicit instead of guessing a source asset", () => {
    const [object] = catalogObjects(
      sourceRoot,
      outputRoot,
      [event("OBJ_EVENT_GFX_NOT_A_REAL_GRAPHIC")],
      tables,
    )

    expect(object).toMatchObject({
      graphicsId: "OBJ_EVENT_GFX_NOT_A_REAL_GRAPHIC",
      sprite: null,
      diagnostic: {
        code: "unknown_graphics_id",
        message: expect.stringContaining("no graphics-info pointer"),
      },
    })
  })
})
