import assert from "node:assert/strict"
import test from "node:test"

import {
  feedGames, feedPlayers, filterFeed, groupFeedByMonth, NO_FILTERS, sortFeed, winnersLabel,
} from "./plays-feed.ts"

const game = (bgg_id, name) => ({ bgg_id, name })
const play = (id, played_at, names = [], extra = {}) => ({
  id, played_at, player_count: names.length, duration_minutes: null, outcome_type: "competitive",
  coop_result: null, participants: names.map(name => ({ id: 1, name, outcome: "none" })), ...extra,
})
const entries = [
  { game: game(1, "Alpha"), play: play(1, "2026-11-01T12:00:00Z", ["Ann", "Bob"]) },
  { game: game(2, "Beta"), play: play(2, "2026-11-15T12:00:00Z", ["Ann"]) },
  { game: game(1, "Alpha"), play: play(3, "2026-03-02T12:00:00Z", ["Cleo"]) },
]
const now = new Date("2026-11-17T12:00:00Z")

test("sorts newest first and filters by game, player and date", () => {
  assert.deepEqual(sortFeed(entries).map(e => e.play.id), [2, 1, 3])
  assert.deepEqual(filterFeed(entries, { ...NO_FILTERS, bggId: 1 }, now).map(e => e.play.id), [1, 3])
  assert.deepEqual(filterFeed(entries, { ...NO_FILTERS, player: "Ann" }, now).map(e => e.play.id), [1, 2])
  assert.deepEqual(filterFeed(entries, { ...NO_FILTERS, range: "30d" }, now).map(e => e.play.id), [1, 2])
  assert.deepEqual(filterFeed(entries, { ...NO_FILTERS, range: "year" }, now).map(e => e.play.id), [1, 2, 3])
  assert.deepEqual(filterFeed(entries, { bggId: 1, player: "Ann", range: "30d" }, now).map(e => e.play.id), [1])
})

test("lists distinct players and games alphabetically and groups by month", () => {
  assert.deepEqual(feedPlayers(entries), ["Ann", "Bob", "Cleo"])
  assert.deepEqual(feedGames(entries).map(g => g.name), ["Alpha", "Beta"])
  const groups = groupFeedByMonth(sortFeed(entries), "en-GB")
  assert.deepEqual(groups.map(g => g.key), ["2026-11", "2026-03"])
  assert.equal(groups[0].entries.length, 2)
})

test("winner labels cover competitive, co-op and unscored plays", () => {
  assert.equal(winnersLabel(play(1, "2026-01-01", ["Ann"], { participants: [{ id: 1, name: "Ann", outcome: "win" }] })), "Won by Ann")
  assert.equal(winnersLabel(play(2, "2026-01-01", [], { outcome_type: "cooperative", coop_result: "won" })), "Won together")
  assert.equal(winnersLabel(play(3, "2026-01-01", ["Ann"])), null)
})
