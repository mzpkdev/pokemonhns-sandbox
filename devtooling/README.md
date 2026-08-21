# HnS developer tooling

This is an isolated Node 24 workspace for tools that support the Pokemon HnS
fork. It does not participate in the ROM's Makefile build.

The workspace uses npm workspaces, Turborepo, WebAnvil, and TypeScript 7.
WebAnvil owns formatting, linting, test commands, and workbench browser
tests. TypeScript 7 and Vite own builds because the current WebAnvil release
does not support TypeScript 7 Node builds.

## Layout

```text
apps/       User-facing developer tools
packages/   Shared tooling libraries
```

`apps/workbench` is the starter package. `packages/core` holds shared types and
utilities. Add packages only when code has a real shared consumer.

`apps/workbench` is the Svelte map atlas. It consumes the static catalog and
terrain images created by `apps/map-render`; it does not read the ROM or source
tree in the browser.

## Commands

Run these from `devtooling/` after `npm install`:

```sh
npm run build
npm run check
npm run dev
npm run format
npm run lint
npm run test
npm run e2e
npm run map-atlas:catalog
npm run map-atlas
```

`npm run check` runs formatting, linting, and TypeScript checks across the
workspace. Build output, dependency installs, Turborepo cache, and WebAnvil
metadata are ignored by Git.

`npm run e2e` regenerates the atlas catalog, then runs the workbench's
WebAnvil browser test.

`npm run map-atlas:catalog` renders every exterior map, writes its catalog to
`build/map-atlas/map-catalog/`, and prepares the atlas assets. `npm run map-atlas`
then starts the Svelte/Vite workbench.
