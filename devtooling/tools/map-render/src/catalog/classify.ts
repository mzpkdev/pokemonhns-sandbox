import * as path from "node:path"

import type { CatalogRegion } from "./types"

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
])

const johto: CatalogRegion = { id: "johto", label: "Johto" }
const kanto: CatalogRegion = { id: "kanto", label: "Kanto" }
const hoenn: CatalogRegion = { id: "hoenn", label: "Hoenn and inherited maps" }

export const catalogRegions: CatalogRegion[] = [johto, kanto, hoenn]

export const regionFor = (name: string, group: string): CatalogRegion => {
  if (group.startsWith("gMapGroup_Emerald") || group === "gMapGroup_SpecialArea") {
    return hoenn
  }
  const route = /^Route(\d+)(?:North)?$/.exec(name)
  if ((route && Number(route[1]) <= 28) || kantoNamedMaps.has(name)) {
    return kanto
  }
  return johto
}

export const categoryFor = (mapType: string): string => {
  if (mapType === "MAP_TYPE_TOWN" || mapType === "MAP_TYPE_CITY") {
    return "towns"
  }
  if (mapType === "MAP_TYPE_UNDERWATER") {
    return "underwater"
  }
  return "routes"
}

export const mapOutputPaths = (
  output: string,
  region: string,
  category: string,
  mapName: string,
): { native: string; overview: string } => {
  return {
    native: path.join(output, "maps", region, category, `${mapName}.png`),
    overview: path.join(output, "overviews", region, category, `${mapName}.png`),
  }
}
