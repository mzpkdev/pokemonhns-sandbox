<script lang="ts">
  import type {
    CatalogCycleTopologyMismatch,
    CatalogDirectTopologyMismatch,
    CatalogTopologyConnection,
    CatalogTopologyDiagnostic,
  } from "./catalog.js"

  type Props = {
    diagnostics: readonly CatalogTopologyDiagnostic[]
    visible: boolean
  }

  let { diagnostics, visible }: Props = $props()

  const connectionLabel = (connection: CatalogTopologyConnection): string => {
    return `${connection.source.map} → ${connection.destination.map} (${connection.direction}, ${connection.offsetMetatiles})`
  }

  const directKey = (diagnostic: CatalogDirectTopologyMismatch): string => {
    return `${diagnostic.connection.source.map}:${diagnostic.connection.source.header.pointer}`
  }

  const cycleKey = (diagnostic: CatalogCycleTopologyMismatch): string => {
    return diagnostic.connections
      .map((pair) => `${pair.connection.source.map}:${pair.connection.source.header.pointer}`)
      .join("|")
  }

  const diagnosticKey = (diagnostic: CatalogTopologyDiagnostic): string => {
    if (diagnostic.code === "direct_connection_mismatch") return directKey(diagnostic)
    if (diagnostic.code === "missing_reverse_connection") {
      return `missing:${diagnostic.connection.source.map}:${diagnostic.connection.source.header.pointer}`
    }
    return cycleKey(diagnostic)
  }
</script>

{#if visible && diagnostics.length > 0}
  <section
    class="border-t border-[#9f5d68] bg-[#241a20] px-4 py-3"
    aria-label="Topology diagnostic details"
  >
    <p class="m-0 font-cartographer-mono text-[0.68rem] font-bold tracking-[0.12em] text-[#e7a1a9]">
      Topology diagnostics
    </p>
    <p class="mb-3 mt-1 text-xs leading-5 text-cartographer-muted">
      Direct mismatches compare two reciprocal records. Cycle closures use a neutral dashed trace
      and a review marker, but do not mark a map as wrong because the source cannot establish that.
    </p>
    <ul class="m-0 grid max-h-48 list-none gap-1.5 overflow-y-auto p-0">
      {#each diagnostics as diagnostic (diagnosticKey(diagnostic))}
        <li class="border border-cartographer-border bg-cartographer-panel px-3 py-2 text-xs">
          {#if diagnostic.code === "direct_connection_mismatch"}
            <p class="m-0 font-cartographer-mono text-cartographer-signal-soft">
              Direct connection mismatch · {connectionLabel(diagnostic.connection)}
            </p>
            <p class="mb-0 mt-1 text-cartographer-muted">
              Expected reverse: {diagnostic.expectedReverse.direction} · offset {diagnostic
                .expectedReverse.offsetMetatiles}. Recorded reverse: {connectionLabel(
                diagnostic.reverseConnection,
              )}.
            </p>
            <p class="mb-0 mt-1 text-cartographer-muted">{diagnostic.explanation}</p>
            <p class="mb-0 mt-1 font-cartographer-mono text-[0.65rem] text-cartographer-muted">
              Inspect {diagnostic.connection.source.header.path}{diagnostic.connection.source.header
                .pointer} and {diagnostic.reverseConnection.source.header.path}{diagnostic
                .reverseConnection.source.header.pointer}
            </p>
          {:else}
            {#if diagnostic.code === "missing_reverse_connection"}
              <p class="m-0 font-cartographer-mono text-cartographer-signal-soft">
                Missing reverse connection · {connectionLabel(diagnostic.connection)}
              </p>
              <p class="mb-0 mt-1 text-cartographer-muted">
                Expected reverse: {diagnostic.expectedReverse.direction} · offset {diagnostic
                  .expectedReverse.offsetMetatiles}. No reciprocal source record was found.
              </p>
              <p class="mb-0 mt-1 text-cartographer-muted">{diagnostic.explanation}</p>
              <p class="mb-0 mt-1 font-cartographer-mono text-[0.65rem] text-cartographer-muted">
                Inspect {diagnostic.connection.source.header.path}{diagnostic.connection.source
                  .header.pointer}
              </p>
            {:else}
              <p class="m-0 font-cartographer-mono text-cartographer-signal-soft">
                Cycle closure mismatch · Δ ({diagnostic.residualMetatiles.x}, {diagnostic
                  .residualMetatiles.y}) metatiles
              </p>
              <p class="mb-0 mt-1 text-cartographer-muted">
                Maps involved: {diagnostic.maps.map((map) => map.map).join(" · ")}
              </p>
              <p class="mb-0 mt-1 text-cartographer-muted">{diagnostic.explanation}</p>
              <p class="mb-0 mt-1 font-cartographer-mono text-[0.65rem] text-cartographer-muted">
                Source records: {diagnostic.connections
                  .map(
                    (pair) =>
                      `${pair.connection.source.map}${pair.connection.source.header.pointer} ↔ ${pair.reverseConnection.source.map}${pair.reverseConnection.source.header.pointer}`,
                  )
                  .join(" · ")}
              </p>
              <p class="mb-0 mt-1 text-cartographer-muted">
                Advisory ranking · confidence: none. Every participant can break this cycle, so this
                is context for investigation, not a fault assignment.
              </p>
              <ul class="mb-0 mt-1 grid list-none gap-1 p-0 text-cartographer-muted">
                {#each diagnostic.candidates as candidate (`${candidate.rank}:${candidate.map}`)}
                  <li>
                    {candidate.rank}. {candidate.map} · {candidate.independentConnectionCount}
                    independent connections · remaining component {candidate.remainingComponentSize}.
                  </li>
                {/each}
              </ul>
            {/if}
          {/if}
        </li>
      {/each}
    </ul>
  </section>
{/if}
