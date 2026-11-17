import assert from "node:assert/strict"
import { after, before, test } from "node:test"
import { createServer } from "vite"

let server
let lib

before(async () => {
  server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: "custom" })
  lib = await server.ssrLoadModule("/src/year-recap.ts")
})
after(async () => { await server.close() })

const base = {
  year: 2026, total_plays: 40, unique_games: 12, total_duration_minutes: 905, duration_plays: 30,
  top_games: [{ bgg_id: 1, name: "Clockwork Market", play_count: 9 }],
  new_games_count: 3, new_games: [{ bgg_id: 2, name: "Lantern Grove", play_count: 2 }],
  plays_by_month: [1, 2, 3, 4, 5, 6, 7, 8, 9, 0, 0, 0], busiest_month: 9,
  plays_by_weekday: [0, 0, 0, 0, 0, 7, 1], busiest_weekday: 6,
  longest_play: { bgg_id: 1, name: "Clockwork Market", duration_minutes: 195, played_on: "2026-03-14" },
  co_players: [{ name: "Ann", play_count: 12 }],
}

test("a full year gets the whole story and an empty year gets none", () => {
  assert.deepEqual(lib.yearSlideKinds(base), [
    "totals", "top-games", "new-games", "months", "weekday", "longest", "co-players", "closing",
  ])
  assert.deepEqual(lib.yearSlideKinds({ ...base, total_plays: 0 }), [])
})

test("optional slides are skipped and short years get a short story", () => {
  const kinds = lib.yearSlideKinds({ ...base, new_games_count: 0, longest_play: null, co_players: [] })
  assert.deepEqual(kinds, ["totals", "top-games", "months", "weekday", "closing"])
  assert.deepEqual(lib.yearSlideKinds({ ...base, total_plays: 2 }), ["totals", "top-games", "closing"])
})

test("every slide has a spoken summary and missing play time is not zero", () => {
  for (const kind of lib.yearSlideKinds(base)) {
    assert.ok(lib.slideSummary(kind, base).length > 10, kind)
    assert.ok(lib.slideTitle(kind, base))
  }
  const untimed = { ...base, total_duration_minutes: null, duration_plays: 0 }
  assert.match(lib.slideSummary("totals", untimed), /Play time wasn't recorded/)
  assert.doesNotMatch(lib.slideSummary("totals", untimed), /0h|0m/)
})

test("alt text leaves player names out unless asked", () => {
  assert.doesNotMatch(lib.yearRecapAltText(base, false), /Ann/)
  assert.match(lib.yearRecapAltText(base, true), /Ann/)
})

test("the Pick banner window runs 1 December to 31 January in the user's timezone", () => {
  const at = iso => lib.yearRecapBannerYear(new Date(iso), "Europe/London")
  assert.equal(at("2026-11-30T23:59:00Z"), null)
  assert.equal(at("2026-12-01T00:00:00Z"), 2026)
  assert.equal(at("2026-12-31T23:59:00Z"), 2026)
  assert.equal(at("2027-01-31T12:00:00Z"), 2026)
  assert.equal(at("2027-02-01T00:00:00Z"), null)
  // 23:30 UTC on 30 Nov is already 1 Dec in Auckland.
  assert.equal(lib.yearRecapBannerYear(new Date("2026-11-30T23:30:00Z"), "Pacific/Auckland"), 2026)
  assert.equal(lib.yearRecapYear(new Date("2027-01-10T12:00:00Z"), "Europe/London"), 2026)
  assert.equal(lib.yearRecapYear(new Date("2026-06-10T12:00:00Z"), "Europe/London"), 2026)
})
