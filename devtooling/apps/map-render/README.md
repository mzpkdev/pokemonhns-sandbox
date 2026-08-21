# HnS map renderer

`hns-map-render` renders static terrain PNGs directly from the HnS source tree.
It does not build or run the ROM.

Run commands from `devtooling/`:

```sh
npm run map-render -- Route29 NewBarkTown --output build/map-renders
npm run map-render -- --all-exteriors --output build/all-exterior-maps
```

Map names are directory names under `data/maps/`. `--all-exteriors` selects
every map whose type is town, city, route, ocean route, or underwater. The
default repository is the nearest ancestor with `data/maps/`; use `--repo` to
render another compatible source tree.

The command writes `<map-name>.png` files to the output directory. It renders
terrain only, so events, NPCs, weather, animations, and story state are absent.
