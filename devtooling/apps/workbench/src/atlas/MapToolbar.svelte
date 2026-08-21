<script lang="ts">
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

  const toggleExits = (event: Event): void => {
    onToggleExits?.((event.currentTarget as HTMLInputElement).checked)
  }
</script>

<div
  class="flex flex-wrap items-start justify-between gap-3 px-4 py-3 text-sm text-atlas-muted md:items-center"
>
  <span>{surfaceMapCount} surface maps, {componentCount} components</span>
  {#if residualCount > 0}
    <span class="font-bold text-[#994a14]">{residualCount} topology conflicts retained</span>
  {/if}
  <label
    class="inline-flex cursor-pointer items-center gap-1.5 font-bold whitespace-nowrap text-[#263e29]"
  >
    <input class="size-[1.1rem]" type="checkbox" checked={showExits} onchange={toggleExits} />
    Exits
  </label>
  <div class="ml-0 flex gap-1.5 md:ml-auto" aria-label="Map controls">
    <button
      class="rounded-md border border-[#8a5b10] bg-white px-2 py-1 text-[#263e29] hover:bg-[#8a5b10] hover:text-white focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#704707]"
      type="button"
      onclick={() => onZoomOut?.()}>−</button
    >
    <button
      class="rounded-md border border-[#8a5b10] bg-white px-2 py-1 text-[#263e29] hover:bg-[#8a5b10] hover:text-white focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#704707]"
      type="button"
      onclick={() => onZoomIn?.()}>+</button
    >
    <button
      class="rounded-md border border-[#8a5b10] bg-white px-2 py-1 text-[#263e29] hover:bg-[#8a5b10] hover:text-white focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#704707]"
      type="button"
      onclick={() => onFit?.()}>Fit / reset</button
    >
  </div>
</div>
