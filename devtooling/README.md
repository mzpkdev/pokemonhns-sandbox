# HnS developer tooling

This is an isolated Node 24 workspace for tools that support the Pokemon HnS
fork. It does not participate in the ROM's Makefile build.

The workspace uses pnpm workspaces, Turborepo, WebAnvil, TypeScript 7, and Ark
UI in the Svelte workbench. WebAnvil owns builds, formatting, linting, test
commands, workbench browser tests, and declaration generation.

## Layout

```text
apps/       User-facing developer tools
```

`apps/workbench` is the map atlas. Add a shared package only when code has a
real shared consumer.

`apps/workbench` is the Svelte map atlas. It consumes the static catalog and
terrain images created by `apps/map-render`; it does not read the ROM or source
tree in the browser.

`apps/workbench/src/ui-toolkit` owns styled local UI primitives. It wraps Ark UI
for stateful controls so atlas components can stay focused on map behavior.

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
pnpm run map-render Route29
pnpm run map-atlas:catalog
pnpm run map-atlas
```

`pnpm run check` runs formatting, linting, and TypeScript checks across the
workspace. Build output, dependency installs, Turborepo cache, and WebAnvil
metadata are ignored by Git.

`pnpm run e2e` regenerates the atlas catalog, then runs the workbench's
WebAnvil browser test.

`pnpm run map-atlas:catalog` renders every exterior map, writes its catalog to
`build/map-atlas/map-catalog/`, and prepares the atlas assets. `pnpm run map-atlas`
then starts the Svelte workbench.

Build before running `pnpm run map-render`; it runs the map renderer package's
compiled `main` entry. You can also invoke its linked binary directly with
`pnpm --filter @pokemonhns/devtooling-map-render exec hns-map-render`.
