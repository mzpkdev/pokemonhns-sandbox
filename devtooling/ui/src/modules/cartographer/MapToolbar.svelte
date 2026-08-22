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
  class="flex flex-wrap items-center gap-x-4 gap-y-2 bg-[#0b1220] px-4 py-3 text-sm text-cartographer-muted"
>
  <span class="font-cartographer-mono text-[0.68rem] tracking-[0.08em]"
    >{surfaceMapCount} SURFACES · {componentCount} GROUPS</span
  >
  {#if residualCount > 0}
    <span
      class="font-cartographer-mono text-[0.68rem] font-bold tracking-[0.08em] text-cartographer-amber"
      >{residualCount} TOPOLOGY CONFLICTS</span
    >
  {/if}
  <Checkbox checked={showExits} onCheckedChange={onToggleExits}>Exits</Checkbox>
  <div class="ml-0 flex gap-1.5 sm:ml-auto" aria-label="Map controls">
    <Button class="px-2 py-1 font-cartographer-mono text-xs" onclick={() => onZoomOut?.()}>−</Button
    >
    <Button class="px-2 py-1 font-cartographer-mono text-xs" onclick={() => onZoomIn?.()}>+</Button>
    <Button
      class="font-cartographer-mono text-[0.68rem] tracking-[0.08em]"
      onclick={() => onFit?.()}>FIT VIEW</Button
    >
  </div>
</div>
