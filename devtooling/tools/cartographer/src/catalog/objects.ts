import * as crypto from "node:crypto"
import * as fs from "node:fs"
import * as path from "node:path"

import { cropSpriteFrame, writeRgbaPng } from "../renderer/png"
import { posixRelative, sha256 } from "./source"
import type { ObjectEvent } from "./types"

type SourceFrame = {
  graphicsId: string
  source: string
  widthPixels: number
  heightPixels: number
  frameIndex: number
}

export type ObjectDiagnostic = {
  code: string
  message: string
}

export type CatalogObject = {
  objectId: string
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
  sprite: {
    path: string
    sha256: string
    widthPixels: number
    heightPixels: number
    anchor: { xPixels: number; yPixels: number }
    source: string
  } | null
  diagnostic: ObjectDiagnostic | null
}

export type ObjectSourceTables = {
  graphicsInfoById: Map<string, string>
  frameByGraphicsInfo: Map<string, SourceFrame>
  frameBySpecies: Map<string, SourceFrame>
}

const sourceFile = (root: string, relative: string): string => {
  return path.join(root, "src/data/object_events", relative)
}

const readSource = (root: string, relative: string): string => {
  return fs
    .readFileSync(sourceFile(root, relative), "utf8")
    .replaceAll(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, "")
}

const readRootSource = (root: string, relative: string): string => {
  return fs
    .readFileSync(path.join(root, relative), "utf8")
    .replaceAll(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, "")
}

const picTables = (root: string): Map<string, SourceFrame> => {
  const result = new Map<string, SourceFrame>()
  const text = [
    readSource(root, "object_event_pic_tables.h"),
    readRootSource(root, "src/data/field_effects/field_effect_objects.h"),
  ].join("\n")
  const tablePattern =
    /(?:static\s+)?const struct SpriteFrameImage\s+(\w+)\[\]\s*=\s*\{([\s\S]*?)\};/g
  for (const match of text.matchAll(tablePattern)) {
    const [, tableName, body] = match
    const frame = body?.match(
      /overworld_frame\((g(?:ObjectEvent|FieldEffectObject)Pic_\w+),\s*(\d+),\s*(\d+),\s*(\d+)\)|obj_frame_tiles\((g(?:ObjectEvent|FieldEffectObject)Pic_\w+)\)/,
    )
    if (!tableName || !frame) {
      continue
    }
    const [, overworldPicture, widthTiles, heightTiles, frameIndex, staticPicture] = frame
    const picture = overworldPicture ?? staticPicture
    if (!picture) {
      continue
    }
    result.set(tableName, {
      graphicsId: picture,
      source: "",
      widthPixels: Number(widthTiles ?? 0) * 8,
      heightPixels: Number(heightTiles ?? 0) * 8,
      frameIndex: Number(frameIndex ?? 0),
    })
  }
  return result
}

const pictureSources = (root: string): Map<string, string> => {
  const result = new Map<string, string>()
  const text = readSource(root, "object_event_graphics.h")
  const sourcePattern =
    /const u32\s+(g(?:ObjectEvent|FieldEffectObject)Pic_\w+)\[\]\s*=\s*INCBIN(?:_\w+)?\("([^"]+)"\)/g
  for (const match of text.matchAll(sourcePattern)) {
    const [, picture, asset] = match
    if (picture && asset) {
      result.set(picture, path.join(root, asset.replace(/\.4bpp(?:\.lz)?$/, ".png")))
    }
  }
  return result
}

export const objectSourceTables = (root: string): ObjectSourceTables => {
  const tables = picTables(root)
  const sources = pictureSources(root)
  const resolveFrame = (
    tableName: string,
    graphicsId: string,
    dimensions?: { widthPixels: number; heightPixels: number },
  ): SourceFrame | undefined => {
    const frame = tables.get(tableName)
    if (!frame) {
      return undefined
    }
    const source = sources.get(frame.graphicsId)
    if (!source) {
      return undefined
    }
    return {
      ...frame,
      graphicsId,
      source,
      widthPixels: frame.widthPixels || dimensions?.widthPixels || 0,
      heightPixels: frame.heightPixels || dimensions?.heightPixels || 0,
    }
  }
  const dimensionsFor = (
    body: string,
  ): { widthPixels: number; heightPixels: number } | undefined => {
    const dimensions = body.match(/^(?:[^,]*,){4}\s*(\d+),\s*(\d+)/)
    if (!dimensions?.[1] || !dimensions[2]) {
      return undefined
    }
    return { widthPixels: Number(dimensions[1]), heightPixels: Number(dimensions[2]) }
  }

  const graphicsInfoById = new Map<string, string>()
  const pointers = readSource(root, "object_event_graphics_info_pointers.h")
  for (const match of pointers.matchAll(
    /\[\s*(OBJ_EVENT_GFX_\w+)\s*\]\s*=\s*&?(gObjectEventGraphicsInfo_\w+)/g,
  )) {
    const [, graphicsId, info] = match
    if (graphicsId && info) {
      graphicsInfoById.set(graphicsId, info)
    }
  }

  const aliases = new Map<string, string>()
  const constants = readRootSource(root, "include/constants/event_objects.h")
  for (const match of constants.matchAll(
    /^#define\s+(OBJ_EVENT_GFX_\w+)\s+(OBJ_EVENT_GFX_\w+)\s*$/gm,
  )) {
    const [, alias, target] = match
    if (alias && target) {
      aliases.set(alias, target)
    }
  }
  const canonicalGraphicsId = (graphicsId: string): string => {
    const visited = new Set<string>()
    let current = graphicsId
    while (aliases.has(current) && !visited.has(current)) {
      visited.add(current)
      current = aliases.get(current)!
    }
    return current
  }
  for (const [graphicsId, graphicsInfo] of graphicsInfoById) {
    const canonical = canonicalGraphicsId(graphicsId)
    if (!graphicsInfoById.has(canonical)) {
      graphicsInfoById.set(canonical, graphicsInfo)
    }
  }

  const frameByGraphicsInfo = new Map<string, SourceFrame>()
  const info = readSource(root, "object_event_graphics_info.h")
  for (const match of info.matchAll(
    /const struct ObjectEventGraphicsInfo\s+(gObjectEventGraphicsInfo_\w+)\s*=\s*\{([^}]*)\};/g,
  )) {
    const [, graphicsInfo, body] = match
    const tableName = body?.match(/\b(?:sPicTable_|gFieldEffectObjectPicTable_)\w+\b/)?.[0]
    if (graphicsInfo && tableName) {
      const frame = resolveFrame(tableName, graphicsInfo, dimensionsFor(body ?? ""))
      if (frame) {
        frameByGraphicsInfo.set(graphicsInfo, frame)
      }
    }
  }

  const frameBySpecies = new Map<string, SourceFrame>()
  const followers = readSource(root, "object_event_graphics_info_followers.h")
  for (const match of followers.matchAll(/\[\s*(SPECIES_\w+)\s*\]\s*=\s*\{([^}]*)\}/g)) {
    const [, species, body] = match
    const tableName = body?.match(/\b(sPicTable_\w+)\b/)?.[1]
    if (species && tableName) {
      const frame = resolveFrame(tableName, species, dimensionsFor(body ?? ""))
      if (frame) {
        frameBySpecies.set(species, frame)
      }
    }
  }
  return { graphicsInfoById, frameByGraphicsInfo, frameBySpecies }
}

const resolveFrame = (
  tables: ObjectSourceTables,
  graphicsId: string,
): SourceFrame | ObjectDiagnostic => {
  const species = graphicsId.match(/^OBJ_EVENT_GFX_MON_BASE\s*\+\s*(SPECIES_\w+)$/)?.[1]
  if (species) {
    return (
      tables.frameBySpecies.get(species) ?? {
        code: "unknown_species_graphics",
        message: `${graphicsId}: ${species} has no source follower graphic`,
      }
    )
  }
  if (!/^OBJ_EVENT_GFX_\w+$/.test(graphicsId)) {
    return {
      code: "unsupported_graphics_expression",
      message: `${graphicsId}: expected an object graphics ID or OBJ_EVENT_GFX_MON_BASE + species`,
    }
  }
  const graphicsInfo = tables.graphicsInfoById.get(graphicsId)
  if (!graphicsInfo) {
    return { code: "unknown_graphics_id", message: `${graphicsId}: no graphics-info pointer` }
  }
  return (
    tables.frameByGraphicsInfo.get(graphicsInfo) ?? {
      code: "unresolved_graphics_info",
      message: `${graphicsId}: ${graphicsInfo} has no resolvable source frame`,
    }
  )
}

const isDiagnostic = (value: SourceFrame | ObjectDiagnostic): value is ObjectDiagnostic => {
  return "code" in value
}

const writeFrame = (output: string, frame: SourceFrame): CatalogObject["sprite"] => {
  if (!fs.existsSync(frame.source)) {
    return null
  }
  const cropped = cropSpriteFrame(frame.source, {
    index: frame.frameIndex,
    width: frame.widthPixels,
    height: frame.heightPixels,
  })
  const digest = crypto
    .createHash("sha256")
    .update(`${cropped.width}x${cropped.height}:`)
    .update(cropped.pixels)
    .digest("hex")
  const filePath = path.join(output, "sprites", `${digest}.png`)
  if (!fs.existsSync(filePath)) {
    writeRgbaPng(filePath, cropped.width, cropped.height, cropped.pixels)
  }
  return {
    path: posixRelative(output, filePath),
    sha256: sha256(filePath),
    widthPixels: cropped.width,
    heightPixels: cropped.height,
    anchor: { xPixels: cropped.width / 2, yPixels: cropped.height },
    source: path.relative(output, frame.source).replaceAll("\\", "/"),
  }
}

export const catalogObjects = (
  root: string,
  output: string,
  events: ObjectEvent[],
  tables = objectSourceTables(root),
): CatalogObject[] => {
  return events.map((event, index) => {
    const objectId = String(index)
    const resolved = resolveFrame(tables, event.graphics_id)
    let sprite: CatalogObject["sprite"] = null
    let diagnostic: ObjectDiagnostic | null = null
    if (isDiagnostic(resolved)) {
      diagnostic = resolved
    } else {
      try {
        sprite = writeFrame(output, resolved)
        if (!sprite) {
          diagnostic = {
            code: "missing_source_sprite",
            message: `${event.graphics_id}: source file ${resolved.source} is missing`,
          }
        }
      } catch (error) {
        diagnostic = {
          code: "invalid_source_sprite",
          message: `${event.graphics_id}: ${error instanceof Error ? error.message : String(error)}`,
        }
      }
    }
    return {
      objectId,
      graphicsId: event.graphics_id,
      xMetatiles: event.x,
      yMetatiles: event.y,
      elevation: event.elevation,
      movementType: event.movement_type,
      movementRange: { x: event.movement_range_x, y: event.movement_range_y },
      trainerType: event.trainer_type,
      trainerSightOrBerryTreeId: event.trainer_sight_or_berry_tree_id,
      script: event.script,
      flag: event.flag,
      sprite,
      diagnostic,
    }
  })
}
