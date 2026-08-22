<script lang="ts">
  import Button from "./ui-toolkit/Button.svelte"
  import Checkbox from "./ui-toolkit/Checkbox.svelte"

  type Props = {
    surfaceMapCount: number
    componentCount: number
    residualCount: number
    showExits: boolean
    showObjects: boolean
    onToggleExits?: (value: boolean) => void
    onToggleObjects?: (value: boolean) => void
    onZoomOut?: () => void
    onZoomIn?: () => void
    onFit?: () => void
  }

  let {
    surfaceMapCount,
    componentCount,
    residualCount,
    showExits,
    showObjects,
    onToggleExits,
    onToggleObjects,
    onZoomOut,
    onZoomIn,
    onFit,
  }: Props = $props()
</script>

<div
  class="flex flex-wrap items-center gap-x-4 gap-y-2 bg-[#14171a] px-4 py-3 text-sm text-cartographer-muted"
>
  <span class="text-xs">{surfaceMapCount} surfaces · {componentCount} groups</span>
  {#if residualCount > 0}
    <span class="text-xs font-semibold text-cartographer-amber"
      >{residualCount} topology conflicts</span
    >
  {/if}
  <Checkbox checked={showExits} onCheckedChange={onToggleExits}>Exits</Checkbox>
  <Checkbox checked={showObjects} onCheckedChange={onToggleObjects}>Objects</Checkbox>
  <div class="ml-0 flex gap-1.5 sm:ml-auto" aria-label="Map controls">
    <Button class="px-2 py-1 text-xs" onclick={() => onZoomOut?.()}>−</Button>
    <Button class="px-2 py-1 text-xs" onclick={() => onZoomIn?.()}>+</Button>
    <Button class="text-xs" onclick={() => onFit?.()}>Fit view</Button>
  </div>
</div>
