import assert from "node:assert/strict"
import test from "node:test"

import { recentlyPlayedGames } from "./recently-played.ts"

const game = (bgg_id, name) => ({ bgg_id, name })

test("orders by most recent play, skips unplayed and respects the limit", () => {
  const games = [game(1, "A"), game(2, "B"), game(3, "C"), game(4, "D")]
  const stats = [
    { bgg_id: 1, play_count: 2, last_played_at: "2026-11-01T10:00:00Z" },
    { bgg_id: 2, play_count: 0, last_played_at: null },
    { bgg_id: 3, play_count: 5, last_played_at: "2026-11-16T10:00:00Z" },
    { bgg_id: 4, play_count: 1, last_played_at: "not a date" },
  ]
  assert.deepEqual(recentlyPlayedGames(games, stats).map(g => g.name), ["C", "A"])
  assert.deepEqual(recentlyPlayedGames(games, stats, 1).map(g => g.name), ["C"])
  assert.deepEqual(recentlyPlayedGames([], []), [])
})
