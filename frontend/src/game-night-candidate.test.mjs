import assert from "node:assert/strict"
import { after, before, test } from "node:test"
import { createServer } from "vite"

let server
let candidateFacts
let complexityLabel

before(async () => {
  server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: "custom" })
  ;({ candidateFacts, complexityLabel } = await server.ssrLoadModule("/src/game-night-candidate.ts"))
})
after(async () => { await server?.close() })

test("facts line joins players, time and weight", () => {
  assert.equal(
    candidateFacts({ min_players: 2, max_players: 4, min_play_time: 30, max_play_time: 45, complexity: 2.5 }),
    "2\u20134 players \u00b7 30\u201345 min \u00b7 Medium",
  )
})

test("single values collapse and a lone player is singular", () => {
  assert.equal(
    candidateFacts({ min_players: 1, max_players: 1, min_play_time: 20, max_play_time: 20, complexity: 1.2 }),
    "1 player \u00b7 20 min \u00b7 Light",
  )
})

test("missing facts are skipped and old sessions give an empty line", () => {
  assert.equal(candidateFacts({ min_players: 2, max_players: 2 }), "2 players")
  assert.equal(candidateFacts({}), "")
  assert.equal(candidateFacts({ min_players: null, max_play_time: null, complexity: 0 }), "")
})

test("complexity bands match the Picker", () => {
  assert.equal(complexityLabel(2.0), "Light")
  assert.equal(complexityLabel(2.01), "Medium")
  assert.equal(complexityLabel(3.0), "Medium")
  assert.equal(complexityLabel(3.01), "Heavy")
})
