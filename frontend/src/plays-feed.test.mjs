import assert from "node:assert/strict"
import test from "node:test"

import {
  feedGames, feedPlayers, filterFeed, groupFeedByMonth, NO_FILTERS, playRowMeta, sortFeed, winnersLabel,
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

test("a Plays row always states the result: a winner, a co-op result or No result logged", () => {
  const won = play(1, "2026-01-01", ["Ann"], { duration_minutes: 40, participants: [{ id: 1, name: "Ann", outcome: "win" }] })
  assert.equal(playRowMeta(won, "Nov 16"), "Nov 16 · 1 player · 40 min · Won by Ann")
  // No duration and no winner: the time is left out, the missing result is named.
  assert.equal(playRowMeta(play(2, "2026-01-01", ["Ann", "Bob"]), "Nov 13"), "Nov 13 · 2 players · No result logged")
  assert.equal(playRowMeta(play(3, "2026-01-01", [], { outcome_type: "cooperative", coop_result: "lost", player_count: 3 }), "Nov 9"), "Nov 9 · 3 players · Lost together")
  assert.equal(playRowMeta(play(4, "2026-01-01", [], { outcome_type: "cooperative", coop_result: null, player_count: 3 }), "Nov 9"), "Nov 9 · 3 players · No result logged")
})

test("SP-UI-02 counting rule: every play counts, off-shelf plays keep their game summary", async () => {
  const { feedEntries } = await import("./plays-feed.ts")
  const shelf = [{ bgg_id: 1, name: "Alpha" }]
  const plays = [
    { ...play(1, "2026-11-01T12:00:00Z", ["Ann"]), bgg_id: 1, game: { bgg_id: 1, name: "Alpha", thumbnail_url: null, image_url: null, is_expansion: false, on_shelf: true } },
    { ...play(2, "2026-11-02T12:00:00Z", ["Ann"]), bgg_id: 9, game: { bgg_id: 9, name: "Sold Game", thumbnail_url: "t.png", image_url: null, is_expansion: false, on_shelf: false } },
    { ...play(3, "2026-11-03T12:00:00Z", ["Bob"]), bgg_id: 7, game: { bgg_id: 7, name: "An Expansion", thumbnail_url: null, image_url: null, is_expansion: true, on_shelf: true } },
  ]
  const feed = feedEntries(shelf, plays)
  // The Plays count equals the /plays total (and Stats' total plays).
  assert.equal(feed.length, plays.length)
  assert.deepEqual(feed.map(entry => [entry.game.name, entry.onShelf]), [
    ["An Expansion", false], ["Sold Game", false], ["Alpha", true],
  ])
  assert.equal(feed[1].game.thumbnail_url, "t.png")
})
