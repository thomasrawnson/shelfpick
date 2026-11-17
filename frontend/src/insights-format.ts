export function formatRecordedHours(
  minutes: number | null,
): string {
  if (minutes === null) return "—"

  const hours = minutes / 60
  return hours < 10
    ? hours.toFixed(1)
    : Math.round(hours).toString()
}

export function durationCoverageCopy(
  totalPlays: number,
  durationPlays: number,
): string | null {
  if (totalPlays === 0 || durationPlays === totalPlays) return null
  if (durationPlays === 0) return "Play time not recorded"
  return `Timed on ${durationPlays} of ${totalPlays} ${totalPlays === 1 ? "play" : "plays"}`
}

// Stats player table: wins over the plays that player took part in.
export function playerWinRateCopy(
  wins: number,
  plays: number,
): string {
  return plays > 0 ? `${Math.round((wins / plays) * 100)}%` : "—"
}

export function winRateCopy(
  winRate: number | null,
): string {
  return winRate === null ? "—" : `${winRate}%`
}
