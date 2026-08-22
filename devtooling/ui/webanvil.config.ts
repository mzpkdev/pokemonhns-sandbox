import * as url from "node:url"

import tailwindcss from "@tailwindcss/vite"
import { svelte } from "@sveltejs/vite-plugin-svelte"
import { defineConfig } from "webanvil"

import { codeStyle } from "../webanvil.shared.js"

export default defineConfig({
  ...codeStyle,
  build: {
    mode: "web",
    entry: "index.html",
    outDir: "dist",
  },
  plugins: [tailwindcss(), svelte()],
  vite: {
    base: "./",
    publicDir: url.fileURLToPath(new url.URL("../../build/tographer/map-catalog", import.meta.url)),
  },
  test: {
    exclude: ["e2e/**"],
  },
})
