import type { YearRecap } from "./api/client"

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
]
const WEEKDAYS = [
  "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday",
]

export type YearSlideKind =
  | "totals"
  | "top-games"
  | "new-games"
  | "months"
  | "weekday"
  | "longest"
  | "co-players"
  | "closing"

export const SHORT_YEAR_PLAY_LIMIT = 3

export function monthName(month: number): string {
  return MONTHS[month - 1] ?? ""
}

export function weekdayName(isoWeekday: number): string {
  return WEEKDAYS[isoWeekday - 1] ?? ""
}

export function plural(count: number, one: string, many = `${one}s`): string {
  return `${count} ${count === 1 ? one : many}`
}

export function formatHours(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const remainder = minutes % 60
  if (!hours) return `${remainder}m`
  return remainder ? `${hours}h ${remainder}m` : `${hours}h`
}

// Null when every play was timed: full coverage needs no caveat.
export function hoursCoverage(recap: YearRecap): string | null {
  if (recap.total_duration_minutes === null) return "Play time wasn't recorded"
  if (recap.duration_plays >= recap.total_plays) return null
  return `Timed on ${recap.duration_plays} of ${plural(recap.total_plays, "play")}`
}

// Short years (fewer than three plays) skip the slides that need more data.
export function yearSlideKinds(recap: YearRecap): YearSlideKind[] {
  if (recap.total_plays === 0) return []
  if (recap.total_plays < SHORT_YEAR_PLAY_LIMIT) return ["totals", "top-games", "closing"]
  const kinds: YearSlideKind[] = ["totals", "top-games"]
  if (recap.new_games_count > 0) kinds.push("new-games")
  kinds.push("months", "weekday")
  if (recap.longest_play) kinds.push("longest")
  if (recap.co_players.length > 0) kinds.push("co-players")
  kinds.push("closing")
  return kinds
}

export type StorySegment = "done" | "current" | "upcoming"

// The progress bar and the "Slide n of m" counter both come from the same slide list.
export function storyProgress(kinds: YearSlideKind[], index: number): { segments: StorySegment[]; counter: string } {
  return {
    segments: kinds.map((_, position) => position < index ? "done" : position === index ? "current" : "upcoming"),
    counter: `Slide ${index + 1} of ${kinds.length}`,
  }
}

export function slideTitle(kind: YearSlideKind, recap: YearRecap): string {
  switch (kind) {
    case "totals": return `Your ${recap.year} in games`
    case "top-games": return "Your top games"
    case "new-games": return "New to you"
    case "months": return "Busiest month"
    case "weekday": return "Busiest day"
    case "longest": return "Longest play"
    case "co-players": return "Your play partners"
    case "closing": return "That's your year"
  }
}

// One plain sentence per slide, used for the VoiceOver label and alt text.
export function slideSummary(kind: YearSlideKind, recap: YearRecap): string {
  switch (kind) {
    case "totals": {
      const time = recap.total_duration_minutes === null
        ? "Play time wasn't recorded."
        : `${formatHours(recap.total_duration_minutes)} played.${coverageSentence(recap)}`
      return `${plural(recap.total_plays, "play")} of ${plural(recap.unique_games, "different game")}. ${time}`
    }
    case "top-games":
      return recap.top_games
        .map((game, index) => `${index + 1}. ${game.name}, ${plural(game.play_count, "play")}`)
        .join(". ")
    case "new-games":
      return `${plural(recap.new_games_count, "game")} you played for the first time. ${recap.new_games.map(game => game.name).join(", ")}${recap.new_games_count > recap.new_games.length ? " and more" : ""}.`
    case "months":
      return recap.busiest_month
        ? `${monthName(recap.busiest_month)} was your busiest month with ${plural(recap.plays_by_month[recap.busiest_month - 1], "play")}. ${monthsChartLabel(recap)}`
        : "No busiest month yet."
    case "weekday":
      return recap.busiest_weekday
        ? `${weekdayName(recap.busiest_weekday)} was your busiest day with ${plural(recap.plays_by_weekday[recap.busiest_weekday - 1], "play")}.`
        : "No busiest day yet."
    case "longest":
      return recap.longest_play
        ? `Your longest timed play was ${recap.longest_play.name} at ${formatHours(recap.longest_play.duration_minutes)}.`
        : "No timed plays."
    case "co-players":
      return recap.co_players
        .map(player => `${player.name}, ${plural(player.play_count, "play")}`)
        .join(". ")
    case "closing":
      return `${plural(recap.total_plays, "play")} in ${recap.year}. Share your year or close the story.`
  }
}

function coverageSentence(recap: YearRecap): string {
  const coverage = hoursCoverage(recap)
  return coverage ? ` ${coverage}.` : ""
}

export function monthsChartLabel(recap: YearRecap): string {
  return recap.plays_by_month
    .map((count, index) => `${MONTHS[index].slice(0, 3)} ${count}`)
    .join(", ")
}

export function yearRecapFileName(year: number): string {
  return `shelfpick-${year}-year-in-review.png`
}

export function yearRecapAltText(recap: YearRecap, includeNames: boolean): string {
  const top = recap.top_games[0]
  const topText = top ? ` Most played: ${top.name}, ${plural(top.play_count, "play")}.` : ""
  const names = includeNames && recap.co_players.length
    ? ` Most played with: ${recap.co_players.map(player => player.name).join(", ")}.`
    : ""
  return `${recap.year} ShelfPick Year in Review: ${slideSummary("totals", recap)}${topText}${names}`
}

function localYearAndMonth(now: Date, timezone: string): { year: number; month: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone, year: "numeric", month: "2-digit",
  }).formatToParts(now)
  return {
    year: Number(parts.find(part => part.type === "year")?.value),
    month: Number(parts.find(part => part.type === "month")?.value),
  }
}

// The year Insights offers: the current year, or in January the one that just ended.
export function yearRecapYear(now: Date, timezone: string): number {
  const { year, month } = localYearAndMonth(now, timezone)
  return month === 1 ? year - 1 : year
}

// The Pick banner shows from 1 December to 31 January only.
export function yearRecapBannerYear(now: Date, timezone: string): number | null {
  const { month } = localYearAndMonth(now, timezone)
  return month === 12 || month === 1 ? yearRecapYear(now, timezone) : null
}

export const yearRecapDismissKey = (year: number) => `shelfpick-year-recap-banner-dismissed-${year}`
