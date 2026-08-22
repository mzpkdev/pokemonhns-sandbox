# HnS cartographer

This Svelte app is a static map browser. The browser loads a generated catalog
and image assets, then places default-visible exterior maps from their cardinal
source connections.

Run these commands from `devtooling/`:

```sh
pnpm run cartographer:catalog
pnpm --filter @wayfarer/ui run dev
pnpm --filter @wayfarer/ui run e2e
```

The cartographer provides region selection, map and map-section search, URL-persisted
map selection and camera state, native and overview image switching, map facts,
and warp navigation. Its generated input is ignored under
`build/cartographer/map-catalog/`.

`src/App.svelte` owns the page shell and module navigation. Each module lives under
`src/modules/`. Cartographer and its styled interface primitives live in
`src/modules/cartographer/`, including `ui-toolkit/`. The map search combobox and exits
checkbox wrap Ark UI; compose these local controls to keep the cartographer's visual and
accessibility contracts consistent.

The browser test expects a generated catalog. Run the root `pnpm run e2e`
command when the catalog has not already been generated.
