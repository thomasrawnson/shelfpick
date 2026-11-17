// "Solo", "2 players" or "2–4 players"; null when the range is unknown.
export function formatPlayerCount(min: number | null | undefined, max: number | null | undefined): string | null {
  const low = min ?? max
  const high = max ?? min
  if (low == null || high == null) return null
  if (high <= 1) return "Solo"
  if (low === high) return `${low} players`
  return `${low}–${high} players`
}
