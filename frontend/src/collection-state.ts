import type { Game } from "./api/client"

export function mergeGameIntoCollection(current: Game[], game: Game): Game[] {
  return current.some((existing) => existing.bgg_id === game.bgg_id)
    ? current
    : [...current, game]
}
