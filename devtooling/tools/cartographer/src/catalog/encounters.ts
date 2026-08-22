import * as fs from "node:fs"
import * as path from "node:path"

import type {
  CatalogEncounterSprite,
  CatalogEncounterSet,
  CatalogEncounterVariant,
  CatalogSourcePointer,
  CatalogWildEncounters,
} from "./types"

const wildEncounterPath = "src/data/wild_encounters.json"
const speciesNamesPath = "src/data/text/species_names.h"
const wildEncounterRuntimePath = "src/wild_encounter.c"
const encounterTypes = ["land_mons", "water_mons", "rock_smash_mons", "fishing_mons"] as const
const encounterVariants = [
  { id: "base", timeBasedEncounterValue: 0, offset: 0 },
  { id: "normal_day", timeBasedEncounterValue: 1, offset: 0 },
  { id: "normal_night", timeBasedEncounterValue: 2, offset: 1 },
  { id: "alternate_day", timeBasedEncounterValue: 3, offset: 2 },
  { id: "alternate_night", timeBasedEncounterValue: 4, offset: 3 },
] as const

type EncounterType = (typeof encounterTypes)[number]

type SourceField = {
  type: EncounterType
  encounter_rates: number[]
  groups?: Record<string, number[]>
}

type SourceSlot = {
  min_level: number
  max_level: number
  species: string
}

type SourceMethod = {
  encounter_rate: number
  mons: SourceSlot[]
}

type SourceEncounter = {
  map: string
  base_label: string
  [method: string]: unknown
}

type SourceEncounterGroup = {
  label: string
  for_maps?: boolean
  fields: SourceField[]
  encounters: SourceEncounter[]
}

type SourceEncounterDocument = {
  wild_encounter_groups: SourceEncounterGroup[]
}

type FieldMetadata = {
  field: SourceField
  groupIndex: number
  fieldIndex: number
}

const sourcePointer = (pointer: string): CatalogSourcePointer => {
  return { path: wildEncounterPath, pointer }
}

const sourceError = (pointer: string, message: string): Error => {
  return new Error(`${wildEncounterPath}${pointer}: ${message}`)
}

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

const isEncounterType = (value: unknown): value is EncounterType => {
  return typeof value === "string" && encounterTypes.includes(value as EncounterType)
}

const requireString = (value: unknown, pointer: string): string => {
  if (typeof value !== "string" || value.length === 0) {
    throw sourceError(pointer, "expected a non-empty string")
  }
  return value
}

const requireRate = (value: unknown, pointer: string): number => {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw sourceError(pointer, "expected a non-negative finite number")
  }
  return value
}

const requireIndex = (value: unknown, pointer: string, slotCount: number): number => {
  if (!Number.isInteger(value) || (value as number) < 0 || (value as number) >= slotCount) {
    throw sourceError(pointer, `expected a slot index from 0 through ${slotCount - 1}`)
  }
  return value as number
}

const fieldsFor = (document: unknown): FieldMetadata[][] => {
  if (!isRecord(document) || !Array.isArray(document.wild_encounter_groups)) {
    throw sourceError("", "expected wild_encounter_groups to be an array")
  }
  return document.wild_encounter_groups.map((group, groupIndex) => {
    const groupPointer = `/wild_encounter_groups/${groupIndex}`
    if (!isRecord(group)) throw sourceError(groupPointer, "expected an object")
    requireString(group.label, `${groupPointer}/label`)
    if (group.for_maps !== true) return []
    if (!Array.isArray(group.fields)) {
      throw sourceError(`${groupPointer}/fields`, "expected an array")
    }
    if (!Array.isArray(group.encounters)) {
      throw sourceError(`${groupPointer}/encounters`, "expected an array")
    }
    return group.fields.map((field, fieldIndex) => {
      const fieldPointer = `${groupPointer}/fields/${fieldIndex}`
      if (!isRecord(field) || !isEncounterType(field.type)) {
        throw sourceError(fieldPointer, "expected a supported encounter method type")
      }
      if (!Array.isArray(field.encounter_rates) || field.encounter_rates.length === 0) {
        throw sourceError(`${fieldPointer}/encounter_rates`, "expected a non-empty array")
      }
      for (const [rateIndex, rate] of field.encounter_rates.entries()) {
        requireRate(rate, `${fieldPointer}/encounter_rates/${rateIndex}`)
      }
      if (field.groups !== undefined) {
        if (!isRecord(field.groups))
          throw sourceError(`${fieldPointer}/groups`, "expected an object")
        for (const [groupId, indices] of Object.entries(field.groups)) {
          requireString(groupId, `${fieldPointer}/groups`)
          if (!Array.isArray(indices)) {
            throw sourceError(`${fieldPointer}/groups/${groupId}`, "expected an array")
          }
          for (const [index, slotIndex] of indices.entries()) {
            requireIndex(
              slotIndex,
              `${fieldPointer}/groups/${groupId}/${index}`,
              field.encounter_rates.length,
            )
          }
        }
      }
      return { field: field as SourceField, groupIndex, fieldIndex }
    })
  })
}

const methodFor = (value: unknown, pointer: string): SourceMethod => {
  if (!isRecord(value)) throw sourceError(pointer, "expected an object")
  const encounterRate = requireRate(value.encounter_rate, `${pointer}/encounter_rate`)
  if (!Array.isArray(value.mons) || value.mons.length === 0) {
    throw sourceError(`${pointer}/mons`, "expected at least one source slot")
  }
  for (const [slotIndex, slot] of value.mons.entries()) {
    const slotPointer = `${pointer}/mons/${slotIndex}`
    if (!isRecord(slot)) throw sourceError(slotPointer, "expected an object")
    const minLevel = requireRate(slot.min_level, `${slotPointer}/min_level`)
    const maxLevel = requireRate(slot.max_level, `${slotPointer}/max_level`)
    if (!Number.isInteger(minLevel) || !Number.isInteger(maxLevel) || minLevel > maxLevel) {
      throw sourceError(
        slotPointer,
        "expected integral levels with min_level no greater than max_level",
      )
    }
    requireString(slot.species, `${slotPointer}/species`)
  }
  return { encounter_rate: encounterRate, mons: value.mons as SourceSlot[] }
}

const groupsForSlot = (
  metadata: FieldMetadata,
  slotIndex: number,
): CatalogEncounterSet["methods"][number]["slots"][number]["groups"] => {
  const groupPointer = `/wild_encounter_groups/${metadata.groupIndex}/fields/${metadata.fieldIndex}/groups`
  return Object.entries(metadata.field.groups ?? [])
    .filter(([, slots]) => slots.includes(slotIndex))
    .map(([id]) => ({ id, source: sourcePointer(`${groupPointer}/${id}`) }))
}

const variantsFor = (
  group: SourceEncounterGroup,
  firstHeaderIndex: number,
  mapId: string,
  setByHeaderIndex: ReadonlyMap<number, CatalogEncounterSet>,
): CatalogEncounterVariant[] => {
  return encounterVariants.map((variant) => {
    const headerIndex = firstHeaderIndex + variant.offset
    const set = setByHeaderIndex.get(headerIndex)
    const available = group.encounters[headerIndex]?.map === mapId && set !== undefined
    return {
      ...variant,
      headerIndex,
      availability: available ? "available" : "missing_contiguous_header",
      set: available ? { baseLabel: set.baseLabel, source: set.source } : null,
    }
  })
}

/**
 * Preserve raw encounter sets and the runtime's positional variant lookup. The runtime picks a
 * map's first gWildMonHeaders entry, then adds VAR_TIME_BASED_ENCOUNTER minus one, so missing
 * contiguous records are represented instead of guessed from base-label suffixes.
 */
export const catalogWildEncounters = (
  document: unknown,
  mapNamesById: ReadonlyMap<string, string>,
  speciesLabelsById: ReadonlyMap<string, string>,
  selectorMapIds: ReadonlySet<string> = new Set(),
  spriteForSpecies: (speciesId: string) => CatalogEncounterSprite | null = () => null,
): Map<string, CatalogWildEncounters> => {
  const groupFields = fieldsFor(document)
  const groups = (document as SourceEncounterDocument).wild_encounter_groups
  const byMap = new Map<string, CatalogWildEncounters>()
  for (const [groupIndex, group] of groups.entries()) {
    const groupPointer = `/wild_encounter_groups/${groupIndex}`
    if (group.for_maps !== true) continue
    const setsByMapId = new Map<string, CatalogEncounterSet[]>()
    const setByHeaderIndex = new Map<number, CatalogEncounterSet>()
    const diagnosticsByHeaderIndex = new Map<number, CatalogWildEncounters["diagnostics"]>()
    const firstHeaderByMapId = new Map<string, number>()
    for (const [headerIndex, encounter] of group.encounters.entries()) {
      const encounterPointer = `${groupPointer}/encounters/${headerIndex}`
      if (!isRecord(encounter)) throw sourceError(encounterPointer, "expected an object")
      const mapId = requireString(encounter.map, `${encounterPointer}/map`)
      const baseLabel = requireString(encounter.base_label, `${encounterPointer}/base_label`)
      const diagnostics: CatalogWildEncounters["diagnostics"] = []
      const methods = groupFields[groupIndex]!.filter(
        (metadata) => encounter[metadata.field.type] !== null && metadata.field.type in encounter,
      ).map((metadata) => {
        const methodType = metadata.field.type
        const methodPointer = `${encounterPointer}/${methodType}`
        const method = methodFor(encounter[methodType], methodPointer)
        return {
          type: methodType,
          encounterRate: method.encounter_rate,
          source: sourcePointer(methodPointer),
          slots: method.mons.flatMap((slot, slotIndex) => {
            const source = sourcePointer(`${methodPointer}/mons/${slotIndex}`)
            if (slotIndex >= metadata.field.encounter_rates.length) {
              diagnostics.push({
                code: "unaddressable_source_slot",
                reason: "outside_method_slot_table",
                setBaseLabel: baseLabel,
                methodType,
                slotIndex,
                speciesId: slot.species,
                minLevel: slot.min_level,
                maxLevel: slot.max_level,
                source,
              })
              return []
            }
            const slotRate = metadata.field.encounter_rates[slotIndex]!
            const reason =
              slot.species === "SPECIES_NONE"
                ? "species_none"
                : slotRate === 0
                  ? "zero_slot_rate"
                  : null
            if (reason) {
              diagnostics.push({
                code: "excluded_source_slot",
                reason,
                setBaseLabel: baseLabel,
                methodType,
                slotIndex,
                speciesId: slot.species,
                slotRate,
                source,
              })
              return []
            }
            const speciesLabel = speciesLabelsById.get(slot.species)
            if (!speciesLabel) {
              throw sourceError(
                `${methodPointer}/mons/${slotIndex}/species`,
                "has no species-name source entry",
              )
            }
            return [
              {
                slotIndex,
                slotRate,
                slotRateSource: sourcePointer(
                  `/wild_encounter_groups/${metadata.groupIndex}/fields/${metadata.fieldIndex}/encounter_rates/${slotIndex}`,
                ),
                groups: groupsForSlot(metadata, slotIndex),
                minLevel: slot.min_level,
                maxLevel: slot.max_level,
                speciesId: slot.species,
                speciesLabel,
                sprite: spriteForSpecies(slot.species),
                source,
              },
            ]
          }),
        }
      })
      const mapName = mapNamesById.get(mapId)
      if (!mapName) continue
      const set: CatalogEncounterSet = {
        mapId,
        mapName,
        baseLabel,
        header: { groupLabel: group.label, groupIndex, headerIndex },
        source: sourcePointer(encounterPointer),
        methods,
      }
      const mapSets = setsByMapId.get(mapId) ?? []
      mapSets.push(set)
      setsByMapId.set(mapId, mapSets)
      setByHeaderIndex.set(headerIndex, set)
      diagnosticsByHeaderIndex.set(headerIndex, diagnostics)
      if (!firstHeaderByMapId.has(mapId)) firstHeaderByMapId.set(mapId, headerIndex)
    }
    for (const [mapId, sets] of setsByMapId) {
      const mapName = mapNamesById.get(mapId)!
      const current = byMap.get(mapName) ?? { sets: [], variants: [], diagnostics: [] }
      current.sets.push(...sets)
      current.diagnostics.push(
        ...sets.flatMap((set) => diagnosticsByHeaderIndex.get(set.header.headerIndex) ?? []),
      )
      if (group.label === "gWildMonHeaders" && !selectorMapIds.has(mapId)) {
        current.variants = variantsFor(
          group,
          firstHeaderByMapId.get(mapId)!,
          mapId,
          setByHeaderIndex,
        )
      }
      byMap.set(mapName, current)
    }
  }
  return byMap
}

export const sourceWildEncounters = (
  root: string,
  mapNamesById: ReadonlyMap<string, string>,
  spriteForSpecies?: (speciesId: string) => CatalogEncounterSprite | null,
): Map<string, CatalogWildEncounters> => {
  const filePath = path.join(root, wildEncounterPath)
  return catalogWildEncounters(
    JSON.parse(fs.readFileSync(filePath, "utf8")),
    mapNamesById,
    sourceSpeciesLabels(root),
    runtimeSelectorMapIds(root),
    spriteForSpecies,
  )
}

const sourceSpeciesLabels = (root: string): Map<string, string> => {
  const filePath = path.join(root, speciesNamesPath)
  const speciesLabels = new Map<string, string>()
  const entries = fs
    .readFileSync(filePath, "utf8")
    .matchAll(/^\s*\[(SPECIES_[A-Z0-9_]+)\]\s*=\s*_\("([^"]*)"\),/gm)

  for (const [, speciesId, speciesLabel] of entries) {
    speciesLabels.set(speciesId!, speciesLabel!)
  }

  if (speciesLabels.size === 0) {
    throw new Error(`${speciesNamesPath}: expected species-name source entries`)
  }
  return speciesLabels
}

/**
 * The wild encounter runtime adds VAR_ALTERING_CAVE_WILD_SET to Altering Cave's first header
 * after applying the time-based offset. Its contiguous rows are therefore selector sets, not
 * independently labelled time variants. Keep this assertion tied to the runtime source so a
 * source behavior change cannot silently reclassify them.
 */
const runtimeSelectorMapIds = (root: string): ReadonlySet<string> => {
  const runtimeSource = fs.readFileSync(path.join(root, wildEncounterRuntimePath), "utf8")
  const altersAlteringCaveHeaders =
    runtimeSource.includes("MAP_GROUP(ALTERING_CAVE)") &&
    runtimeSource.includes("MAP_NUM(ALTERING_CAVE)") &&
    runtimeSource.includes("i += alteringCaveId;")

  if (!altersAlteringCaveHeaders) {
    throw new Error(
      `${wildEncounterRuntimePath}: expected the Altering Cave wild-set selector runtime branch`,
    )
  }
  return new Set(["MAP_ALTERING_CAVE"])
}
