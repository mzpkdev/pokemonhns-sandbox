import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { deflateSync, inflateSync } from "node:zlib";

type Layout = {
  id: string;
  width: number;
  height: number;
  format?: string;
  primary_tileset: string;
  secondary_tileset: string;
  blockdata_filepath: string;
};

type LayoutDocument = {
  layouts: Layout[];
};

type MapData = {
  layout: string;
  map_type: string;
};

type Rgb = readonly [number, number, number];

type TilesetAssets = {
  tiles: string;
  palettes: string;
  metatiles: string;
};

type IndexedPng = {
  width: number;
  height: number;
  rows: Uint8Array[];
};

type RenderAssets = {
  primaryTiles: Uint8Array[];
  secondaryTiles: Uint8Array[];
  primaryMetatiles: Buffer;
  secondaryMetatiles: Buffer;
  palettes: Rgb[][];
};

const renderAssets = new Map<string, RenderAssets>();

export const exteriorMapTypes = new Set([
  "MAP_TYPE_TOWN",
  "MAP_TYPE_CITY",
  "MAP_TYPE_ROUTE",
  "MAP_TYPE_OCEAN_ROUTE",
  "MAP_TYPE_UNDERWATER",
]);

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

function readDefine(path: string, name: string): number {
  const source = readFileSync(path, "utf8");
  const match = new RegExp(`^\\s*#define\\s+${name}\\s+(\\d+)\\s*$`, "m").exec(source);
  if (!match?.[1]) {
    throw new Error(`cannot resolve ${name} from ${path}`);
  }
  return Number(match[1]);
}

function readIndexedPng(path: string): IndexedPng {
  const data = readFileSync(path);
  const signature = "89504e470d0a1a0a";
  if (data.subarray(0, 8).toString("hex") !== signature) {
    throw new Error(`not a PNG: ${path}`);
  }

  let position = 8;
  let header: Buffer | undefined;
  const imageData: Buffer[] = [];
  while (position < data.length) {
    const size = data.readUInt32BE(position);
    const kind = data.subarray(position + 4, position + 8).toString("ascii");
    const payloadStart = position + 8;
    const payloadEnd = payloadStart + size;
    const payload = data.subarray(payloadStart, payloadEnd);
    position = payloadEnd + 4;
    if (kind === "IHDR") {
      header = payload;
    } else if (kind === "IDAT") {
      imageData.push(payload);
    } else if (kind === "IEND") {
      break;
    }
  }

  if (!header || header.length !== 13) {
    throw new Error(`missing PNG header: ${path}`);
  }
  const width = header.readUInt32BE(0);
  const height = header.readUInt32BE(4);
  const depth = header[8];
  const color = header[9];
  const interlace = header[12];
  if (color !== 3 || (depth !== 4 && depth !== 8) || interlace !== 0) {
    throw new Error(`unsupported PNG format in ${path}: depth=${depth}, color=${color}`);
  }

  const raw = inflateSync(Buffer.concat(imageData));
  const packedWidth = Math.ceil((width * depth) / 8);
  const rows: Uint8Array[] = [];
  let previous = new Uint8Array(packedWidth);
  let offset = 0;
  for (let rowIndex = 0; rowIndex < height; rowIndex += 1) {
    const mode = raw[offset];
    offset += 1;
    const scan = new Uint8Array(raw.subarray(offset, offset + packedWidth));
    offset += packedWidth;
    for (let x = 0; x < packedWidth; x += 1) {
      const left = x === 0 ? 0 : scan[x - 1]!;
      const above = previous[x]!;
      const upperLeft = x === 0 ? 0 : previous[x - 1]!;
      if (mode === 1) {
        scan[x] = (scan[x]! + left) & 0xff;
      } else if (mode === 2) {
        scan[x] = (scan[x]! + above) & 0xff;
      } else if (mode === 3) {
        scan[x] = (scan[x]! + Math.floor((left + above) / 2)) & 0xff;
      } else if (mode === 4) {
        const estimate = left + above - upperLeft;
        const leftDistance = Math.abs(estimate - left);
        const aboveDistance = Math.abs(estimate - above);
        const upperLeftDistance = Math.abs(estimate - upperLeft);
        const predictor =
          leftDistance <= aboveDistance && leftDistance <= upperLeftDistance
            ? left
            : aboveDistance <= upperLeftDistance
              ? above
              : upperLeft;
        scan[x] = (scan[x]! + predictor) & 0xff;
      } else if (mode !== 0) {
        throw new Error(`unsupported PNG filter ${mode} in ${path}`);
      }
    }
    if (depth === 4) {
      const expanded = new Uint8Array(width);
      for (let x = 0; x < width; x += 1) {
        const value = scan[Math.floor(x / 2)]!;
        expanded[x] = x % 2 === 0 ? value >> 4 : value & 0x0f;
      }
      rows.push(expanded);
    } else {
      rows.push(scan);
    }
    previous = scan;
  }
  return { width, height, rows };
}

function readPalette(path: string): Rgb[] {
  const colors = readFileSync(path, "utf8")
    .split(/\r?\n/)
    .slice(3, 19)
    .map((line) => line.split(/\s+/).map(Number) as [number, number, number]);
  if (colors.length !== 16 || colors.some((color) => color.some(Number.isNaN))) {
    throw new Error(`invalid palette: ${path}`);
  }
  return colors;
}

function crc32(bytes: Uint8Array): number {
  let value = 0xffffffff;
  for (const byte of bytes) {
    value ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      value = (value >>> 1) ^ (value & 1 ? 0xedb88320 : 0);
    }
  }
  return (value ^ 0xffffffff) >>> 0;
}

function pngChunk(kind: string, payload: Uint8Array): Buffer {
  const kindBytes = Buffer.from(kind, "ascii");
  const chunk = Buffer.alloc(12 + payload.length);
  chunk.writeUInt32BE(payload.length, 0);
  kindBytes.copy(chunk, 4);
  Buffer.from(payload).copy(chunk, 8);
  chunk.writeUInt32BE(crc32(Buffer.concat([kindBytes, Buffer.from(payload)])), 8 + payload.length);
  return chunk;
}

function writeRgbPng(path: string, width: number, height: number, pixels: Uint8Array): void {
  const stride = width * 3;
  const raw = Buffer.alloc(height * (stride + 1));
  for (let y = 0; y < height; y += 1) {
    const outputOffset = y * (stride + 1);
    raw[outputOffset] = 0;
    Buffer.from(pixels).copy(raw, outputOffset + 1, y * stride, (y + 1) * stride);
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 2;
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(
    path,
    Buffer.concat([
      Buffer.from("89504e470d0a1a0a", "hex"),
      pngChunk("IHDR", header),
      pngChunk("IDAT", deflateSync(raw, { level: 9 })),
      pngChunk("IEND", Buffer.alloc(0)),
    ]),
  );
}

function splitTiles(image: IndexedPng): Uint8Array[] {
  const tiles: Uint8Array[] = [];
  for (let tileY = 0; tileY < image.height; tileY += 8) {
    for (let tileX = 0; tileX < image.width; tileX += 8) {
      const tile = new Uint8Array(64);
      for (let y = 0; y < 8; y += 1) {
        tile.set(image.rows[tileY + y]!.subarray(tileX, tileX + 8), y * 8);
      }
      tiles.push(tile);
    }
  }
  return tiles;
}

function resolveTilesetDirectory(root: string, symbol: string): string {
  const graphics = [
    readFileSync(join(root, "src/data/tilesets/graphics.h"), "utf8"),
    existsSync(join(root, "src/graphics.c"))
      ? readFileSync(join(root, "src/graphics.c"), "utf8")
      : "",
  ].join("\n");
  const stem = symbol.replace(/^gTileset_/, "");
  const expression = new RegExp(
    `gTilesetTiles_${stem}\\[\\].*?"([^"]+)/tiles(?:\\.png|\\.4bpp(?:\\.lz)?)"`,
  );
  const match = expression.exec(graphics);
  if (match?.[1]) {
    return join(root, match[1]);
  }
  const snakeName = stem.replace(/(?!^)([A-Z])/g, "_$1").toLowerCase();
  for (const kind of ["primary", "secondary"]) {
    const candidate = join(root, "data/tilesets", kind, snakeName);
    if (existsSync(join(candidate, "tiles.png"))) {
      return candidate;
    }
  }
  throw new Error(`cannot resolve ${symbol}`);
}

function resolveTilesetAssets(root: string, symbol: string): TilesetAssets {
  const headers = readFileSync(join(root, "src/data/tilesets/headers.h"), "utf8");
  const graphics = [
    readFileSync(join(root, "src/data/tilesets/graphics.h"), "utf8"),
    existsSync(join(root, "src/graphics.c"))
      ? readFileSync(join(root, "src/graphics.c"), "utf8")
      : "",
  ].join("\n");
  const metatiles = readFileSync(join(root, "src/data/tilesets/metatiles.h"), "utf8");
  const header = new RegExp(`const struct Tileset ${symbol}\\s*=\\s*\\{([\\s\\S]*?)\\};`).exec(
    headers,
  );
  if (header?.[1]) {
    const fields = new Map(
      [...header[1].matchAll(/\.(tiles|palettes|metatiles)\s*=\s*(\w+)/g)].map((match) => [
        match[1]!,
        match[2]!,
      ]),
    );
    const files = new Map<string, string>();
    const patterns: Record<string, [string, RegExp]> = {
      tiles: [graphics, /\[\].*?"([^"]+\/tiles(?:\.png|\.4bpp(?:\.lz)?))"/s],
      palettes: [graphics, /.*?\{.*?"([^"]+\/palettes\/\d+\.pal)"/s],
      metatiles: [metatiles, /\[\].*?"([^"]+\/metatiles\.bin)"/s],
    };
    for (const [field, [source, pattern]] of Object.entries(patterns)) {
      const resource = fields.get(field);
      const match = resource
        ? new RegExp(`${resource}${pattern.source}`, pattern.flags).exec(source)
        : null;
      if (match?.[1]) {
        files.set(field, join(root, match[1]));
      }
    }
    const tiles = files.get("tiles");
    const palettes = files.get("palettes");
    const metatilePath = files.get("metatiles");
    if (tiles && palettes && metatilePath) {
      const pngTiles = tiles.replace(/\/tiles(?:\.png|\.4bpp(?:\.lz)?)$/, "/tiles.png");
      return {
        tiles: existsSync(pngTiles) ? pngTiles : tiles,
        palettes: dirname(palettes),
        metatiles: metatilePath,
      };
    }
  }
  const directory = resolveTilesetDirectory(root, symbol);
  return {
    tiles: join(directory, "tiles.png"),
    palettes: join(directory, "palettes"),
    metatiles: join(directory, "metatiles.bin"),
  };
}

function readLayoutFormatCounts(root: string, layoutFormat: string): [number, number, number] {
  const fieldmap = join(root, "include/fieldmap.h");
  if (layoutFormat === "emerald") {
    return [
      readDefine(fieldmap, "NUM_TILES_IN_PRIMARY"),
      readDefine(fieldmap, "NUM_METATILES_IN_PRIMARY"),
      readDefine(fieldmap, "NUM_PALS_IN_PRIMARY"),
    ];
  }
  if (layoutFormat === "frlg") {
    return [
      readDefine(fieldmap, "NUM_TILES_IN_PRIMARY_FRLG"),
      readDefine(fieldmap, "NUM_METATILES_IN_PRIMARY_FRLG"),
      readDefine(fieldmap, "NUM_PALS_IN_PRIMARY_FRLG"),
    ];
  }
  if (layoutFormat === "johto") {
    const source = readFileSync(join(root, "src/fieldmap.c"), "utf8");
    const match = /\[MAP_LAYOUT_FORMAT_JOHTO\]\s*=\s*\{\s*(\d+),\s*(\d+),\s*(\d+),/.exec(source);
    if (match?.[1] && match[2] && match[3]) {
      return [Number(match[1]), Number(match[2]), Number(match[3])];
    }
  }
  throw new Error(`unsupported map layout format: ${layoutFormat}`);
}

function choosePalettePath(primary: string, secondary: string, index: number): string {
  const name = `${String(index).padStart(2, "0")}.pal`;
  const preferred = join(primary, name);
  return existsSync(preferred) ? preferred : join(secondary, name);
}

function loadRenderAssets(
  root: string,
  layout: Layout,
  primaryTileCount: number,
  primaryPaletteCount: number,
  paletteCount: number,
): RenderAssets {
  const cacheKey = [
    root,
    layout.primary_tileset,
    layout.secondary_tileset,
    primaryTileCount,
    primaryPaletteCount,
    paletteCount,
  ].join("\u0000");
  const cached = renderAssets.get(cacheKey);
  if (cached) {
    return cached;
  }
  const primary = resolveTilesetAssets(root, layout.primary_tileset);
  const secondary = resolveTilesetAssets(root, layout.secondary_tileset);
  const assets = {
    primaryTiles: splitTiles(readIndexedPng(primary.tiles)),
    secondaryTiles: splitTiles(readIndexedPng(secondary.tiles)),
    primaryMetatiles: readFileSync(primary.metatiles),
    secondaryMetatiles: readFileSync(secondary.metatiles),
    palettes: Array.from({ length: paletteCount }, (_, index) =>
      readPalette(
        choosePalettePath(
          index < primaryPaletteCount ? primary.palettes : secondary.palettes,
          index < primaryPaletteCount ? secondary.palettes : primary.palettes,
          index,
        ),
      ),
    ),
  };
  renderAssets.set(cacheKey, assets);
  return assets;
}

export function discoverExteriorMaps(root: string): string[] {
  const mapsRoot = join(root, "data/maps");
  return readdirSync(mapsRoot)
    .sort()
    .filter((name) => existsSync(join(mapsRoot, name, "map.json")))
    .filter((name) =>
      exteriorMapTypes.has(readJson<MapData>(join(mapsRoot, name, "map.json")).map_type),
    );
}

export function renderMap(
  root: string,
  mapName: string,
  output: string,
): { width: number; height: number } {
  const layouts = readJson<LayoutDocument>(join(root, "data/layouts/layouts.json")).layouts;
  const mapData = readJson<MapData>(join(root, "data/maps", mapName, "map.json"));
  const layout = layouts.find((candidate) => candidate.id === mapData.layout);
  if (!layout) {
    throw new Error(`${mapName}: unknown layout ${mapData.layout}`);
  }
  const [primaryTileCount, primaryMetatileCount, primaryPaletteCount] = readLayoutFormatCounts(
    root,
    layout.format ?? "emerald",
  );
  const paletteCount = readDefine(join(root, "include/fieldmap.h"), "NUM_PALS_TOTAL");
  const assets = loadRenderAssets(
    root,
    layout,
    primaryTileCount,
    primaryPaletteCount,
    paletteCount,
  );

  const blockdata = readFileSync(join(root, layout.blockdata_filepath));
  const mapWordCount = layout.width * layout.height;
  if (blockdata.length < mapWordCount * 2) {
    throw new Error(`${mapName}: blockdata is shorter than its layout`);
  }
  const outputWidth = layout.width * 16;
  const outputHeight = layout.height * 16;
  const outputPixels = new Uint8Array(outputWidth * outputHeight * 3);

  const drawTile = (
    tileWord: number,
    secondarySource: boolean,
    destinationX: number,
    destinationY: number,
    transparent: boolean,
  ): void => {
    const tileId = tileWord & 0x3ff;
    const horizontalFlip = Boolean(tileWord & 0x400);
    const verticalFlip = Boolean(tileWord & 0x800);
    const palette = assets.palettes[(tileWord >> 12) & 0xf] ?? assets.palettes[0]!;
    const tile =
      secondarySource && tileId >= primaryTileCount
        ? (assets.secondaryTiles[tileId - primaryTileCount] ?? new Uint8Array(64))
        : (assets.primaryTiles[tileId] ?? new Uint8Array(64));
    for (let pixelY = 0; pixelY < 8; pixelY += 1) {
      const sourceY = verticalFlip ? 7 - pixelY : pixelY;
      for (let pixelX = 0; pixelX < 8; pixelX += 1) {
        const sourceX = horizontalFlip ? 7 - pixelX : pixelX;
        const colorIndex = tile[sourceY * 8 + sourceX]!;
        if (transparent && colorIndex === 0) {
          continue;
        }
        const color = palette[colorIndex] ?? [0, 0, 0];
        const offset = ((destinationY + pixelY) * outputWidth + destinationX + pixelX) * 3;
        outputPixels.set(color, offset);
      }
    }
  };

  for (let mapY = 0; mapY < layout.height; mapY += 1) {
    for (let mapX = 0; mapX < layout.width; mapX += 1) {
      const mapWord = blockdata.readUInt16LE((mapY * layout.width + mapX) * 2);
      const metatileId = mapWord & 0x3ff;
      const secondarySource = metatileId >= primaryMetatileCount;
      const metatileBytes = secondarySource ? assets.secondaryMetatiles : assets.primaryMetatiles;
      const metatileIndex = secondarySource ? metatileId - primaryMetatileCount : metatileId;
      const start = metatileIndex * 16;
      for (let layer = 0; layer < 2; layer += 1) {
        for (let quadrant = 0; quadrant < 4; quadrant += 1) {
          drawTile(
            start + layer * 8 + quadrant * 2 + 2 <= metatileBytes.length
              ? metatileBytes.readUInt16LE(start + layer * 8 + quadrant * 2)
              : 0,
            secondarySource,
            mapX * 16 + (quadrant % 2) * 8,
            mapY * 16 + Math.floor(quadrant / 2) * 8,
            layer === 1,
          );
        }
      }
    }
  }

  writeRgbPng(output, outputWidth, outputHeight, outputPixels);
  return { width: layout.width, height: layout.height };
}
