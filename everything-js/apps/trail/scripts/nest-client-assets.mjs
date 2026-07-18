// Vite's `base: "/trail/"` rewrites asset URLs to /trail/assets/* but
// still emits files at dist/client/assets/*. Cloudflare's asset serving
// matches request paths against file paths verbatim, so nest the build
// output under trail/ to line the two up. `.assetsignore` must stay at
// the asset-directory root, everything else moves.
import { readdirSync, renameSync, mkdirSync } from "node:fs"
import { join } from "node:path"

const clientDir = new URL("../dist/client", import.meta.url).pathname
const nested = join(clientDir, "trail")

mkdirSync(nested, { recursive: true })
for (const entry of readdirSync(clientDir)) {
  if (entry === "trail" || entry === ".assetsignore") continue
  renameSync(join(clientDir, entry), join(nested, entry))
}
console.log("Nested client assets under dist/client/trail/")
