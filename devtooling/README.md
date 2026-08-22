# HnS developer tooling

This is an isolated Node 24 workspace for tools that support the Pokemon HnS
fork. It does not participate in the ROM's Makefile build.

The workspace uses pnpm workspaces, Turborepo, WebAnvil, TypeScript 7, and Ark
UI in the Svelte app. WebAnvil owns builds, formatting, linting, test commands,
browser tests, and declaration generation.

## Layout

```text
tools/      CLI packages
ui/         Svelte tographer
```

`tools/cartographer` is the source-driven map-render CLI. Add further CLI tools
under `tools/`. `ui` is the only browser package; add a separate UI package only
when it has a real independent consumer.

`ui` is the Svelte tographer. It consumes the static catalog and terrain images
created by `tools/cartographer`; it does not read the ROM or source
tree in the browser.

`ui/src/cartographer/ui-toolkit` owns styled local UI primitives. It wraps Ark
UI for stateful controls so tographer components can stay focused on map behavior.

## Commands

Run these from `devtooling/` after `pnpm install`:

```sh
pnpm run build
pnpm run check
pnpm run dev
pnpm run format
pnpm run lint
pnpm run test
pnpm run e2e
pnpm run cartographer Route29
pnpm run tographer:catalog
pnpm run tographer
```

`pnpm run check` runs formatting, linting, and TypeScript checks across the
workspace. Build output, dependency installs, Turborepo cache, and WebAnvil
metadata are ignored by Git.

`pnpm run e2e` regenerates the tographer catalog, then runs the UI package's WebAnvil
browser test.

`pnpm run tographer:catalog` renders every exterior map, writes its catalog to
`build/tographer/map-catalog/`, and prepares the tographer assets. `pnpm run tographer`
then starts the Svelte tographer.

Build before running `pnpm run cartographer`; it runs Cartographer's compiled
`main` entry. You can also invoke its linked binary directly with
`pnpm exec wcartographer`.
