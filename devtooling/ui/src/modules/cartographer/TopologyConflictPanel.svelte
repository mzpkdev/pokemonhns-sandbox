<script lang="ts">
  import type { TopologyConflict } from "./geography.js"

  type Props = {
    conflicts: readonly TopologyConflict[]
    visible: boolean
  }

  let { conflicts, visible }: Props = $props()
</script>

{#if visible && conflicts.length > 0}
  <section
    class="border-t border-[#9f5d68] bg-[#241a20] px-4 py-3"
    aria-label="Topology conflict details"
  >
    <p class="m-0 font-cartographer-mono text-[0.68rem] font-bold tracking-[0.12em] text-[#e7a1a9]">
      Topology conflicts
    </p>
    <p class="mb-3 mt-1 text-xs leading-5 text-cartographer-muted">
      Dashed outlines mark an expected map position. The line points to the map's actual position.
    </p>
    <ul class="m-0 grid max-h-36 list-none gap-1.5 overflow-y-auto p-0">
      {#each conflicts as conflict (`${conflict.sourceMap}:${conflict.destinationMap}:${conflict.direction}:${conflict.offsetMetatiles}`)}
        <li class="border border-cartographer-border bg-cartographer-panel px-3 py-2 text-xs">
          <p class="m-0 font-cartographer-mono text-cartographer-signal-soft">
            {conflict.sourceMap} → {conflict.destinationMap}
          </p>
          <p class="mb-0 mt-1 text-cartographer-muted">
            {conflict.direction} · offset {conflict.offsetMetatiles} · expected ({conflict.expected
              .x}, {conflict.expected.y}), actual ({conflict.actual.x}, {conflict.actual.y})
          </p>
        </li>
      {/each}
    </ul>
  </section>
{/if}
