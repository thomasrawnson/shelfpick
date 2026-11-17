import assert from "node:assert/strict"
import { after, before, test } from "node:test"
import { createServer } from "vite"

let server
let results

before(async () => {
  server = await createServer({ server: { middlewareMode: true }, appType: "custom" })
  results = await server.ssrLoadModule("/src/play-results.ts")
})

after(async () => { await server?.close() })

const draft = (name, extra = {}) => ({ ...results.emptyDraft(name), ...extra })

test("co-op needs a result and sends no winners", () => {
  const players = [draft("Alex"), draft("Sam")]
  assert.equal(results.buildResult("cooperative", players, "", "").ok, false)
  const built = results.buildResult("cooperative", players, "won", "")
  assert.equal(built.ok, true)
  assert.deepEqual(built.result, { outcome_type: "cooperative", coop_result: "won" })
  assert.ok(built.participants.every((participant) => participant.is_winner === false))
})

test("team play marks every member of the winning team", () => {
  const players = [
    draft("A", { team: "Red" }),
    draft("B", { team: "red" }),
    draft("C", { team: "Blue" }),
  ]
  const built = results.buildResult("team", players, "", "Red")
  assert.deepEqual(built.participants.map((participant) => participant.is_winner), [true, true, false])
  assert.equal(results.buildResult("team", [draft("A", { team: "Red" }), draft("B", { team: "Red" })], "", "").ok, false)
  assert.equal(results.buildResult("team", [draft("A", { team: "Red" }), draft("B")], "", "").ok, false)
})

test("places derive winners and must be complete", () => {
  const built = results.buildResult(
    "competitive",
    [draft("A", { rank: "1" }), draft("B", { rank: "1" }), draft("C", { rank: "3" })],
    "",
    "",
  )
  assert.deepEqual(built.participants.map((participant) => participant.is_winner), [true, true, false])
  assert.equal(results.buildResult("competitive", [draft("A", { rank: "1" }), draft("B")], "", "").ok, false)
  assert.equal(results.buildResult("competitive", [draft("A", { rank: "0" }), draft("B", { rank: "1" })], "", "").ok, false)
})

test("unranked competitive plays keep the winner checkbox", () => {
  const built = results.buildResult("competitive", [draft("A", { isWinner: true }), draft("B")], "", "")
  assert.deepEqual(built.participants.map((participant) => participant.is_winner), [true, false])
})

test("rematch keeps players, teams, type and location but no results", () => {
  const prefill = results.rematchPrefill({
    id: 1,
    outcome_type: "team",
    coop_result: null,
    location: "Cafe",
    participants: [
      { id: 1, name: "A", team: "Red", score: 3, is_winner: true, outcome: "win" },
      { id: 2, name: "B", team: "Blue", score: 1, is_winner: false, outcome: "loss" },
    ],
  })
  assert.deepEqual(prefill, {
    outcomeType: "team",
    location: "Cafe",
    names: ["A", "B"],
    teams: ["Red", "Blue"],
  })
})
