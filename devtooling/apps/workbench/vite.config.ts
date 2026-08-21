import { fileURLToPath, URL } from "node:url"

import tailwindcss from "@tailwindcss/vite"
import { svelte } from "@sveltejs/vite-plugin-svelte"
import { defineConfig } from "vite"

export default defineConfig({
  base: "./",
  plugins: [tailwindcss(), svelte()],
  publicDir: fileURLToPath(new URL("../../../build/map-atlas/map-catalog", import.meta.url)),
})
