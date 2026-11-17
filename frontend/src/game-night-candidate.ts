import type { GameNightVotingCandidate } from "./api/client"

type Facts = Pick<
  GameNightVotingCandidate,
  "min_players" | "max_players" | "min_play_time" | "max_play_time" | "complexity"
>

function range(low: number | null | undefined, high: number | null | undefined, unit: string): string | null {
  const min = low && low > 0 ? low : null
  const max = high && high > 0 ? high : null
  if (min === null && max === null) return null
  const from = min ?? max!
  const to = max ?? min!
  if (from === to) return `${from} ${unit}`
  return `${Math.min(from, to)}\u2013${Math.max(from, to)} ${unit}`
}

// Same bands as the Picker: Light up to 2.0, Medium up to 3.0, Heavy above.
export function complexityLabel(complexity: number | null | undefined): string | null {
  if (complexity === null || complexity === undefined || complexity <= 0) return null
  if (complexity <= 2) return "Light"
  if (complexity <= 3) return "Medium"
  return "Heavy"
}

// One short line such as "2\u20134 players \u00b7 30\u201345 min \u00b7 Medium". Empty when nothing is known.
export function candidateFacts(candidate: Facts): string {
  const players = range(candidate.min_players, candidate.max_players, "players")
    ?.replace(/^1 players$/, "1 player")
  return [
    players ?? null,
    range(candidate.min_play_time, candidate.max_play_time, "min"),
    complexityLabel(candidate.complexity),
  ].filter(Boolean).join(" \u00b7 ")
}
