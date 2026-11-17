import type { Game, GamePlay, ListedPlay } from "./api/client"

// onShelf is false for plays on games no longer on the shelf (or expansions):
// they still count and show, but cannot be edited or rematched.
export type FeedEntry = { game: Game; play: GamePlay; onShelf: boolean }
export type DateRange = "all" | "30d" | "year"
export type FeedFilters = {
  bggId: number | null
  player: string | null
  range: DateRange
}

export const NO_FILTERS: FeedFilters = { bggId: null, player: null, range: "all" }

const DAY_MS = 24 * 60 * 60 * 1000

// Newest first; ties keep a stable order by play id.
export function sortFeed(entries: FeedEntry[]): FeedEntry[] {
  return [...entries].sort((a, b) =>
    Date.parse(b.play.played_at) - Date.parse(a.play.played_at) || b.play.id - a.play.id)
}

export function filterFeed(
  entries: FeedEntry[],
  filters: FeedFilters,
  now: Date = new Date(),
): FeedEntry[] {
  const since = filters.range === "30d"
    ? now.getTime() - 30 * DAY_MS
    : filters.range === "year"
      ? new Date(now.getFullYear(), 0, 1).getTime()
      : null
  return entries.filter(({ game, play }) =>
    (filters.bggId === null || game.bgg_id === filters.bggId)
    && (filters.player === null || play.participants.some(p => p.name === filters.player))
    && (since === null || Date.parse(play.played_at) >= since))
}

export function feedPlayers(entries: FeedEntry[]): string[] {
  const names = new Set<string>()
  for (const { play } of entries) for (const p of play.participants) if (p.name.trim()) names.add(p.name)
  return [...names].sort((a, b) => a.localeCompare(b))
}

export function feedGames(entries: FeedEntry[]): Game[] {
  const seen = new Map<number, Game>()
  for (const { game } of entries) seen.set(game.bgg_id, game)
  return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name))
}

export function groupFeedByMonth(
  entries: FeedEntry[],
  locale?: string,
): Array<{ key: string; label: string; entries: FeedEntry[] }> {
  const groups = new Map<string, { key: string; label: string; entries: FeedEntry[] }>()
  for (const entry of entries) {
    const date = new Date(entry.play.played_at)
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        label: new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(date),
        entries: [],
      })
    }
    groups.get(key)!.entries.push(entry)
  }
  return [...groups.values()]
}

export function winnersLabel(play: GamePlay): string | null {
  if (play.outcome_type === "cooperative") {
    return play.coop_result === "won" ? "Won together" : play.coop_result === "lost" ? "Lost together" : null
  }
  const winners = play.participants.filter(p => p.outcome === "win" || p.outcome === "draw").map(p => p.name)
  return winners.length > 0 ? `Won by ${winners.join(", ")}` : null
}

export function playSummary(play: GamePlay): string {
  const players = `${play.player_count} ${play.player_count === 1 ? "player" : "players"}`
  const time = play.duration_minutes ? `${play.duration_minutes} min` : null
  return [players, time].filter(Boolean).join(" · ")
}

// Every play on the account, newest first (SP-UI-02 counting rule: one play
// counts once, whatever its game's current ownership). Shelf games supply
// full details; other games use the summary that came with the play.
export function feedEntries(shelf: Game[], plays: ListedPlay[]): FeedEntry[] {
  const byId = new Map(shelf.map(game => [game.bgg_id, game]))
  return sortFeed(plays.map(play => {
    const owned = byId.get(play.bgg_id)
    if (owned) return { game: owned, play, onShelf: true }
    const summary = play.game
    return {
      game: {
        bgg_id: play.bgg_id, name: summary?.name ?? "Unknown game", year_published: null,
        min_players: null, max_players: null, min_play_time: null, max_play_time: null,
        min_age: null, complexity: null, rating: null, owned: false,
        image_url: summary?.image_url ?? null, thumbnail_url: summary?.thumbnail_url ?? null,
        categories: [], mechanics: [],
      },
      play,
      onShelf: false,
    }
  }))
}
