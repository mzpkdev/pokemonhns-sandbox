<script lang="ts">
  import type { CatalogMap, CatalogWildEncounterMethod } from "./catalog.js"
  import { fishingGroupIds, rodLabel, visibleEncounterSlots } from "./encounters.js"
  import EncounterSlotsTable from "./EncounterSlotsTable.svelte"

  type Props = {
    selectedMap: CatalogMap | null
  }

  let { selectedMap }: Props = $props()

  const methodLabels: Record<CatalogWildEncounterMethod["type"], string> = {
    land_mons: "Land",
    water_mons: "Water",
    rock_smash_mons: "Rock Smash",
    fishing_mons: "Fishing",
  }
  const methodTypes = Object.keys(methodLabels) as CatalogWildEncounterMethod["type"][]

  const variantLabels = {
    base: "Base",
    normal_day: "Normal day",
    normal_night: "Normal night",
    alternate_day: "Alternate day",
    alternate_night: "Alternate night",
  } as const
</script>

<section class="border border-cartographer-border bg-cartographer-panel shadow-cartographer-panel">
  {#if !selectedMap}
    <div class="p-6">
      <p
        class="m-0 font-cartographer-mono text-[0.68rem] font-bold tracking-[0.15em] text-cartographer-signal"
      >
        Rendered exterior-map encounters
      </p>
      <h2 class="mb-3 mt-3 text-xl font-semibold">Select a map</h2>
      <p class="m-0 leading-6 text-cartographer-muted">
        Choose a rendered exterior map from the region index or search to inspect the encounter sets
        recorded in the source.
      </p>
    </div>
  {:else}
    <header class="border-b border-cartographer-border p-5 sm:flex sm:items-end sm:justify-between">
      <div>
        <p
          class="m-0 font-cartographer-mono text-[0.68rem] font-bold tracking-[0.15em] text-cartographer-signal"
        >
          Rendered exterior-map encounters
        </p>
        <h2 class="mb-0 mt-2 text-2xl font-semibold tracking-[-0.025em]">{selectedMap.name}</h2>
      </div>
      <p class="mb-0 mt-2 font-cartographer-mono text-xs text-cartographer-muted sm:text-right">
        {selectedMap.wildEncounters.sets.length} source {selectedMap.wildEncounters.sets.length ===
        1
          ? "set"
          : "sets"}
      </p>
    </header>

    {#if selectedMap.wildEncounters.sets.length === 0}
      <div class="p-6">
        <h3 class="m-0 text-base font-semibold">No source encounter sets</h3>
        <p class="mb-0 mt-2 leading-6 text-cartographer-muted">
          This exterior map has no wild encounter set recorded in the source catalog.
        </p>
      </div>
    {:else}
      <div class="grid gap-5 p-5">
        {#if selectedMap.wildEncounters.variants.length > 0}
          <section
            class="border border-cartographer-border"
            aria-label="Runtime encounter variants"
          >
            <header
              class="border-b border-cartographer-border bg-cartographer-panel-raised px-4 py-3"
            >
              <h3 class="m-0 text-sm font-semibold">Runtime encounter variants</h3>
              <p class="mb-0 mt-1 text-sm text-cartographer-muted">
                These entries follow the runtime's contiguous header lookup; missing headers are
                shown without substituting another source set.
              </p>
            </header>
            <ul class="m-0 grid list-none divide-y divide-cartographer-border p-0">
              {#each selectedMap.wildEncounters.variants as variant (variant.id)}
                <li class="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 py-3">
                  <div>
                    <p class="m-0 text-sm font-medium">{variantLabels[variant.id]}</p>
                    {#if variant.set}
                      <code
                        class="mt-1 block font-cartographer-mono text-xs text-cartographer-signal-soft"
                        >{variant.set.baseLabel}</code
                      >
                    {:else}
                      <p class="mb-0 mt-1 text-sm text-cartographer-muted">
                        Missing contiguous header
                      </p>
                    {/if}
                  </div>
                  <p class="m-0 font-cartographer-mono text-[0.68rem] text-cartographer-muted">
                    header {variant.headerIndex}
                  </p>
                </li>
              {/each}
            </ul>
          </section>
        {/if}

        {#each selectedMap.wildEncounters.sets as encounterSet, setIndex (`${encounterSet.baseLabel}-${setIndex}`)}
          {@const listedMethods = new Set(encounterSet.methods.map((method) => method.type))}
          {@const missingMethods = methodTypes.filter((type) => !listedMethods.has(type))}
          <section
            class="border border-cartographer-border"
            aria-label={`Source set ${encounterSet.baseLabel}`}
          >
            <header
              class="border-b border-cartographer-border bg-cartographer-panel-raised px-4 py-3"
            >
              <p class="m-0 text-sm font-semibold">Source set</p>
              <code
                class="mt-1 block break-all font-cartographer-mono text-xs text-cartographer-signal-soft"
                >{encounterSet.baseLabel}</code
              >
              <p
                class="mb-0 mt-2 break-all font-cartographer-mono text-[0.68rem] text-cartographer-muted"
              >
                {encounterSet.source.path}{encounterSet.source.pointer}
              </p>
            </header>

            {#if missingMethods.length > 0}
              <p
                class="m-0 border-b border-cartographer-border px-4 py-2 text-sm text-cartographer-muted"
              >
                Not recorded in this source set: {missingMethods.join(", ")}
              </p>
            {/if}

            <div class="grid divide-y divide-cartographer-border">
              {#each encounterSet.methods as method (method.type)}
                {@const visibleSlots = visibleEncounterSlots(method)}
                <section class="p-4" aria-label={`${methodLabels[method.type]} encounter method`}>
                  <div class="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <h3 class="m-0 text-base font-semibold">{methodLabels[method.type]}</h3>
                    <p class="m-0 font-cartographer-mono text-xs text-cartographer-muted">
                      Source rate {method.encounterRate}
                    </p>
                  </div>
                  <p
                    class="mb-3 mt-1 font-cartographer-mono text-[0.68rem] text-cartographer-muted"
                  >
                    Slot weights are source table weights, not final player encounter probabilities.
                  </p>
                  {#if visibleSlots.length === 0}
                    <p class="m-0 text-sm text-cartographer-muted">
                      No non-zero source slots are recorded for this method.
                    </p>
                  {:else if method.type === "fishing_mons"}
                    {@const groupIds = fishingGroupIds(method)}
                    {@const ungroupedSlots = visibleSlots.filter(
                      (slot) => slot.groups.length === 0,
                    )}
                    <div class="grid gap-4">
                      {#each groupIds as groupId (groupId)}
                        <section
                          class="border border-cartographer-border"
                          aria-label={`${rodLabel(groupId)} fishing`}
                        >
                          <header
                            class="flex items-baseline justify-between gap-3 border-b border-cartographer-border bg-cartographer-panel-raised px-3 py-2"
                          >
                            <h4 class="m-0 text-sm font-semibold">{rodLabel(groupId)}</h4>
                            <code
                              class="font-cartographer-mono text-[0.68rem] text-cartographer-muted"
                              >{groupId}</code
                            >
                          </header>
                          <EncounterSlotsTable
                            slots={visibleSlots.filter((slot) =>
                              slot.groups.some((group) => group.id === groupId),
                            )}
                          />
                        </section>
                      {/each}
                      {#if ungroupedSlots.length > 0}
                        <section class="border border-cartographer-border p-3">
                          <p class="m-0 text-sm text-cartographer-muted">
                            Slots without a recorded source group
                          </p>
                          <div class="mt-3"><EncounterSlotsTable slots={ungroupedSlots} /></div>
                        </section>
                      {/if}
                    </div>
                  {:else}
                    <EncounterSlotsTable slots={visibleSlots} />
                  {/if}
                </section>
              {/each}
            </div>
          </section>
        {/each}
      </div>
    {/if}
  {/if}
</section>
