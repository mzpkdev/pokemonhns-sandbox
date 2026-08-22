<script lang="ts">
  import Button from "./ui-toolkit/Button.svelte"
  import Checkbox from "./ui-toolkit/Checkbox.svelte"

  type Props = {
    surfaceMapCount: number
    componentCount: number
    residualCount: number
    showExits: boolean
    onToggleExits?: (value: boolean) => void
    onZoomOut?: () => void
    onZoomIn?: () => void
    onFit?: () => void
  }

  let {
    surfaceMapCount,
    componentCount,
    residualCount,
    showExits,
    onToggleExits,
    onZoomOut,
    onZoomIn,
    onFit,
  }: Props = $props()
</script>

<div
  class="flex flex-wrap items-start justify-between gap-3 px-4 py-3 text-sm text-cartographer-muted md:items-center"
>
  <span>{surfaceMapCount} surface maps, {componentCount} components</span>
  {#if residualCount > 0}
    <span class="font-bold text-[#994a14]">{residualCount} topology conflicts retained</span>
  {/if}
  <Checkbox checked={showExits} onCheckedChange={onToggleExits}>Exits</Checkbox>
  <div class="ml-0 flex gap-1.5 md:ml-auto" aria-label="Map controls">
    <Button class="px-2 py-1" onclick={() => onZoomOut?.()}>−</Button>
    <Button class="px-2 py-1" onclick={() => onZoomIn?.()}>+</Button>
    <Button onclick={() => onFit?.()}>Fit / reset</Button>
  </div>
</div>
