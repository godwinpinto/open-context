import { defineConfig } from "vite"
import { tanstackStart } from "@tanstack/react-start/plugin/vite"
import viteReact from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"
import { cloudflare } from "@cloudflare/vite-plugin"

// This module is mounted at /trail on the shared hostname — the edge
// routes openctx.encatch.dev/trail* to this worker and everything else
// to admin. `base` makes every asset URL live under /trail/ so those
// requests reach THIS worker (see scripts/nest-client-assets.mjs for
// the matching output layout), and the router basepath in src/router.tsx
// handles route matching.
const config = defineConfig({
  base: "/trail/",
  resolve: { tsconfigPaths: true },
  plugins: [
    tailwindcss(),
    cloudflare({ viteEnvironment: { name: "ssr" } }),
    tanstackStart(),
    viteReact(),
  ],
})

export default config
