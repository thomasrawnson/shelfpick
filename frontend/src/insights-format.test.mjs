import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { after, before, test } from "node:test"
import { createServer } from "vite"

let server
let durationCoverageCopy
let formatRecordedHours
let winRateCopy
let playerWinRateCopy

before(async () => {
  server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: "custom" })
  const helpers = await server.ssrLoadModule("/src/insights-format.ts")
  durationCoverageCopy = helpers.durationCoverageCopy
  formatRecordedHours = helpers.formatRecordedHours
  winRateCopy = helpers.winRateCopy
  playerWinRateCopy = helpers.playerWinRateCopy
})

after(async () => { await server?.close() })

test("recorded hours preserve missing, genuine zero and larger totals", () => {
  assert.equal(formatRecordedHours(null), "—")
  assert.equal(formatRecordedHours(0), "0.0")
  assert.equal(formatRecordedHours(90), "1.5")
  assert.equal(formatRecordedHours(720), "12")
})

test("duration coverage distinguishes absent, partial and complete recording", () => {
  assert.equal(durationCoverageCopy(3, 0), "Play time not recorded")
  assert.equal(durationCoverageCopy(839, 612), "Timed on 612 of 839 plays")
  assert.equal(durationCoverageCopy(3, 3), null)
  assert.equal(durationCoverageCopy(0, 0), null)
})

test("win rate has an unavailable state when no outcome is determinable", () => {
  assert.equal(winRateCopy(null), "—")
  assert.equal(winRateCopy(0), "0%")
  assert.equal(winRateCopy(66.7), "66.7%")
})

test("Stats player win rate is wins over plays taken part in, with a dash for no plays", () => {
  assert.equal(playerWinRateCopy(301, 802), "38%")
  assert.equal(playerWinRateCopy(0, 140), "0%")
  assert.equal(playerWinRateCopy(2, 3), "67%")
  assert.equal(playerWinRateCopy(0, 0), "—")
})

test("Insights uses historical scope, accurate labels and recoverable states", async () => {
  const insights = await readFile(new URL("./components/InsightsView.tsx", import.meta.url), "utf8")
  const player = await readFile(new URL("./components/players/PlayerProfile.tsx", import.meta.url), "utf8")

  assert.match(insights, /historical_played_games_count/)
  assert.match(insights, /Owned games played/)
  assert.match(insights, /Games in history/)
  assert.match(insights, /Favourite game/)
  assert.doesNotMatch(insights, /Most played together|marked winner|>Insights</)
  assert.match(insights, /<h1>Stats<\/h1>/)
  assert.match(insights, /scope="col">Win rate</)
  assert.match(insights, /Play time not recorded|durationCoverageCopy/)
  assert.match(insights, />\s*Retry\s*</)
  assert.doesNotMatch(insights, /Players’ favourites/)

  assert.match(player, /No decided outcomes/)
  assert.match(player, /Outcome not recorded/)
  assert.match(player, /outcomeLabels/)
  assert.doesNotMatch(player, /\{stats\.win_rate\}%/)
})
