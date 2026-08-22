# HnS map atlas

This is the Svelte port of Pokemon OpenWorld's Map Atlas. It is a static map
browser: the browser loads a generated catalog and image assets, then places
default-visible exterior maps from their cardinal source connections.

Run these commands from `devtooling/`:

```sh
pnpm run map-atlas:catalog
pnpm --filter @pokemonhns/devtooling-ui run dev
pnpm --filter @pokemonhns/devtooling-ui run e2e
```

The atlas provides region selection, map and map-section search, URL-persisted
map selection and camera state, native and overview image switching, map facts,
and warp navigation. Its generated input is ignored under
`build/map-atlas/map-catalog/`.

Styled interface primitives live in `src/ui-toolkit/`. The map search combobox
and exits checkbox wrap Ark UI; compose these local controls to keep the atlas's
visual and accessibility contracts consistent.

The browser test expects a generated catalog. Run the root `pnpm run e2e`
command when the catalog has not already been generated.
