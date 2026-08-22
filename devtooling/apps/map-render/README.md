# HnS map renderer

`hns-map-render` renders static terrain PNGs directly from the HnS source tree.
It does not build or run the ROM.

Build the renderer once, then run it from `devtooling/`:

```sh
pnpm run build
pnpm run map-render Route29 NewBarkTown --output build/map-renders
pnpm run map-render --all-exteriors --output build/all-exterior-maps
pnpm run map-render --catalog --output build/map-atlas/map-catalog
```

The workspace command runs this package's `main` entry. Its `hns-map-render`
binary is also available directly after the build:

```sh
pnpm --filter @pokemonhns/devtooling-map-render exec hns-map-render Route29
```

Map names are directory names under `data/maps/`. `--all-exteriors` selects
every map whose type is town, city, route, ocean route, or underwater. The
default repository is the nearest ancestor with `data/maps/`; use `--repo` to
render another compatible source tree.

The command writes `<map-name>.png` files to the output directory. It renders
terrain only, so events, NPCs, weather, animations, and story state are absent.

`--catalog` writes every exterior terrain image and a `catalog.json` manifest
for the Svelte map atlas. The manifest records source identifiers, map metadata,
cardinal connections, warps, image dimensions, hashes, and deterministic
one-quarter nearest-neighbour overview images.
