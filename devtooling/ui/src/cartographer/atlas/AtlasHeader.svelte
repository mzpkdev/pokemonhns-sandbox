<script lang="ts">
  import type { MapCatalog } from "./catalog.js"
  import { cn } from "../lib/cn.js"

  type Props = { catalog: MapCatalog }

  let { catalog }: Props = $props()
</script>

<header class="mb-6 flex flex-col items-start justify-between gap-4 md:flex-row md:items-end">
  <div>
    <p class="mb-1 text-xs font-bold tracking-[0.12em] text-[#577044] uppercase">
      Pokemon Heart &amp; Soul
    </p>
    <h1 class="m-0 text-[clamp(1.7rem,4vw,2.6rem)] font-bold">Map atlas</h1>
  </div>
  <p class="m-0 flex items-center gap-2 text-sm text-[#4b5a4c]">
    Source {catalog.source.revision.slice(0, 12)}
    <span
      class={cn(
        "rounded-full px-2 py-0.5 font-bold",
        catalog.source.workingTreeDirty
          ? "bg-[#f8d7a8] text-[#7b4411]"
          : "bg-[#d3ebcf] text-[#1d672b]",
      )}
    >
      {catalog.source.workingTreeDirty ? "dirty" : "clean"}
    </span>
  </p>
</header>
