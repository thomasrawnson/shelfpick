import assert from "node:assert/strict"
import { after, before, test } from "node:test"
import { createServer } from "vite"

let server
let r
let formatPlayerCount

before(async () => {
  server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: "custom" })
  r = await server.ssrLoadModule("/src/play-results.ts")
  formatPlayerCount = (await server.ssrLoadModule("/src/player-count.ts")).formatPlayerCount
})

after(async () => { await server?.close() })

const draft = (name, score, extra = {}) => ({ ...r.emptyDraft(name), score, ...extra })
const auto = { direction: "highest", winnersOverridden: false, manualPlaces: false }

test("finishing order: highest wins, with ties sharing a place", () => {
  assert.deepEqual(r.finishingOrder(["77", "75", "77", "40"], "highest"), [1, 3, 1, 4])
  assert.deepEqual(r.finishingOrder(["10", "20", "30"], "highest"), [3, 2, 1])
})

test("finishing order: lowest wins, with ties", () => {
  assert.deepEqual(r.finishingOrder(["12", "8", "8", "20"], "lowest"), [3, 1, 1, 4])
})

test("finishing order needs a score for every player", () => {
  assert.equal(r.finishingOrder(["10", ""], "highest"), null)
  assert.equal(r.finishingOrder([], "highest"), null)
  assert.deepEqual(r.finishingOrder(["-3", "0.5"], "highest"), [2, 1])
})

test("winner auto-selection follows the scoring direction and shares ties", () => {
  assert.deepEqual(r.autoWinners(["77", "75", "77"], "highest"), [true, false, true])
  assert.deepEqual(r.autoWinners(["77", "75", "77"], "lowest"), [false, true, false])
  // Needs two scores before naming a winner.
  assert.deepEqual(r.autoWinners(["77", "", ""], "highest"), [false, false, false])
  assert.deepEqual(r.autoWinners(["77", "", "80"], "highest"), [false, false, true])
})

test("resolveCompetitive sets winners and places from scores", () => {
  const out = r.resolveCompetitive([draft("Tom", "70"), draft("Wales", "75"), draft("Sis", "60")], auto)
  assert.deepEqual(out.map((d) => [d.isWinner, d.rank]), [[false, "2"], [true, "1"], [false, "3"]])
  const built = r.buildResult("competitive", out, "", "")
  assert.equal(built.ok, true)
  assert.deepEqual(built.participants.map((p) => [p.rank, p.is_winner]), [[2, false], [1, true], [3, false]])
})

test("lowest-wins resolve with a tie", () => {
  const out = r.resolveCompetitive([draft("A", "8"), draft("B", "8"), draft("C", "9")], { ...auto, direction: "lowest" })
  assert.deepEqual(out.map((d) => [d.isWinner, d.rank]), [[true, "1"], [true, "1"], [false, "3"]])
})

test("manual winner override wins over scores and sends no places", () => {
  const drafts = [draft("Tom", "70", { isWinner: true }), draft("Wales", "75")]
  const out = r.resolveCompetitive(drafts, { ...auto, winnersOverridden: true })
  assert.deepEqual(out.map((d) => [d.isWinner, d.rank]), [[true, ""], [false, ""]])
  const built = r.buildResult("competitive", out, "", "")
  assert.deepEqual(built.participants.map((p) => [p.is_winner, p.rank]), [[true, undefined], [false, undefined]])
})

test("manual places keep the existing place rules", () => {
  const drafts = [draft("Tom", "70", { rank: "1" }), draft("Wales", "75", { rank: "2" })]
  const out = r.resolveCompetitive(drafts, { ...auto, manualPlaces: true })
  assert.deepEqual(out.map((d) => d.rank), ["1", "2"])
  assert.equal(r.buildResult("competitive", out, "", "").participants[0].is_winner, true)
})

const play = (playerCount, rows, outcome_type = "competitive") => ({
  id: Math.random(), played_at: "2026-11-01T12:00:00Z", player_count: playerCount, duration_minutes: null,
  location: null, source: "app", outcome_type, coop_result: null,
  participants: rows.map(([name, score, is_winner], id) => ({ id, name, score, is_winner, outcome: "unknown" })),
})

test("scoring direction is inferred from earlier winners", () => {
  const high = [play(2, [["A", 10, true], ["B", 5, false]])]
  const low = [play(2, [["A", 10, false], ["B", 5, true]]), play(2, [["A", 3, true], ["B", 9, false]])]
  assert.equal(r.inferScoreDirection([]), "highest")
  assert.equal(r.inferScoreDirection(high), "highest")
  assert.equal(r.inferScoreDirection(low), "lowest")
})

test("record context: player best, best at count, average and worst win; empty when no data", () => {
  const plays = [
    play(3, [["Tom", 77, true], ["Wales", 60, false], ["Sister", 47, false]]),
    play(3, [["Tom", 50, false], ["Wales", 75, true], ["Sister", 40, false]]),
    play(2, [["Tom", 90, true], ["Wales", 30, false]]),
    play(2, [["Tom", null, true], ["Wales", null, false]]),
    play(2, [["Tom", 999, false]], "cooperative"),
  ]
  const ctx = r.recordContext(plays, 3, "highest")
  assert.equal(r.playerBestFor(ctx, "tom "), 90)
  assert.equal(r.playerBestFor(ctx, "Wales"), 75)
  assert.equal(r.playerBestFor(ctx, "Nobody"), null)
  assert.equal(ctx.bestAtCount, 77)
  assert.equal(ctx.average, 58.6)
  assert.equal(ctx.worstWin, 75)
  const empty = r.recordContext([], 3, "highest")
  assert.deepEqual([empty.bestAtCount, empty.average, empty.worstWin, empty.playerBest.size], [null, null, null, 0])
})

test("player counts read Solo, N players or a range", () => {
  assert.equal(formatPlayerCount(1, 1), "Solo")
  assert.equal(formatPlayerCount(2, 2), "2 players")
  assert.equal(formatPlayerCount(2, 4), "2–4 players")
  assert.equal(formatPlayerCount(1, 4), "1–4 players")
  assert.equal(formatPlayerCount(null, 3), "3 players")
  assert.equal(formatPlayerCount(null, null), null)
})

test("Picker fit labels use the documented bands", async () => {
  const { fitLabel } = await server.ssrLoadModule("/src/picker-fit.ts")
  assert.equal(fitLabel(100), "Great fit")
  assert.equal(fitLabel(84.6), "Great fit")
  assert.equal(fitLabel(84.4), "Good fit")
  assert.equal(fitLabel(65), "Good fit")
  assert.equal(fitLabel(64), "Worth a look")
  assert.equal(fitLabel(0), "Worth a look")
})
