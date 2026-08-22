<script lang="ts">
  import type { CatalogObject } from "./catalog.js"
  import { cn } from "./lib/cn.js"
  import type { ObjectSelection } from "./types.js"
  import Button from "./ui-toolkit/Button.svelte"
  import { mapImageUrl } from "./urls.js"

  type Props = {
    mapName: string
    trainers: readonly CatalogObject[]
    selectedObject: ObjectSelection | null
    onSelectTrainer?: (trainer: CatalogObject) => void
  }

  let { mapName, trainers, selectedObject, onSelectTrainer }: Props = $props()

  const isSelected = (trainer: CatalogObject): boolean => {
    return selectedObject?.sourceMapName === mapName && selectedObject.objectId === trainer.objectId
  }
</script>

<section class="border-b border-cartographer-border p-5" aria-label="Trainer events">
  <div class="flex items-baseline justify-between gap-3">
    <div>
      <h3 class="m-0 text-base font-semibold">Trainer events</h3>
      <p class="mb-0 mt-1 text-sm leading-5 text-cartographer-muted">
        Placed trainer events from this map’s source data.
      </p>
    </div>
    <span class="shrink-0 font-cartographer-mono text-xs text-cartographer-amber"
      >{trainers.length}</span
    >
  </div>

  {#if trainers.length === 0}
    <p class="mb-0 mt-3 text-sm text-cartographer-muted">
      No trainer events are recorded for this map.
    </p>
  {:else}
    <ul class="m-0 mt-3 grid min-w-0 list-none gap-1.5 p-0">
      {#each trainers as trainer (trainer.objectId)}
        <li class="min-w-0">
          <Button
            class={cn(
              "flex min-w-0 w-full items-center gap-3 border-cartographer-border px-3 py-2 text-left hover:border-cartographer-signal hover:bg-cartographer-signal/10 focus-visible:outline-cartographer-signal",
              isSelected(trainer) && "border-cartographer-signal bg-cartographer-signal/10",
            )}
            aria-pressed={isSelected(trainer)}
            onclick={() => onSelectTrainer?.(trainer)}
          >
            {#if trainer.sprite}
              <span
                class="flex size-9 shrink-0 items-end justify-center border border-cartographer-border bg-cartographer-panel-raised"
              >
                <img
                  src={mapImageUrl(trainer.sprite.path)}
                  alt=""
                  width={trainer.sprite.widthPixels}
                  height={trainer.sprite.heightPixels}
                  class="max-h-8 max-w-7 object-contain [image-rendering:pixelated]"
                />
              </span>
            {/if}
            <span class="min-w-0 flex-1">
              <span class="block break-words text-sm font-medium">
                {trainer.kind.action ?? "Trainer event"}
              </span>
              <span
                class="mt-0.5 block break-all font-cartographer-mono text-[0.68rem] text-cartographer-muted"
              >
                ({trainer.xMetatiles}, {trainer.yMetatiles}) · {trainer.graphicsId}
              </span>
            </span>
            <span class="shrink-0 font-cartographer-mono text-[0.68rem] text-cartographer-muted">
              {isSelected(trainer) ? "Selected" : trainer.sprite ? "Sprite" : "Marker"}
            </span>
          </Button>
        </li>
      {/each}
    </ul>
  {/if}
</section>
