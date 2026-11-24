import { useCallback, useEffect, useMemo, useState } from "react"

import {
  getGames,
  getPlays,
  type Game,
} from "../api/client"
import {
  feedGames,
  feedPlayers,
  filterFeed,
  groupFeedByMonth,
  NO_FILTERS,
  playRowMeta,
  feedEntries,
  sortFeed,
  type DateRange,
  type FeedEntry,
  type FeedFilters,
} from "../plays-feed"
import { rematchPrefill, type PlayPrefill } from "../play-results"
import { useOnline } from "../offline/connectivity"
import { usePlaySync } from "../offline/play-sync-context"
import { queuedGamePlay } from "../offline/queued-plays"
import PlayLogForm from "./collection/PlayLogForm"
import PendingPlayControls from "./offline/PendingPlayControls"
import NotSavedYet from "./offline/NotSavedYet"
import SavedCopyNotice from "./offline/SavedCopyNotice"
import ResilientGameArtwork from "./ResilientGameArtwork"
import ChoiceGroup from "./ui/ChoiceGroup"
import PullIndicator from "./ui/PullIndicator"
import Skeleton from "./ui/Skeleton"
import { usePullToRefresh } from "../use-pull-to-refresh"

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

// Every play on the account, newest first, paired with its game.
async function loadFeed(): Promise<{ games: Game[]; entries: FeedEntry[] }> {
  const [games, plays] = await Promise.all([getGames(), getPlays()])
  const owned = games.filter(game => game.owned)
  return { games: owned, entries: feedEntries(owned, plays) }
}

function PlaysView({ onOpenGame }: Props) {
  const online = useOnline()
  const [screen, setScreen] = useState<Screen>({ kind: "list" })
  const [games, setGames] = useState<Game[]>([])
  const [serverEntries, setEntries] = useState<FeedEntry[]>([])
  const { items: queued, syncedVersion } = usePlaySync()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [filters, setFilters] = useState<FeedFilters>(NO_FILTERS)
  const [search, setSearch] = useState("")

  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let active = true
    void loadFeed().then(feed => {
      if (!active) return
      setGames(feed.games)
      setEntries(feed.entries)
      setError("")
    }).catch(() => {
      if (active) setError("Couldn't load your plays.")
    }).finally(() => {
      if (active) setLoading(false)
    })
    return () => { active = false }
  }, [reloadKey, syncedVersion])

  // Plays logged on this device count here straight away, labelled pending until they sync.
  const entries = useMemo(() => {
    const pending: FeedEntry[] = queued.flatMap(item => {
      const game = games.find(candidate => candidate.bgg_id === item.payload.bgg_id)
      return game ? [{ game, play: queuedGamePlay(item), onShelf: true }] : []
    })
    return pending.length === 0 ? serverEntries : sortFeed([...pending, ...serverEntries])
  }, [queued, games, serverEntries])

  // Reloads in place; the pull indicator stays up briefly so the refresh is visible.
  const refresh = useCallback(() => {
    setReloadKey(current => current + 1)
    return new Promise<void>(resolve => setTimeout(resolve, 600))
  }, [])

  const pull = usePullToRefresh(refresh, screen.kind === "list")

  const visible = useMemo(() => filterFeed(entries, filters), [entries, filters])
  const groups = useMemo(() => groupFeedByMonth(visible), [visible])

  async function afterSave() {
    setScreen({ kind: "list" })
    setLoading(true)
    setReloadKey(current => current + 1)
  }

  if (screen.kind === "choose") {
    const matches = games.filter(game => game.name.toLowerCase().includes(search.trim().toLowerCase()))
    return (
      <section className="screen tab-screen plays-screen">
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
          {matches.length === 0 && (games.length === 0 && !online
            ? <li className="plays-empty-note"><NotSavedYet what="your shelf" /></li>
            : <li className="plays-empty-note">No games match.</li>)}
        </ul>
      </section>
    )
  }

  return (
    <section className="screen tab-screen plays-screen">
      <PullIndicator {...pull} />
      {screen.kind === "log" && (
        <PlayLogForm
          key={screen.key}
          game={screen.game}
          initialPlayerNames={screen.prefill?.names}
          initialTeams={screen.prefill?.teams}
          initialOutcomeType={screen.prefill?.outcomeType}
          initialLocation={screen.prefill?.location}
          onClose={() => setScreen({ kind: "list" })}
          onSaved={async () => { setReloadKey(current => current + 1) }}
          onDone={() => setScreen({ kind: "list" })}
        />
      )}
      {screen.kind === "edit" && (
        <PlayLogForm
          game={screen.entry.game}
          editingPlay={screen.entry.play}
          onClose={() => setScreen({ kind: "list" })}
          onSaved={afterSave}
        />
      )}
      <header>
        <h1>Plays</h1>
      </header>

      <SavedCopyNotice names={["games", "plays"]} what="your plays" />

      <button type="button" className="primary-button plays-log-button" onClick={() => { setSearch(""); setScreen({ kind: "choose" }) }}>
        Log play
      </button>

      {loading && <Skeleton rows={4} label="Loading your plays" />}

      {!loading && error && (
        <div className="plays-state" role="alert">
          <p>{error}</p>
          <button type="button" className="secondary-button" onClick={() => { setLoading(true); setReloadKey(current => current + 1) }}>Retry</button>
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
            <div className="select-field">
              <select
                aria-label="Game"
                value={filters.bggId ?? ""}
                onChange={event => setFilters(current => ({ ...current, bggId: event.target.value ? Number(event.target.value) : null }))}
              >
                <option value="">All games</option>
                {feedGames(entries).map(game => <option key={game.bgg_id} value={game.bgg_id}>{game.name}</option>)}
              </select>
            </div>
            <div className="select-field">
              <select
                aria-label="Player"
                value={filters.player ?? ""}
                onChange={event => setFilters(current => ({ ...current, player: event.target.value || null }))}
              >
                <option value="">All players</option>
                {feedPlayers(entries).map(name => <option key={name} value={name}>{name}</option>)}
              </select>
            </div>
          </div>
          <div className="plays-range-row">
            <ChoiceGroup
              variant="chips"
              value={filters.range}
              ariaLabel="Date range"
              options={RANGES}
              onChange={range => setFilters(current => ({ ...current, range }))}
            />
            <p className="plays-count">
              {visible.length === entries.length ? "" : `${visible.length} of `}{entries.length} {entries.length === 1 ? "play" : "plays"}
            </p>
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
                  return (
                    <li key={play.id} className={`${entry.onShelf ? "plays-card" : "plays-card off-shelf"}${play.pending ? " has-pending" : ""}`}>
                      {entry.onShelf ? (
                        <>
                          <button type="button" className="plays-cover" onClick={() => onOpenGame(game.bgg_id)} aria-label={`Open ${game.name}`}>
                            <ResilientGameArtwork src={game.thumbnail_url ?? game.image_url} alt="" gameName={game.name} />
                          </button>
                          <button type="button" className="plays-card-main" onClick={() => setScreen({ kind: "edit", entry })} aria-label={`${game.name}, ${date}. Edit play`}>
                            <strong>{game.name}</strong>
                            <span>{playRowMeta(play, date)}</span>
                          </button>
                          <button type="button" className="plays-rematch" onClick={() => setScreen({ kind: "log", game, prefill: rematchPrefill(play), key: Date.now() })} aria-label={`Rematch ${game.name}`}>
                            Rematch
                          </button>
                          <PendingPlayControls play={play} withDelete onChanged={() => setReloadKey(current => current + 1)} />
                        </>
                      ) : (
                        <>
                          <span className="plays-cover"><ResilientGameArtwork src={game.thumbnail_url ?? game.image_url} alt="" gameName={game.name} /></span>
                          <span className="plays-card-main">
                            <strong>{game.name}</strong>
                            <span>{playRowMeta(play, date)}</span>
                          </span>
                          <span className="plays-off-shelf">Not on shelf</span>
                        </>
                      )}
                    </li>
                  )
                })}
              </ul>
            </section>
          ))}
        </>
      )}
    </section>
  )
}

export default PlaysView
