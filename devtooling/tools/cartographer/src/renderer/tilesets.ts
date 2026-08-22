import * as fs from "node:fs"
import * as path from "node:path"

import { readIndexedPng } from "./png"
import { readDefine } from "./source"
import type { IndexedPng, Layout, RenderAssets, Rgb, TilesetAssets } from "./types"

const renderAssets = new Map<string, RenderAssets>()

const readPalette = (filePath: string): Rgb[] => {
  const colors = fs
    .readFileSync(filePath, "utf8")
    .split(/\r?\n/)
    .slice(3, 19)
    .map((line) => line.split(/\s+/).map(Number) as [number, number, number])
  if (colors.length !== 16 || colors.some((color) => color.some(Number.isNaN))) {
    throw new Error(`invalid palette: ${filePath}`)
  }
  return colors
}

const splitTiles = (image: IndexedPng): Uint8Array[] => {
  const tiles: Uint8Array[] = []
  for (let tileY = 0; tileY < image.height; tileY += 8) {
    for (let tileX = 0; tileX < image.width; tileX += 8) {
      const tile = new Uint8Array(64)
      for (let y = 0; y < 8; y += 1) {
        tile.set(image.rows[tileY + y]!.subarray(tileX, tileX + 8), y * 8)
      }
      tiles.push(tile)
    }
  }
  return tiles
}

const tilesetGraphics = (root: string): string => {
  return [
    fs.readFileSync(path.join(root, "src/data/tilesets/graphics.h"), "utf8"),
    fs.existsSync(path.join(root, "src/graphics.c"))
      ? fs.readFileSync(path.join(root, "src/graphics.c"), "utf8")
      : "",
  ].join("\n")
}

const resolveTilesetDirectory = (root: string, symbol: string): string => {
  const graphics = tilesetGraphics(root)
  const stem = symbol.replace(/^gTileset_/, "")
  const expression = new RegExp(
    `gTilesetTiles_${stem}\\[\\].*?"([^"]+)/tiles(?:\\.png|\\.4bpp(?:\\.lz)?)"`,
  )
  const match = expression.exec(graphics)
  if (match?.[1]) {
    return path.join(root, match[1])
  }
  const snakeName = stem.replace(/(?!^)([A-Z])/g, "_$1").toLowerCase()
  for (const kind of ["primary", "secondary"]) {
    const candidate = path.join(root, "data/tilesets", kind, snakeName)
    if (fs.existsSync(path.join(candidate, "tiles.png"))) {
      return candidate
    }
  }
  throw new Error(`cannot resolve ${symbol}`)
}

const resolveTilesetAssets = (root: string, symbol: string): TilesetAssets => {
  const headers = fs.readFileSync(path.join(root, "src/data/tilesets/headers.h"), "utf8")
  const graphics = tilesetGraphics(root)
  const metatiles = fs.readFileSync(path.join(root, "src/data/tilesets/metatiles.h"), "utf8")
  const header = new RegExp(`const struct Tileset ${symbol}\\s*=\\s*\\{([\\s\\S]*?)\\};`).exec(
    headers,
  )
  if (header?.[1]) {
    const fields = new Map(
      [...header[1].matchAll(/\.(tiles|palettes|metatiles|metatileAttributes)\s*=\s*(\w+)/g)].map(
        (match) => [match[1]!, match[2]!],
      ),
    )
    const files = new Map<string, string>()
    const patterns: Record<string, [string, RegExp]> = {
      tiles: [graphics, /\[\].*?"([^"]+\/tiles(?:\.png|\.4bpp(?:\.lz)?))"/s],
      palettes: [graphics, /.*?\{.*?"([^"]+\/palettes\/\d+\.pal)"/s],
      metatiles: [metatiles, /\[\].*?"([^"]+\/metatiles\.bin)"/s],
      metatileAttributes: [metatiles, /\[\].*?"([^"]+\/metatile_attributes\.bin)"/s],
    }
    for (const [field, [source, pattern]] of Object.entries(patterns)) {
      const resource = fields.get(field)
      const match = resource
        ? new RegExp(`${resource}${pattern.source}`, pattern.flags).exec(source)
        : null
      if (match?.[1]) {
        files.set(field, path.join(root, match[1]))
      }
    }
    const tiles = files.get("tiles")
    const palettes = files.get("palettes")
    const metatilePath = files.get("metatiles")
    const metatileAttributes = files.get("metatileAttributes")
    if (tiles && palettes && metatilePath && metatileAttributes) {
      const pngTiles = tiles.replace(/\/tiles(?:\.png|\.4bpp(?:\.lz)?)$/, "/tiles.png")
      return {
        tiles: fs.existsSync(pngTiles) ? pngTiles : tiles,
        palettes: path.dirname(palettes),
        metatiles: metatilePath,
        metatileAttributes,
      }
    }
  }
  const directory = resolveTilesetDirectory(root, symbol)
  return {
    tiles: path.join(directory, "tiles.png"),
    palettes: path.join(directory, "palettes"),
    metatiles: path.join(directory, "metatiles.bin"),
    metatileAttributes: path.join(directory, "metatile_attributes.bin"),
  }
}

export const readLayoutFormatCounts = (
  root: string,
  layoutFormat: string,
): [number, number, number] => {
  const fieldmap = path.join(root, "include/fieldmap.h")
  if (layoutFormat === "emerald") {
    return [
      readDefine(fieldmap, "NUM_TILES_IN_PRIMARY"),
      readDefine(fieldmap, "NUM_METATILES_IN_PRIMARY"),
      readDefine(fieldmap, "NUM_PALS_IN_PRIMARY"),
    ]
  }
  if (layoutFormat === "frlg") {
    return [
      readDefine(fieldmap, "NUM_TILES_IN_PRIMARY_FRLG"),
      readDefine(fieldmap, "NUM_METATILES_IN_PRIMARY_FRLG"),
      readDefine(fieldmap, "NUM_PALS_IN_PRIMARY_FRLG"),
    ]
  }
  if (layoutFormat === "johto") {
    const source = fs.readFileSync(path.join(root, "src/fieldmap.c"), "utf8")
    const match = /\[MAP_LAYOUT_FORMAT_JOHTO\]\s*=\s*\{\s*(\d+),\s*(\d+),\s*(\d+),/.exec(source)
    if (match?.[1] && match[2] && match[3]) {
      return [Number(match[1]), Number(match[2]), Number(match[3])]
    }
  }
  throw new Error(`unsupported map layout format: ${layoutFormat}`)
}

const choosePalettePath = (primary: string, secondary: string, index: number): string => {
  const name = `${String(index).padStart(2, "0")}.pal`
  const preferred = path.join(primary, name)
  return fs.existsSync(preferred) ? preferred : path.join(secondary, name)
}

export const loadRenderAssets = (
  root: string,
  layout: Layout,
  primaryTileCount: number,
  primaryPaletteCount: number,
  paletteCount: number,
): RenderAssets => {
  const cacheKey = [
    root,
    layout.primary_tileset,
    layout.secondary_tileset,
    primaryTileCount,
    primaryPaletteCount,
    paletteCount,
  ].join("\u0000")
  const cached = renderAssets.get(cacheKey)
  if (cached) {
    return cached
  }
  const primary = resolveTilesetAssets(root, layout.primary_tileset)
  const secondary = resolveTilesetAssets(root, layout.secondary_tileset)
  const assets = {
    primaryTiles: splitTiles(readIndexedPng(primary.tiles)),
    secondaryTiles: splitTiles(readIndexedPng(secondary.tiles)),
    primaryMetatiles: fs.readFileSync(primary.metatiles),
    secondaryMetatiles: fs.readFileSync(secondary.metatiles),
    primaryMetatileAttributes: fs.readFileSync(primary.metatileAttributes),
    secondaryMetatileAttributes: fs.readFileSync(secondary.metatileAttributes),
    palettes: Array.from({ length: paletteCount }, (_, index) =>
      readPalette(
        choosePalettePath(
          index < primaryPaletteCount ? primary.palettes : secondary.palettes,
          index < primaryPaletteCount ? secondary.palettes : primary.palettes,
          index,
        ),
      ),
    ),
  }
  renderAssets.set(cacheKey, assets)
  return assets
}
