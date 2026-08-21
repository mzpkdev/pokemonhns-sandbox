# HnS map atlas

This is the Svelte port of Pokemon OpenWorld's Map Atlas. It is a static map
browser: the browser loads a generated catalog and image assets, then places
default-visible exterior maps from their cardinal source connections.

Run these commands from `devtooling/`:

```sh
npm run map-atlas:catalog
npm --workspace @pokemonhns/devtooling-workbench run dev
```

The atlas provides region selection, map and map-section search, URL-persisted
map selection and camera state, native and overview image switching, map facts,
and warp navigation. Its generated input is ignored under
`build/map-atlas/map-catalog/`.
