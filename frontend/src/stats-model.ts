// Pure helpers behind the Stats trend charts (SP-STATS-01). No DOM, no fetching.
import type { HeadToHead, HIndexStats, PlayHeatmap, PlayStreak, PlaysPerMonth, StatsFilterValues } from "./api/client"

const DAY_MS = 86_400_000

function utcDay(year: number, month: number, day: number): number {
  return Date.UTC(year, month, day)
}

function isoDate(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10)
}

export function plural(count: number, one: string, many = `${one}s`): string {
  return `${count} ${count === 1 ? one : many}`
}

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

// "2026-03" -> "Mar" or "Mar 2026".
export function monthLabel(month: string, withYear = false): string {
  const [year, number] = month.split("-").map(Number)
  return withYear ? `${MONTH_NAMES[number - 1]} ${year}` : MONTH_NAMES[number - 1]
}

export function formatDay(date: string): string {
  const [year, month, day] = date.split("-").map(Number)
  return `${day} ${MONTH_NAMES[month - 1]} ${year}`
}

export type HeatCell = { date: string; plays: number; level: 0 | 1 | 2 | 3 | 4 }

// Level 0 is an empty day; 1 to 4 scale to the busiest day of the year.
export function heatLevel(plays: number, max: number): HeatCell["level"] {
  if (plays <= 0 || max <= 0) return 0
  return Math.min(4, Math.max(1, Math.ceil((plays / max) * 4))) as HeatCell["level"]
}

// Columns are weeks starting Monday; each has seven slots (Mon to Sun) and a
// null slot is outside the year.
export function heatmapWeeks(heatmap: Pick<PlayHeatmap, "year" | "days" | "max_plays_in_day">): Array<Array<HeatCell | null>> {
  const counts = new Map(heatmap.days.map(day => [day.date, day.plays]))
  const first = utcDay(heatmap.year, 0, 1)
  const last = utcDay(heatmap.year, 11, 31)
  const mondayOffset = (new Date(first).getUTCDay() + 6) % 7
  const weeks: Array<Array<HeatCell | null>> = []
  for (let weekStart = first - mondayOffset * DAY_MS; weekStart <= last; weekStart += 7 * DAY_MS) {
    weeks.push(Array.from({ length: 7 }, (_, offset) => {
      const ms = weekStart + offset * DAY_MS
      if (ms < first || ms > last) return null
      const date = isoDate(ms)
      const plays = counts.get(date) ?? 0
      return { date, plays, level: heatLevel(plays, heatmap.max_plays_in_day) }
    }))
  }
  return weeks
}

// Each month is labelled above the week that contains its first day.
export function heatmapMonthMarkers(weeks: Array<Array<HeatCell | null>>): Array<{ column: number; label: string }> {
  const markers: Array<{ column: number; label: string }> = []
  weeks.forEach((week, column) => {
    const first = week.find(slot => slot?.date.endsWith("-01"))
    if (first) markers.push({ column, label: monthLabel(first.date.slice(0, 7)) })
  })
  return markers
}

export function monthsChartSummary(data: PlaysPerMonth): string {
  if (data.total_plays === 0) return `No plays in the last ${data.months.length} months.`
  const busiest = data.months.reduce((best, month) => (month.plays > best.plays ? month : best), data.months[0])
  return `${plural(data.total_plays, "play")} in the last ${data.months.length} months. Busiest month ${monthLabel(busiest.month, true)} with ${plural(busiest.plays, "play")}.`
}

export function heatmapSummary(data: PlayHeatmap): string {
  if (data.total_plays === 0) return `No plays recorded in ${data.year}.`
  return `${plural(data.total_plays, "play")} on ${plural(data.active_days, "day")} in ${data.year}. Busiest day had ${plural(data.max_plays_in_day, "play")}.`
}

export function hIndexSummary(stats: HIndexStats): string {
  if (stats.games_played === 0) return "Play a game to start your H-index."
  return `${stats.h_index} ${stats.h_index === 1 ? "game has" : "games have"} been played at least ${stats.h_index} ${stats.h_index === 1 ? "time" : "times"}.`
}

export function raiseHIndexHeading(stats: HIndexStats): string {
  return `Play these to reach ${stats.next_target}`
}

export function raiseHIndexNeed(game: { plays_needed?: number }): string {
  const needed = game.plays_needed ?? 0
  return needed === 1 ? "1 more play" : `${needed} more plays`
}

export function streakCopy(streak: PlayStreak): { value: string; note: string } {
  const weeks = streak.current_weeks
  const value = String(weeks)
  if (streak.best_weeks === 0) return { value, note: "Play this week to start a streak" }
  if (weeks === 0) return { value, note: `Best ${plural(streak.best_weeks, "week")}` }
  if (streak.at_risk) return { value, note: `Play this week to keep it going · Best ${streak.best_weeks}` }
  return { value, note: weeks >= streak.best_weeks ? "Your best yet" : `Best ${plural(streak.best_weeks, "week")}` }
}

export function headToHeadSummary(h2h: HeadToHead, nameA: string, nameB: string): string {
  if (h2h.plays_together === 0) return `${nameA} and ${nameB} have no plays together yet.`
  const parts: string[] = []
  if (h2h.versus_plays > 0) {
    parts.push(`${nameA} ${h2h.wins_a}, ${nameB} ${h2h.wins_b}${h2h.draws ? `, ${plural(h2h.draws, "draw")}` : ""}`)
  }
  if (h2h.coop_plays > 0) parts.push(`${plural(h2h.coop_plays, "co-op play")} together (${h2h.coop_won} won, ${h2h.coop_lost} lost)`)
  if (h2h.same_team_plays > 0) parts.push(`${plural(h2h.same_team_plays, "play")} as teammates`)
  return parts.join(". ") + "."
}

export function filtersActiveCount(filters: StatsFilterValues): number {
  return [filters.dateFrom, filters.dateTo, filters.playerId, filters.location, filters.playerCount]
    .filter(value => value !== undefined && value !== "").length
}
