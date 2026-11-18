import type { CollectionGameStats, Game } from "./api/client"

// Owned games ordered by most recent play, newest first; unplayed games are left out.
export function recentlyPlayedGames(
  games: Game[],
  stats: CollectionGameStats[],
  limit = 8,
): Game[] {
  const lastPlayed = new Map<number, number>()
  for (const item of stats) {
    const time = item.last_played_at ? Date.parse(item.last_played_at) : NaN
    if (Number.isFinite(time)) lastPlayed.set(item.bgg_id, time)
  }
  return games
    .filter(game => lastPlayed.has(game.bgg_id))
    .sort((a, b) =>
      (lastPlayed.get(b.bgg_id) ?? 0) - (lastPlayed.get(a.bgg_id) ?? 0)
      || a.name.localeCompare(b.name))
    .slice(0, limit)
}
