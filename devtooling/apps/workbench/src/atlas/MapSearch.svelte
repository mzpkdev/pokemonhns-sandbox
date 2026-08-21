<script lang="ts">
  import type { CatalogMap } from "./catalog.js"

  type Props = {
    maps: readonly CatalogMap[]
    query?: string
    onSelectMap?: (name: string, focus: boolean) => void
  }

  let { maps, query = $bindable(""), onSelectMap }: Props = $props()

  const search = (catalogMaps: readonly CatalogMap[], searchQuery: string): CatalogMap[] => {
    const needle = searchQuery.toLocaleLowerCase("en").replace(/[^a-z0-9]+/g, "")
    if (!needle) return []
    return catalogMaps
      .filter((map) =>
        [map.name, map.mapSection ?? ""].some((value) =>
          value
            .toLocaleLowerCase("en")
            .replace(/[^a-z0-9]+/g, "")
            .includes(needle),
        ),
      )
      .sort(
        (left, right) =>
          left.name.localeCompare(right.name, "en") || left.id.localeCompare(right.id, "en"),
      )
  }

  let results = $derived(search(maps, query))
</script>

<section
  class="rounded-xl border border-atlas-border bg-atlas-panel p-4 shadow-[0_5px_18px_#56634c1b]"
  aria-label="Map search"
>
  <h2 class="mb-3 text-base font-semibold">Find a map</h2>
  <label class="mb-1 block text-sm font-bold text-atlas-muted" for="map-search-input"
    >Source name or map section</label
  >
  <input
    class="w-full rounded-md border border-[#9eaf9b] bg-white px-2.5 py-2 text-inherit focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#53704e]"
    id="map-search-input"
    type="search"
    bind:value={query}
    placeholder="e.g. Route29 or MAPSEC..."
  />
  {#if query.trim()}
    <ul class="mt-3 grid max-h-72 list-none gap-1.5 overflow-auto p-0" aria-label="Matching maps">
      {#if results.length > 0}
        {#each results as map (map.id)}
          <li>
            <button
              class="flex w-full items-center justify-between gap-3 rounded-lg border border-[#c5d1c2] bg-white px-3 py-2 text-left transition hover:bg-[#e5efdc] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#53704e]"
              type="button"
              onclick={() => onSelectMap?.(map.name, true)}
            >
              <span>{map.name}</span>
              <small class="text-right break-words text-atlas-muted"
                >{map.mapSection ?? "No map section"}</small
              >
            </button>
          </li>
        {/each}
      {:else}
        <li class="text-sm text-atlas-muted">No source maps or map sections match.</li>
      {/if}
    </ul>
  {/if}
</section>
