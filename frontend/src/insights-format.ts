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

// Stats player table: the same rule and format as the player profile.
// Win rate = wins / decided plays (wins, losses and draws); plays with no
// recorded result are left out. Rounded to one decimal, as the backend does.
export function playerWinRateCopy(
  wins: number,
  decided: number,
): string {
  return winRateCopy(decided > 0 ? Math.round((wins / decided) * 1000) / 10 : null)
}

export function winRateCopy(
  winRate: number | null,
): string {
  return winRate === null ? "—" : `${winRate}%`
}
