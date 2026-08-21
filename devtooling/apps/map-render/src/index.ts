#!/usr/bin/env node

import * as fs from "node:fs"
import * as path from "node:path"
import { execute, defineArgument, defineCommand, defineOption, terminal } from "cmdore"

import { projectName } from "@pokemonhns/devtooling-core"

import { renderCatalog } from "./catalog.js"
import { discoverExteriorMaps, renderMap } from "./renderer.js"

const findRepositoryRoot = (start: string): string => {
  let current = path.resolve(start)
  while (true) {
    if (
      fs.existsSync(path.resolve(current, "data/maps")) &&
      fs.existsSync(path.resolve(current, "data/layouts/layouts.json"))
    ) {
      return current
    }
    const parent = path.dirname(current)
    if (parent === current) {
      throw new Error("cannot find a Pokemon HnS source tree; pass --repo <path>")
    }
    current = parent
  }
}

const renderCommand = defineCommand({
  name: "render",
  description: "Render static terrain PNGs from Pokemon HnS map sources",
  arguments: [
    defineArgument({
      name: "maps",
      description: "Map directory names under data/maps",
      variadic: true,
    }),
  ],
  options: [
    defineOption({
      name: "all-exteriors",
      description: "Render every town, city, route, ocean route, and underwater map",
      arity: 0,
    }),
    defineOption({
      name: "catalog",
      description: "Render every exterior map plus an atlas-ready catalog.json",
      arity: 0,
    }),
    defineOption({
      name: "output",
      description: "Directory for rendered PNG files, relative to the source root",
      hint: "path",
      arity: 1,
      defaultValue: () => "build/map-renders",
    }),
    defineOption({
      name: "repo",
      description: "Pokemon HnS source tree; defaults to the nearest ancestor",
      hint: "path",
      arity: 1,
    }),
  ],
  run: ({ maps, "all-exteriors": allExteriors, catalog, output, repo }) => {
    if (catalog && (allExteriors || maps.length > 0)) {
      throw new Error("--catalog cannot be combined with map names or --all-exteriors")
    }
    if (allExteriors && maps.length > 0) {
      throw new Error("pass map names or --all-exteriors, not both")
    }
    if (!catalog && !allExteriors && maps.length === 0) {
      throw new Error("provide at least one map name, use --all-exteriors, or use --catalog")
    }

    const root = repo ? path.resolve(repo) : findRepositoryRoot(process.cwd())
    if (catalog) {
      const outputDirectory = path.resolve(
        root,
        output === "build/map-renders" ? "build/map-atlas/map-catalog" : output,
      )
      const result = renderCatalog(root, outputDirectory)
      terminal.log(`rendered catalog for ${result.mapCount} map(s) to ${result.output}`)
      return
    }
    const targets = allExteriors ? discoverExteriorMaps(root) : [...new Set(maps)]
    const outputDirectory = path.resolve(root, output)
    for (const mapName of targets) {
      const dimensions = renderMap(root, mapName, path.resolve(outputDirectory, `${mapName}.png`))
      terminal.log(`${mapName}: ${dimensions.width}x${dimensions.height} metatiles`)
    }
    terminal.log(`rendered ${targets.length} map(s) to ${outputDirectory}`)
  },
})

await execute(renderCommand, {
  metadata: {
    name: "hns-map-render",
    version: "0.0.0",
    description: `Render ${projectName} exterior map terrain`,
  },
})
