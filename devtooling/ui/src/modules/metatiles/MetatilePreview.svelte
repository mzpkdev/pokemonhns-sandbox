<script lang="ts">
  import type { CatalogMetatile, MetatileTileset } from "./catalog.js"
  import { metatileAssetUrl, metatileScopedLabel } from "./catalog.js"

  type Props = {
    index: number
    metatile: CatalogMetatile
    size?: number
    tileset: MetatileTileset
  }

  let { index, metatile, size = 48, tileset }: Props = $props()

  let atlasColumn = $derived(index % tileset.atlas.columns)
  let atlasRow = $derived(Math.floor(index / tileset.atlas.columns))
  let atlasScale = $derived(size / tileset.atlas.cellPixels)
  let backgroundStyle = $derived(
    [
      `background-image:url(${JSON.stringify(metatileAssetUrl(tileset.atlas.path))})`,
      `background-position:-${atlasColumn * size}px -${atlasRow * size}px`,
      `background-size:${tileset.atlas.widthPixels * atlasScale}px ${tileset.atlas.heightPixels * atlasScale}px`,
      `height:${size}px`,
      `width:${size}px`,
    ].join(";"),
  )
</script>

<span
  class="block shrink-0 border border-cartographer-border bg-cartographer-field [image-rendering:pixelated]"
  role="img"
  aria-label={metatileScopedLabel(metatile)}
  style={backgroundStyle}
></span>
