import { useCallback, useEffect, useMemo, useState } from "react"

import {
  getCollectionStats,
  getGameHistory,
  getGames,
  type Game,
  type GamePlay,
} from "../api/client"
import {
  feedGames,
  feedPlayers,
  filterFeed,
  groupFeedByMonth,
  mapLimited,
  NO_FILTERS,
  playSummary,
  sortFeed,
  winnersLabel,
  type DateRange,
  type FeedEntry,
  type FeedFilters,
} from "../plays-feed"
import { rematchPrefill, type PlayPrefill } from "../play-results"
import PlayLogForm from "./collection/PlayLogForm"
import ResilientGameArtwork from "./ResilientGameArtwork"
import Skeleton from "./ui/Skeleton"

type Props = {
  onOpenGame: (bggId: number) => void
}

type Screen =
  | { kind: "list" }
  | { kind: "choose" }
  | { kind: "log"; game: Game; prefill: PlayPrefill | null; key: number }
  | { kind: "edit"; entry: FeedEntry }

const RANGES: Array<{ value: DateRange; label: string }> = [
  { value: "all", label: "All time" },
  { value: "30d", label: "30 days" },
  { value: "year", label: "This year" },
]

// Every game's most recent plays in one place. The data comes from each played
// game's history (its latest plays), so very busy games show their newest only.
async function loadFeed(): Promise<{ games: Game[]; entries: FeedEntry[] }> {
  const [games, stats] = await Promise.all([getGames(), getCollectionStats()])
  const owned = games.filter(game => game.owned)
  const played = new Set(stats.filter(item => item.play_count > 0).map(item => item.bgg_id))
  const histories = await mapLimited(
    owned.filter(game => played.has(game.bgg_id)),
    6,
    async game => ({ game, history: await getGameHistory(game.bgg_id) }),
  )
  return {
    games: owned,
    entries: sortFeed(histories.flatMap(({ game, history }) =>
      history.recent_plays.map((play: GamePlay) => ({ game, play })))),
  }
}

function PlaysView({ onOpenGame }: Props) {
  const [screen, setScreen] = useState<Screen>({ kind: "list" })
  const [games, setGames] = useState<Game[]>([])
  const [entries, setEntries] = useState<FeedEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [filters, setFilters] = useState<FeedFilters>(NO_FILTERS)
  const [search, setSearch] = useState("")

  const refresh = useCallback(async () => {
    try {
      const feed = await loadFeed()
      setGames(feed.games)
      setEntries(feed.entries)
      setError("")
    } catch {
      setError("Couldn't load your plays.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void refresh() }, [refresh])

  const visible = useMemo(() => filterFeed(entries, filters), [entries, filters])
  const groups = useMemo(() => groupFeedByMonth(visible), [visible])
  const filtered = filters.bggId !== null || filters.player !== null || filters.range !== "all"

  async function afterSave() {
    setScreen({ kind: "list" })
    setLoading(true)
    await refresh()
  }

  if (screen.kind === "choose") {
    const matches = games.filter(game => game.name.toLowerCase().includes(search.trim().toLowerCase()))
    return (
      <section className="screen plays-screen">
        <button type="button" className="collection-back" onClick={() => setScreen({ kind: "list" })}>← Back to Plays</button>
        <header><h1>Log a play</h1><p className="subtitle">Which game did you play?</p></header>
        <input
          className="plays-search"
          type="search"
          value={search}
          placeholder="Search your shelf…"
          aria-label="Search your shelf"
          onChange={event => setSearch(event.target.value)}
        />
        <ul className="plays-game-picker">
          {matches.map(game => (
            <li key={game.bgg_id}>
              <button type="button" onClick={() => setScreen({ kind: "log", game, prefill: null, key: Date.now() })}>
                <span className="plays-cover"><ResilientGameArtwork src={game.thumbnail_url ?? game.image_url} alt="" gameName={game.name} /></span>
                <strong>{game.name}</strong>
              </button>
            </li>
          ))}
          {matches.length === 0 && <li className="plays-empty-note">No games match.</li>}
        </ul>
      </section>
    )
  }

  if (screen.kind === "log") {
    const { game, prefill } = screen
    return (
      <section className="screen plays-screen picker-play-entry">
        <button type="button" className="collection-back" onClick={() => setScreen({ kind: "list" })}>← Back to Plays</button>
        <header><h1>{prefill ? "Rematch" : "Log a play"}</h1><p className="subtitle">{game.name}</p></header>
        <PlayLogForm
          key={screen.key}
          game={game}
          presentation="dedicated"
          initialOpen
          initialPlayerCount={prefill?.names.length}
          initialPlayerNames={prefill?.names}
          initialTeams={prefill?.teams}
          initialOutcomeType={prefill?.outcomeType}
          initialLocation={prefill?.location}
          onCancel={() => setScreen({ kind: "list" })}
          onSaved={async () => { /* Stay on the saved confirmation until Done. */ }}
          onDone={() => void afterSave()}
        />
      </section>
    )
  }

  if (screen.kind === "edit") {
    const { entry } = screen
    return (
      <section className="screen plays-screen picker-play-entry">
        <button type="button" className="collection-back" onClick={() => setScreen({ kind: "list" })}>← Back to Plays</button>
        <header><h1>Edit play</h1><p className="subtitle">{entry.game.name}</p></header>
        <PlayLogForm
          game={entry.game}
          editingPlay={entry.play}
          presentation="dedicated"
          onCancel={() => setScreen({ kind: "list" })}
          onSaved={afterSave}
        />
      </section>
    )
  }

  return (
    <section className="screen plays-screen">
      <header>
        <h1>Plays</h1>
        {!loading && entries.length > 0 && <p className="subtitle">{entries.length} recent {entries.length === 1 ? "play" : "plays"}</p>}
      </header>

      <button type="button" className="primary-button plays-log-button" onClick={() => { setSearch(""); setScreen({ kind: "choose" }) }}>
        Log play
      </button>

      {loading && <Skeleton rows={4} label="Loading your plays" />}

      {!loading && error && (
        <div className="plays-state" role="alert">
          <p>{error}</p>
          <button type="button" className="secondary-button" onClick={() => { setLoading(true); void refresh() }}>Retry</button>
        </div>
      )}

      {!loading && !error && entries.length === 0 && (
        <div className="plays-state">
          <strong>No plays yet</strong>
          <p>Record your first play and it will show up here, ready for a rematch.</p>
        </div>
      )}

      {!loading && !error && entries.length > 0 && (
        <>
          <div className="plays-filters" role="group" aria-label="Filter plays">
            <select
              aria-label="Game"
              value={filters.bggId ?? ""}
              onChange={event => setFilters(current => ({ ...current, bggId: event.target.value ? Number(event.target.value) : null }))}
            >
              <option value="">All games</option>
              {feedGames(entries).map(game => <option key={game.bgg_id} value={game.bgg_id}>{game.name}</option>)}
            </select>
            <select
              aria-label="Player"
              value={filters.player ?? ""}
              onChange={event => setFilters(current => ({ ...current, player: event.target.value || null }))}
            >
              <option value="">All players</option>
              {feedPlayers(entries).map(name => <option key={name} value={name}>{name}</option>)}
            </select>
          </div>
          <div className="plays-range" role="group" aria-label="Date range">
            {RANGES.map(range => (
              <button
                type="button"
                key={range.value}
                className={filters.range === range.value ? "active" : ""}
                aria-pressed={filters.range === range.value}
                onClick={() => setFilters(current => ({ ...current, range: range.value }))}
              >{range.label}</button>
            ))}
          </div>

          {visible.length === 0 && (
            <div className="plays-state">
              <strong>No plays match</strong>
              <button type="button" className="secondary-button" onClick={() => setFilters(NO_FILTERS)}>Clear filters</button>
            </div>
          )}

          {groups.map(group => (
            <section key={group.key} className="plays-month" aria-label={group.label}>
              <h2>{group.label}</h2>
              <ul>
                {group.entries.map(entry => {
                  const { game, play } = entry
                  const date = new Date(play.played_at).toLocaleDateString(undefined, { day: "numeric", month: "short" })
                  const result = winnersLabel(play)
                  return (
                    <li key={play.id} className="plays-card">
                      <button type="button" className="plays-card-main" onClick={() => onOpenGame(game.bgg_id)} aria-label={`${game.name}, ${date}. Open game`}>
                        <span className="plays-cover"><ResilientGameArtwork src={game.thumbnail_url ?? game.image_url} alt="" gameName={game.name} /></span>
                        <span className="plays-card-copy">
                          <strong>{game.name}</strong>
                          <span>{date} · {playSummary(play)}</span>
                          {result && <span className="plays-result">{result}</span>}
                        </span>
                      </button>
                      <div className="plays-card-actions">
                        <button type="button" className="secondary-button" onClick={() => setScreen({ kind: "log", game, prefill: rematchPrefill(play), key: Date.now() })}>Rematch</button>
                        <button type="button" className="ghost-button" onClick={() => setScreen({ kind: "edit", entry })}>Edit</button>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </section>
          ))}
          {!filtered && entries.length > 0 && (
            <p className="plays-note">Showing the latest plays of each game.</p>
          )}
        </>
      )}
    </section>
  )
}

export default PlaysView
