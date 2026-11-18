import type { AuthUser } from "./auth"

// The Picker defaults shown on the Settings row, e.g. "4 players · 60 min".
export function pickerDefaultsSummary(user: Pick<AuthUser, "preferred_player_count" | "preferred_play_time">): string {
  const count = user.preferred_player_count
  const players = count === null ? "Any players" : count >= 6 ? "6+ players" : count === 1 ? "1 player" : `${count} players`
  const time = user.preferred_play_time
  return `${players} · ${time === null || time === 0 ? "any time" : `${time} min`}`
}
