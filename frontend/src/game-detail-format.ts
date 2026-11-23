import type { GamePlay } from "./api/client"

// Display helpers for the game detail screen (SP-UI-05).

// "8.1 / 10": a value with its scale, or an em dash when the game has none.
export function scaled(value: number | null | undefined, scale: number): { value: string; scale: string | null } {
  if (value == null || !Number.isFinite(value)) return { value: "—", scale: null }
  return { value: value.toFixed(1), scale: ` / ${scale}` }
}

// A duration in minutes; a missing or zero duration is never shown as 0.
export function minutesOrDash(minutes: number | null | undefined): string {
  return minutes ? String(minutes) : "—"
}

export function playsLabel(count: number): string {
  return count === 1 ? "play" : "plays"
}

// "2 players · 30 min" under the title; the max play time is left out when the game has none.
export function metaLine(playerCount: string | null, maxPlayTime: number | null): string {
  return [playerCount, maxPlayTime ? `${maxPlayTime} min` : null].filter(Boolean).join(" · ")
}

// Winners and draws first, everyone else after, each group in the order the play was logged.
export function winnersFirst<T extends Pick<GamePlay["participants"][number], "outcome">>(participants: readonly T[]): T[] {
  const isWinner = (participant: T) => participant.outcome === "win" || participant.outcome === "draw"
  return [...participants.filter(isWinner), ...participants.filter((participant) => !isWinner(participant))]
}
