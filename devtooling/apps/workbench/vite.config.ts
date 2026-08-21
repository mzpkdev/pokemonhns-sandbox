import { fileURLToPath, URL } from "node:url";

import { svelte } from "@sveltejs/vite-plugin-svelte";
import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  plugins: [svelte()],
  publicDir: fileURLToPath(new URL("../../../build/map-atlas/map-catalog", import.meta.url)),
});
