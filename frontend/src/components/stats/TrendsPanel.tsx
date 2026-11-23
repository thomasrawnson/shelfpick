import { useState } from "react"

import {
  getHIndex,
  getPlayHeatmap,
  getPlaysPerMonth,
  getPlayStreak,
  type StatsFilterValues,
} from "../../api/client"
import { useEntitlement } from "../../entitlements"
import {
  heatmapSummary,
  hIndexSummary,
  monthLabel,
  monthsChartSummary,
  raiseHIndexHeading,
  raiseHIndexNeed,
  streakCopy,
} from "../../stats-model"
import ChoiceGroup from "../ui/ChoiceGroup"
import RetryNotice from "../ui/RetryNotice"
import Skeleton from "../ui/Skeleton"
import BarChart from "./BarChart"
import Heatmap from "./Heatmap"
import ProStatsPanel from "./ProStatsPanel"
import StatsFilters from "./StatsFilters"
import { useStats } from "./useStats"

type Range = "12" | "24"

function filterKey(filters: StatsFilterValues): string {
  return JSON.stringify(filters)
}

function StreakAndHIndex({ filters, onOpenGame }: { filters: StatsFilterValues; onOpenGame: (bggId: number) => void }) {
  const key = filterKey(filters)
  const streak = useStats(`streak:${key}`, signal => getPlayStreak(filters, signal))
  const hIndex = useStats(`h-index:${key}`, signal => getHIndex(filters, signal))
  const streakText = streak.data ? streakCopy(streak.data) : null

  return (
    <>
      <div className="insights-stat-grid">
        <article className="stat-card" aria-busy={streak.loading}>
          {streak.loading ? <Skeleton rows={1} variant="tile" label="Loading streak" /> : streak.error ? (
            <RetryNotice message="Couldn't load your streak." onRetry={streak.retry} />
          ) : (
            <>
              <strong>{streakText!.value}</strong>
              <span>Week streak</span>
              <small>{streakText!.note}</small>
            </>
          )}
        </article>
        <article className="stat-card" aria-busy={hIndex.loading}>
          {hIndex.loading ? <Skeleton rows={1} variant="tile" label="Loading H-index" /> : hIndex.error ? (
            <RetryNotice message="Couldn't load your H-index." onRetry={hIndex.retry} />
          ) : (
            <>
              <strong>{hIndex.data!.h_index}</strong>
              <span>H-index</span>
              <small>{hIndexSummary(hIndex.data!)}</small>
            </>
          )}
        </article>
      </div>

      {hIndex.data && hIndex.data.raise_list.length > 0 && (
        <section className="stats-card" aria-labelledby="stats-raise-title">
          <h3 id="stats-raise-title">{raiseHIndexHeading(hIndex.data)}</h3>
          <p className="stats-note">
            {hIndex.data.reachable
              ? `${hIndex.data.games_needed} ${hIndex.data.games_needed === 1 ? "game needs" : "games need"} ${hIndex.data.next_target} plays each. These are the closest.`
              : "Not enough games on your shelf to go higher yet. These are the closest."}
          </p>
          <ol className="stats-raise-list">
            {hIndex.data.raise_list.map(game => (
              <li key={game.bgg_id}>
                <button type="button" className="stats-raise-game" onClick={() => onOpenGame(game.bgg_id)}>
                  <span>{game.name}</span>
                  <small>{game.plays === 1 ? "1 play" : `${game.plays} plays`} · {raiseHIndexNeed(game)}</small>
                </button>
              </li>
            ))}
          </ol>
        </section>
      )}
    </>
  )
}

function MonthsChart({ filters }: { filters: StatsFilterValues }) {
  const [range, setRange] = useState<Range>("12")
  const key = filterKey(filters)
  const months = useStats(`months:${range}:${key}`, signal => getPlaysPerMonth(Number(range) as 12 | 24, filters, signal))
  return (
    <section className="stats-card" aria-labelledby="stats-months-title" aria-busy={months.loading}>
      <div className="stats-card-head">
        <h3 id="stats-months-title">Plays per month</h3>
        <ChoiceGroup
          value={range}
          onChange={setRange}
          ariaLabel="Months shown"
          options={[{ value: "12", label: "12 months" }, { value: "24", label: "24 months" }]}
        />
      </div>
      {months.loading ? <Skeleton rows={1} variant="tile" label="Loading plays per month" /> : months.error ? (
        <RetryNotice message="Couldn't load plays per month." onRetry={months.retry} />
      ) : (
        <>
          <p className="stats-note">{monthsChartSummary(months.data!)}</p>
          <BarChart
            title="Plays per month"
            summary={monthsChartSummary(months.data!)}
            unit="play"
            labelEvery={range === "24" ? 3 : 1}
            data={months.data!.months.map(month => ({
              key: month.month,
              label: monthLabel(month.month),
              fullLabel: monthLabel(month.month, true),
              value: month.plays,
            }))}
          />
        </>
      )}
    </section>
  )
}

function YearHeatmap({ filters }: { filters: StatsFilterValues }) {
  const currentYear = new Date().getFullYear()
  const [year, setYear] = useState(currentYear)
  const key = filterKey(filters)
  const heatmap = useStats(`heatmap:${year}:${key}`, signal => getPlayHeatmap(year, filters, signal))
  return (
    <section className="stats-card" aria-labelledby="stats-heatmap-title" aria-busy={heatmap.loading}>
      <div className="stats-card-head">
        <h3 id="stats-heatmap-title">Play calendar</h3>
        <div className="stats-year-switch">
          <button type="button" className="ghost-button" aria-label="Previous year" disabled={year <= 2000} onClick={() => setYear(year - 1)}>‹</button>
          <strong aria-live="polite">{year}</strong>
          <button type="button" className="ghost-button" aria-label="Next year" disabled={year >= currentYear} onClick={() => setYear(year + 1)}>›</button>
        </div>
      </div>
      {heatmap.loading ? <Skeleton rows={1} variant="tile" label="Loading play calendar" /> : heatmap.error ? (
        <RetryNotice message="Couldn't load the play calendar." onRetry={heatmap.retry} />
      ) : (
        <>
          <p className="stats-note">{heatmapSummary(heatmap.data!)}</p>
          <Heatmap heatmap={heatmap.data!} scrollToEnd={year === currentYear} />
        </>
      )}
    </section>
  )
}

type Props = {
  onOpenGame: (bggId: number) => void
}

// The Stats "Trends" tab: a streak, an H-index you can raise, a month chart and
// a calendar for everyone; score records, head-to-head and filters for Pro.
export default function TrendsPanel({ onOpenGame }: Props) {
  const isPro = useEntitlement("advanced_stats")
  const [filters, setFilters] = useState<StatsFilterValues>({})
  // A Free account never sends a filter, whatever state it holds.
  const active = isPro ? filters : {}

  return (
    <div className="stats-section-content trends-panel">
      <div className="stats-section-heading">
        <h2>Trends</h2>
      </div>
      {isPro && <StatsFilters filters={filters} onChange={setFilters} />}
      <StreakAndHIndex filters={active} onOpenGame={onOpenGame} />
      <MonthsChart filters={active} />
      <YearHeatmap filters={active} />
      <h2 className="stats-subheading">Pro stats</h2>
      <ProStatsPanel isPro={isPro} filters={active} />
    </div>
  )
}
