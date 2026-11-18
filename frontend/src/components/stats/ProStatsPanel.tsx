import { useState } from "react"
import { useNavigate } from "react-router-dom"

import {
  getHeadToHead,
  getPlayers,
  getScoreRecords,
  type HeadToHead,
  type ScoreRecord,
  type StatsFilterValues,
} from "../../api/client"
import { APP_PATHS } from "../../routes"
import { filtersActiveCount, formatDay, headToHeadSummary, plural } from "../../stats-model"
import RetryNotice from "../ui/RetryNotice"
import Skeleton from "../ui/Skeleton"
import { useStats } from "./useStats"

const RECORDS_SHOWN = 5

function formatScore(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1)
}

function filterKey(filters: StatsFilterValues): string {
  return JSON.stringify(filters)
}

function Records({ filters }: { filters: StatsFilterValues }) {
  const [showAll, setShowAll] = useState(false)
  const records = useStats(`records:${filterKey(filters)}`, signal => getScoreRecords(filters, signal))

  if (records.loading) return <Skeleton rows={3} label="Loading score records" />
  if (records.error) return <RetryNotice message="Couldn't load score records." onRetry={records.retry} />
  const games: ScoreRecord[] = records.data?.games ?? []
  if (games.length === 0) {
    return (
      <p className="stats-note">
        {filtersActiveCount(filters) > 0 ? "No scored plays match these filters." : "Record scores when you log plays to see bests here."}
      </p>
    )
  }
  const visible = showAll ? games : games.slice(0, RECORDS_SHOWN)
  return (
    <>
      <ul className="stats-record-list">
        {visible.map(game => (
          <li className="stats-record" key={game.bgg_id}>
            <h4>{game.name}</h4>
            <p className="stats-record-meta">{plural(game.scored_plays, "scored play")}</p>
            <dl>
              <div><dt>Best</dt><dd>{formatScore(game.best)}</dd></div>
              <div><dt>Average</dt><dd>{formatScore(game.average)}</dd></div>
              <div><dt>Lowest</dt><dd>{formatScore(game.lowest)}</dd></div>
              <div><dt>Highest losing</dt><dd>{game.highest_losing === null ? "—" : formatScore(game.highest_losing)}</dd></div>
              <div>
                <dt>Best category</dt>
                <dd>{game.best_category ? `${game.best_category.label} (${formatScore(game.best_category.points)})` : "—"}</dd>
              </div>
            </dl>
          </li>
        ))}
      </ul>
      {games.length > RECORDS_SHOWN && (
        <button type="button" className="secondary-button" onClick={() => setShowAll(value => !value)}>
          {showAll ? "Show fewer games" : `Show all ${games.length} games`}
        </button>
      )}
    </>
  )
}

function HeadToHeadResult({ playerA, playerB, names, filters }: {
  playerA: number
  playerB: number
  names: Record<number, string>
  filters: StatsFilterValues
}) {
  const result = useStats(
    `h2h:${playerA}:${playerB}:${filterKey({ ...filters, playerId: undefined })}`,
    signal => getHeadToHead(playerA, playerB, { ...filters, playerId: undefined }, signal),
  )
  if (result.loading) return <Skeleton rows={2} label="Loading head-to-head" />
  if (result.error) return <RetryNotice message="Couldn't load head-to-head." onRetry={result.retry} />
  const h2h: HeadToHead = result.data!
  const nameA = names[playerA]
  const nameB = names[playerB]
  return (
    <div className="stats-h2h-result">
      <p className="sr-only">{headToHeadSummary(h2h, nameA, nameB)}</p>
      <div className="stats-h2h-score" aria-hidden="true">
        <div><strong>{h2h.wins_a}</strong><span>{nameA}</span></div>
        <div><strong>{h2h.draws}</strong><span>Draws</span></div>
        <div><strong>{h2h.wins_b}</strong><span>{nameB}</span></div>
      </div>
      <p className="stats-note">
        {h2h.versus_plays === 0
          ? `${nameA} and ${nameB} haven't played against each other yet.`
          : `Across ${plural(h2h.versus_plays, "play")} against each other${h2h.undecided ? `, ${h2h.undecided} without a recorded result` : ""}.`}
      </p>
      {(h2h.coop_plays > 0 || h2h.same_team_plays > 0) && (
        <ul className="stats-h2h-extra">
          {h2h.coop_plays > 0 && (
            <li>Co-op together: {plural(h2h.coop_plays, "play")} ({h2h.coop_won} won, {h2h.coop_lost} lost). Not counted above.</li>
          )}
          {h2h.same_team_plays > 0 && <li>On the same team: {plural(h2h.same_team_plays, "play")}. Not counted above.</li>}
        </ul>
      )}
      {h2h.recent.length > 0 && (
        <ul className="stats-h2h-recent" aria-label="Recent plays together">
          {h2h.recent.map(play => (
            <li key={play.play_id}>
              <span>{play.game}</span>
              <small>
                {formatDay(play.played_at.slice(0, 10))} ·{" "}
                {play.kind === "coop" ? (play.coop_result === "won" ? "Co-op win" : play.coop_result === "lost" ? "Co-op loss" : "Co-op")
                  : play.kind === "teammates" ? "Teammates"
                  : play.result === "a" ? `${nameA} won`
                  : play.result === "b" ? `${nameB} won`
                  : play.result === "draw" ? "Draw" : "No result"}
              </small>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function HeadToHeadPicker({ filters }: { filters: StatsFilterValues }) {
  const players = useStats("h2h-players", () => getPlayers())
  const [selection, setSelection] = useState<{ a?: number; b?: number }>({})

  if (players.loading) return <Skeleton rows={1} label="Loading players" />
  if (players.error) return <RetryNotice message="Couldn't load players." onRetry={players.retry} />
  const list = players.data ?? []
  if (list.length < 2) return <p className="stats-note">Add two players to compare them.</p>
  const names = Object.fromEntries(list.map(player => [player.id, player.name]))
  const ready = selection.a !== undefined && selection.b !== undefined && selection.a !== selection.b

  const field = (label: string, key: "a" | "b") => (
    <label>
      <span>{label}</span>
      <select
        value={selection[key] ?? ""}
        onChange={event => setSelection({ ...selection, [key]: event.target.value ? Number(event.target.value) : undefined })}
      >
        <option value="">Choose a player</option>
        {list.map(player => (
          <option key={player.id} value={player.id} disabled={player.id === selection[key === "a" ? "b" : "a"]}>{player.name}</option>
        ))}
      </select>
    </label>
  )

  return (
    <>
      <div className="stats-filter-grid stats-h2h-fields">{field("First player", "a")}{field("Second player", "b")}</div>
      {ready
        ? <HeadToHeadResult playerA={selection.a!} playerB={selection.b!} names={names} filters={filters} />
        : <p className="stats-note">Choose two players to compare their games against each other.</p>}
    </>
  )
}

function LockedPreview() {
  const navigate = useNavigate()
  return (
    <section className="stats-locked" aria-labelledby="stats-locked-title">
      <p className="stats-pro-badge">Included with Pro</p>
      <h3 id="stats-locked-title">Records, head-to-head and filters</h3>
      <ul>
        <li><strong>Score records</strong> Best, average, lowest and highest losing score for each game.</li>
        <li><strong>Head-to-head</strong> Who wins when two players sit down together.</li>
        <li><strong>Filters</strong> Narrow every chart by dates, player, place and group size.</li>
        <li><strong>Help my H-index</strong> A Picker option that favours games moving your H-index.</li>
      </ul>
      <button type="button" className="secondary-button" onClick={() => navigate(APP_PATHS.settingsPro)}>
        See what Pro includes
      </button>
    </section>
  )
}

export default function ProStatsPanel({ isPro, filters }: { isPro: boolean; filters: StatsFilterValues }) {
  if (!isPro) return <LockedPreview />
  return (
    <>
      <section className="stats-card" aria-labelledby="stats-records-title">
        <h3 id="stats-records-title">Score records</h3>
        <Records filters={filters} />
      </section>
      <section className="stats-card" aria-labelledby="stats-h2h-title">
        <h3 id="stats-h2h-title">Head-to-head</h3>
        <HeadToHeadPicker filters={filters} />
      </section>
    </>
  )
}
