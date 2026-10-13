import assert from "node:assert/strict"
import { after, before, test } from "node:test"
import { createServer } from "vite"

let server
let resolveExportCoverArtworkPermission

before(async () => {
  server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: "custom" })
  ;({ resolveExportCoverArtworkPermission } = await server.ssrLoadModule("/src/export-artwork-policy.ts"))
})

after(async () => { await server?.close() })

test("server explicitly permits cover artwork exports", async () => {
  assert.equal(await resolveExportCoverArtworkPermission(async () => ({
    cover_artwork_enabled: true,
  })), true)
})

test("fallback-only mode remains disabled", async () => {
  assert.equal(await resolveExportCoverArtworkPermission(async () => ({
    cover_artwork_enabled: false,
  })), false)
})

test("configuration failures fail closed", async () => {
  assert.equal(await resolveExportCoverArtworkPermission(async () => {
    throw new Error("configuration unavailable")
  }), false)
  assert.equal(await resolveExportCoverArtworkPermission(async () => ({
    cover_artwork_enabled: "true",
  })), false)
})
