#!/usr/bin/env node

import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { execute, defineArgument, defineCommand, defineOption, terminal } from "cmdore";

import { projectName } from "@pokemonhns/devtooling-core";

import { discoverExteriorMaps, renderMap } from "./renderer.js";

function findRepositoryRoot(start: string): string {
  let current = resolve(start);
  while (true) {
    if (
      existsSync(resolve(current, "data/maps")) &&
      existsSync(resolve(current, "data/layouts/layouts.json"))
    ) {
      return current;
    }
    const parent = dirname(current);
    if (parent === current) {
      throw new Error("cannot find a Pokemon HnS source tree; pass --repo <path>");
    }
    current = parent;
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
  run: ({ maps, "all-exteriors": allExteriors, output, repo }) => {
    if (allExteriors && maps.length > 0) {
      throw new Error("pass map names or --all-exteriors, not both");
    }
    if (!allExteriors && maps.length === 0) {
      throw new Error("provide at least one map name or use --all-exteriors");
    }

    const root = repo ? resolve(repo) : findRepositoryRoot(process.cwd());
    const targets = allExteriors ? discoverExteriorMaps(root) : [...new Set(maps)];
    const outputDirectory = resolve(root, output);
    for (const mapName of targets) {
      const dimensions = renderMap(root, mapName, resolve(outputDirectory, `${mapName}.png`));
      terminal.log(`${mapName}: ${dimensions.width}x${dimensions.height} metatiles`);
    }
    terminal.log(`rendered ${targets.length} map(s) to ${outputDirectory}`);
  },
});

await execute(renderCommand, {
  metadata: {
    name: "hns-map-render",
    version: "0.0.0",
    description: `Render ${projectName} exterior map terrain`,
  },
});
