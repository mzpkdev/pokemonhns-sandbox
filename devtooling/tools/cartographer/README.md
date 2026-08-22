# HnS cartographer

`wcartographer` renders static terrain PNGs directly from the HnS source tree.
It does not build or run the ROM.

Build the renderer once, then run it from `devtooling/`:

```sh
pnpm run build
pnpm run cartographer Route29 NewBarkTown --output build/map-renders
pnpm run cartographer --all-exteriors --output build/all-exterior-maps
pnpm run cartographer --catalog --output build/map-atlas/map-catalog
```

The workspace command runs this package's `main` entry. Its `wcartographer`
binary is also available directly after the build:

```sh
pnpm exec wcartographer Route29
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
