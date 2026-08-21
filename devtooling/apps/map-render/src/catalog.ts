import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

import {
  discoverExteriorMaps,
  exteriorMapTypes,
  renderMap,
  writeNearestNeighborOverview,
} from "./renderer.js";

type MapConnection = {
  map: string;
  offset: number;
  direction: "up" | "down" | "left" | "right" | "dive" | "emerge";
};

type WarpEvent = {
  x: number;
  y: number;
  elevation: number;
  dest_map: string;
  dest_warp_id: string;
};

type SourceMap = {
  id: string;
  layout: string;
  music?: string;
  region_map_section?: string;
  requires_flash?: boolean;
  weather?: string;
  map_type: string;
  show_map_name?: boolean;
  connections?: MapConnection[];
  warp_events?: WarpEvent[];
};

type Layout = {
  id: string;
  width: number;
  height: number;
  format?: string;
  primary_tileset: string;
  secondary_tileset: string;
};

type LayoutDocument = {
  layouts: Layout[];
};

type MapGroups = {
  group_order: string[];
  [group: string]: string[];
};

type CatalogMap = {
  name: string;
  id: string;
  region: string;
  category: string;
  sourceGroup: string;
  sourceRegion: null;
  mapType: string;
  mapSection: string | null;
  image: {
    path: string;
    sha256: string;
    widthPixels: number;
    heightPixels: number;
    overview: {
      path: string;
      sha256: string;
      widthPixels: number;
      heightPixels: number;
    };
  };
  layout: {
    id: string;
    format: string;
    widthMetatiles: number;
    heightMetatiles: number;
    primaryTileset: string;
    secondaryTileset: string;
  };
  world: {
    layer: "surface" | "underwater";
    defaultVisible: boolean;
    variantGroup: null;
    variant: null;
  };
  presentation: {
    music: string | null;
    weather: string | null;
    showMapName: boolean | null;
    requiresFlash: boolean | null;
  };
  connections: Array<{
    direction: MapConnection["direction"];
    offsetMetatiles: number;
    destinationMapId: string;
    destinationMap: string | null;
  }>;
  warps: Array<{
    warpId: string;
    xMetatiles: number;
    yMetatiles: number;
    elevation: number;
    destinationWarpId: string;
    destinationMapId: string;
    destinationMap: string | null;
  }>;
};

type MapCatalog = {
  $schema: "catalog.schema.json";
  schemaVersion: 1;
  format: "pokemonhns-exterior-map-catalog";
  pixelsPerMetatile: 16;
  source: {
    revision: string;
    workingTreeDirty: boolean;
  };
  regions: Array<{
    id: string;
    label: string;
    mapCount: number;
    maps: string[];
  }>;
  maps: CatalogMap[];
};

const kantoNamedMaps = new Set([
  "CeladonCity",
  "CeladonCity_Apartments_RoofNight",
  "CeladonCity_DepartmentStore_RoofNight",
  "CeruleanCity",
  "CinnabarIsland",
  "FuchsiaCity",
  "FuchsiaCity_SafariZoneBeach",
  "FuchsiaCity_SafariZoneBrush",
  "FuchsiaCity_SafariZoneMountain",
  "IndigoPlateau",
  "LavenderTown",
  "MtMoon_Outside",
  "PalletTown",
  "PewterCity",
  "SaffronCity",
  "VermilionCity",
  "VermilionCity_PortOutside",
  "ViridianCity",
  "ViridianForest",
]);

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

function sha256(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function posixRelative(root: string, path: string): string {
  return relative(root, path).replaceAll("\\", "/");
}

function git(root: string, args: string[]): string | null {
  try {
    return execFileSync("git", args, {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return null;
  }
}

function sourceState(root: string): MapCatalog["source"] {
  return {
    revision: git(root, ["rev-parse", "HEAD"]) ?? "unknown",
    workingTreeDirty: Boolean(git(root, ["status", "--porcelain"])),
  };
}

function sourceGroups(root: string): Map<string, string> {
  const groups = readJson<MapGroups>(join(root, "data/maps/map_groups.json"));
  const index = new Map<string, string>();
  for (const group of groups.group_order) {
    for (const name of groups[group] ?? []) {
      index.set(name, group);
    }
  }
  return index;
}

function regionFor(name: string, group: string): { id: string; label: string } {
  if (group.startsWith("gMapGroup_Emerald") || group === "gMapGroup_SpecialArea") {
    return { id: "hoenn", label: "Hoenn and inherited maps" };
  }
  const route = /^Route(\d+)(?:North)?$/.exec(name);
  if ((route && Number(route[1]) <= 28) || kantoNamedMaps.has(name)) {
    return { id: "kanto", label: "Kanto" };
  }
  return { id: "johto", label: "Johto" };
}

function categoryFor(mapType: string): string {
  if (mapType === "MAP_TYPE_TOWN" || mapType === "MAP_TYPE_CITY") {
    return "towns";
  }
  if (mapType === "MAP_TYPE_UNDERWATER") {
    return "underwater";
  }
  return "routes";
}

function mapOutputDirectory(output: string, region: string, category: string): string {
  const directory = join(output, "maps", region, category);
  mkdirSync(directory, { recursive: true });
  return directory;
}

/** Render every exterior map plus the metadata needed by the static map atlas. */
export function renderCatalog(root: string, output: string): { mapCount: number; output: string } {
  const layouts = new Map(
    readJson<LayoutDocument>(join(root, "data/layouts/layouts.json")).layouts.map((layout) => [
      layout.id,
      layout,
    ]),
  );
  const groups = sourceGroups(root);
  const exteriorMaps = discoverExteriorMaps(root);
  const sourceMaps = new Map(
    exteriorMaps.map((name) => [
      name,
      readJson<SourceMap>(join(root, "data/maps", name, "map.json")),
    ]),
  );
  const namesById = new Map([...sourceMaps].map(([name, map]) => [map.id, name]));
  const maps: CatalogMap[] = [];

  for (const name of exteriorMaps) {
    const source = sourceMaps.get(name)!;
    if (!exteriorMapTypes.has(source.map_type)) {
      continue;
    }
    const layout = layouts.get(source.layout);
    if (!layout) {
      throw new Error(`${name}: unknown layout ${source.layout}`);
    }
    const group = groups.get(name) ?? "gMapGroup_Unassigned";
    const region = regionFor(name, group);
    const category = categoryFor(source.map_type);
    const nativeDirectory = mapOutputDirectory(output, region.id, category);
    const nativePath = join(nativeDirectory, `${name}.png`);
    const overviewDirectory = join(output, "overviews", region.id, category);
    mkdirSync(overviewDirectory, { recursive: true });
    const overviewPath = join(overviewDirectory, `${name}.png`);
    renderMap(root, name, nativePath);
    writeNearestNeighborOverview(nativePath, overviewPath);
    const widthPixels = layout.width * 16;
    const heightPixels = layout.height * 16;
    maps.push({
      name,
      id: source.id,
      region: region.id,
      category,
      sourceGroup: group,
      sourceRegion: null,
      mapType: source.map_type,
      mapSection: source.region_map_section ?? null,
      image: {
        path: posixRelative(output, nativePath),
        sha256: sha256(nativePath),
        widthPixels,
        heightPixels,
        overview: {
          path: posixRelative(output, overviewPath),
          sha256: sha256(overviewPath),
          widthPixels: widthPixels / 4,
          heightPixels: heightPixels / 4,
        },
      },
      layout: {
        id: layout.id,
        format: layout.format ?? "emerald",
        widthMetatiles: layout.width,
        heightMetatiles: layout.height,
        primaryTileset: layout.primary_tileset,
        secondaryTileset: layout.secondary_tileset,
      },
      world: {
        layer: source.map_type === "MAP_TYPE_UNDERWATER" ? "underwater" : "surface",
        defaultVisible: source.map_type !== "MAP_TYPE_UNDERWATER",
        variantGroup: null,
        variant: null,
      },
      presentation: {
        music: source.music ?? null,
        weather: source.weather ?? null,
        showMapName: source.show_map_name ?? null,
        requiresFlash: source.requires_flash ?? null,
      },
      connections: (Array.isArray(source.connections) ? source.connections : []).map(
        (connection) => ({
          direction: connection.direction,
          offsetMetatiles: connection.offset,
          destinationMapId: connection.map,
          destinationMap: namesById.get(connection.map) ?? null,
        }),
      ),
      warps: (Array.isArray(source.warp_events) ? source.warp_events : []).map((warp, index) => ({
        warpId: String(index),
        xMetatiles: warp.x,
        yMetatiles: warp.y,
        elevation: warp.elevation,
        destinationWarpId: warp.dest_warp_id,
        destinationMapId: warp.dest_map,
        destinationMap: namesById.get(warp.dest_map) ?? null,
      })),
    });
  }

  const regions = [
    { id: "johto", label: "Johto" },
    { id: "kanto", label: "Kanto" },
    { id: "hoenn", label: "Hoenn and inherited maps" },
  ].map((region) => {
    const names = maps.filter((map) => map.region === region.id).map((map) => map.name);
    return { ...region, mapCount: names.length, maps: names };
  });
  const catalog: MapCatalog = {
    $schema: "catalog.schema.json",
    schemaVersion: 1,
    format: "pokemonhns-exterior-map-catalog",
    pixelsPerMetatile: 16,
    source: sourceState(root),
    regions,
    maps,
  };
  mkdirSync(output, { recursive: true });
  writeFileSync(join(output, "catalog.json"), `${JSON.stringify(catalog, null, 2)}\n`);
  return { mapCount: maps.length, output };
}
