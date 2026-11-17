import assert from "node:assert/strict"
import { after, before, test } from "node:test"
import { createServer } from "vite"

let server
let createLightHaptic
let lightImpact

before(async () => {
  server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: "custom" })
  ;({ createLightHaptic, lightImpact } = await server.ssrLoadModule("/src/haptics.ts"))
})
after(async () => { await server?.close() })

test("light haptic calls the plugin on native", async () => {
  let calls = 0
  await createLightHaptic({ isNative: () => true, impact: async () => { calls += 1 } })()
  assert.equal(calls, 1)
})

test("light haptic does nothing on web", async () => {
  let calls = 0
  await createLightHaptic({ isNative: () => false, impact: async () => { calls += 1 } })()
  assert.equal(calls, 0)
})

test("a failing plugin never throws into the interaction", async () => {
  await createLightHaptic({ isNative: () => true, impact: async () => { throw new Error("boom") } })()
})

test("the real helper is a safe no-op in a non-native environment", async () => {
  await lightImpact()
})
