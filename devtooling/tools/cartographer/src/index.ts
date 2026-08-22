#!/usr/bin/env node

import { execute } from "cmdore"

import renderCommand from "./commands/render"

await execute(renderCommand, {
  metadata: {
    name: "wcartographer",
    version: "0.0.0",
    description: "Render Pokemon HnS exterior map terrain",
  },
})
