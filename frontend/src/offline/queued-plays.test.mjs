import assert from "node:assert/strict"
import { after, before, test } from "node:test"
import { createServer } from "vite"

let server
let mapping

before(async () => {
  server = await createServer({ server: { middlewareMode: true }, appType: "custom", logLevel: "silent" })
  mapping = await server.ssrLoadModule("/src/offline/queued-plays.ts")
})
after(() => server.close())

const payload = (clientId, overrides = {}) => ({
  client_id: clientId, bgg_id: 100, played_at: "2026-11-22T12:00:00.000Z", duration_minutes: 30, location: "Home",
  participants: [{ name: "Ana", score: 10, is_winner: true }, { name: "Ben", score: 5, is_winner: false }],
  outcome_type: "competitive", coop_result: null, scoresheet_id: 4, scoresheet_version: 2, result_override: false,
  ...overrides,
})
const item = (clientId, overrides = {}, status = "pending", error = null) => ({
  clientId, seq: 1, createdAt: "2026-11-22T12:00:00.000Z", payload: payload(clientId, overrides), status, attempts: 0, nextAttemptAt: 0, error,
})
const history = (plays = [], count = plays.length) => ({
  bgg_id: 100, play_count: count, last_played_at: plays[0]?.played_at ?? null, average_players: 2, average_duration_minutes: 30, recent_plays: plays,
})

test("a queued play maps to a pending play with a negative id, its client_id and its results", () => {
  const play = mapping.queuedGamePlay(item("11111111-1111-4111-8111-111111111111"))
  assert.equal(play.pending, true)
  assert.equal(play.client_id, "11111111-1111-4111-8111-111111111111")
  assert.ok(play.id < 0)
  assert.equal(play.player_count, 2)
  assert.deepEqual(play.participants.map((p) => [p.name, p.outcome]), [["Ana", "win"], ["Ben", "unknown"]])
  assert.equal(new Set(play.participants.map((p) => p.id)).size, 2)
  assert.equal(play.scoresheet_id, 4)
  assert.equal(play.sync_error, null)
})

test("a failed play carries the server's reason", () => {
  const play = mapping.queuedGamePlay(item("22222222-2222-4222-8222-222222222222", {}, "failed", "The same player can't be added twice."))
  assert.equal(play.sync_error, "The same player can't be added twice.")
})

test("history shows queued plays first, counts them, and ignores other games", () => {
  const server = { id: 9, played_at: "2026-11-20T12:00:00.000Z", participants: [] }
  const merged = mapping.historyWithQueued(
    history([server], 3),
    [item("33333333-3333-4333-8333-333333333333"), item("44444444-4444-4444-8444-444444444444", { bgg_id: 200 })],
    100,
  )
  assert.equal(merged.play_count, 4)
  assert.deepEqual(merged.recent_plays.map((play) => play.pending === true), [true, false])
  assert.equal(merged.last_played_at, "2026-11-22T12:00:00.000Z")
})

test("with nothing queued for the game the server's history is returned as it was", () => {
  const original = history([], 0)
  assert.equal(mapping.historyWithQueued(original, [item("55555555-5555-4555-8555-555555555555", { bgg_id: 200 })], 100), original)
  assert.equal(mapping.historyWithQueued(null, [], 100), null)
})

test("a game whose history could not be loaded still shows its queued plays", () => {
  const merged = mapping.historyWithQueued(null, [item("66666666-6666-4666-8666-666666666666")], 100)
  assert.equal(merged.play_count, 1)
  assert.equal(merged.recent_plays.length, 1)
})
