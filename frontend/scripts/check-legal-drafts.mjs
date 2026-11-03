import fs from "node:fs"
import path from "node:path"


const marker = "DRAFT — NOT LEGALLY APPROVED"
const enabled = process.env.VITE_LEGAL_DRAFTS_ENABLED === "true"
const root = path.resolve("dist")

function filesUnder(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const resolved = path.join(directory, entry.name)
    return entry.isDirectory() ? filesUnder(resolved) : [resolved]
  })
}

const output = filesUnder(root)
  .filter(file => /\.(?:html|js)$/.test(file))
  .map(file => fs.readFileSync(file, "utf8"))
  .join("\n")

if (!output.includes("Welcome back")) {
  throw new Error("Build output is missing the ShelfPick application; verify VITE_API_BASE_URL.")
}

if (enabled && !output.includes(marker)) {
  throw new Error("Legal drafts were enabled but the review marker is absent from the build.")
}

if (!enabled && output.includes(marker)) {
  throw new Error("Fail-closed build contains unapproved legal draft content.")
}

console.log(`Legal draft build gate passed (enabled=${enabled}).`)
