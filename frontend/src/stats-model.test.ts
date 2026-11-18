import assert from "node:assert/strict"
import test from "node:test"

import {
  formatDay, heatLevel, heatmapMonthMarkers, heatmapSummary, heatmapWeeks, headToHeadSummary, hIndexSummary,
  monthLabel, monthsChartSummary, raiseHIndexNeed, streakCopy,
} from "./stats-model.ts"

const empty = (year: number) => ({ year, days: [], max_plays_in_day: 0 })

test("heat levels scale to the busiest day", () => {
  assert.equal(heatLevel(0, 10), 0)
  assert.equal(heatLevel(1, 10), 1)
  assert.equal(heatLevel(5, 10), 2)
  assert.equal(heatLevel(7, 10), 3)
  assert.equal(heatLevel(8, 10), 4)
  assert.equal(heatLevel(10, 10), 4)
  assert.equal(heatLevel(3, 0), 0)
})

test("the heatmap grid starts on a Monday and fills only the year", () => {
  const weeks = heatmapWeeks({ year: 2026, days: [{ date: "2026-01-01", plays: 2 }, { date: "2026-12-31", plays: 1 }], max_plays_in_day: 2 })
  // 1 Jan 2026 is a Thursday: Mon-Wed of the first column are outside the year.
  assert.deepEqual(weeks[0].map(cell => cell?.date ?? null), [null, null, null, "2026-01-01", "2026-01-02", "2026-01-03", "2026-01-04"])
  assert.equal(weeks[0][3]?.plays, 2)
  assert.equal(weeks[0][3]?.level, 4)
  assert.equal(weeks.length, 53)
  const lastWeek = weeks.at(-1)!
  assert.equal(lastWeek.find(cell => cell?.date === "2026-12-31")?.plays, 1)
  assert.equal(weeks.flat().filter(Boolean).length, 365)
  assert.equal(heatmapWeeks(empty(2028)).flat().filter(Boolean).length, 366)
})

test("month markers label each month once, in order", () => {
  const markers = heatmapMonthMarkers(heatmapWeeks(empty(2026)))
  assert.deepEqual(markers.map(marker => marker.label), ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"])
  assert.equal(markers[0].column, 0)
  assert.deepEqual(markers.map(marker => marker.column), [...markers.map(marker => marker.column)].sort((a, b) => a - b))
})

test("labels and summaries read naturally", () => {
  assert.equal(monthLabel("2026-03"), "Mar")
  assert.equal(monthLabel("2026-03", true), "Mar 2026")
  assert.equal(formatDay("2026-03-09"), "9 Mar 2026")
  assert.equal(
    monthsChartSummary({ total_plays: 7, months: [{ month: "2026-01", plays: 2 }, { month: "2026-02", plays: 5 }] }),
    "7 plays in the last 2 months. Busiest month Feb 2026 with 5 plays.",
  )
  assert.equal(monthsChartSummary({ total_plays: 0, months: [{ month: "2026-01", plays: 0 }] }), "No plays in the last 1 months.")
  assert.equal(heatmapSummary({ year: 2026, days: [], total_plays: 1, active_days: 1, max_plays_in_day: 1 }), "1 play on 1 day in 2026. Busiest day had 1 play.")
  assert.equal(hIndexSummary({ h_index: 1, games_played: 1 } as never), "1 game has been played at least 1 time.")
  assert.equal(hIndexSummary({ h_index: 0, games_played: 0 } as never), "Play a game to start your H-index.")
  assert.equal(raiseHIndexNeed({ plays_needed: 1 }), "1 more play")
  assert.equal(raiseHIndexNeed({ plays_needed: 3 }), "3 more plays")
})

test("streak copy covers new, alive, at risk and broken", () => {
  const base = { played_this_week: true, at_risk: false, this_week_start: "2026-11-16" }
  assert.equal(streakCopy({ ...base, current_weeks: 0, best_weeks: 0, played_this_week: false }).note, "Play this week to start a streak")
  assert.equal(streakCopy({ ...base, current_weeks: 4, best_weeks: 4 }).note, "Your best yet")
  assert.equal(streakCopy({ ...base, current_weeks: 2, best_weeks: 5 }).note, "Best 5 weeks")
  assert.equal(streakCopy({ ...base, current_weeks: 0, best_weeks: 3, played_this_week: false }).note, "Best 3 weeks")
  assert.match(streakCopy({ ...base, current_weeks: 3, best_weeks: 3, played_this_week: false, at_risk: true }).note, /^Play this week to keep it going/)
})

test("head-to-head copy keeps co-op and teammate plays separate", () => {
  const h2h = { plays_together: 6, versus_plays: 3, wins_a: 2, wins_b: 1, draws: 0, undecided: 0, coop_plays: 2, coop_won: 1, coop_lost: 1, same_team_plays: 1 } as never
  assert.equal(
    headToHeadSummary(h2h, "Ann", "Bob"),
    "Ann 2, Bob 1. 2 co-op plays together (1 won, 1 lost). 1 play as teammates.",
  )
  assert.equal(headToHeadSummary({ plays_together: 0 } as never, "Ann", "Bob"), "Ann and Bob have no plays together yet.")
})
