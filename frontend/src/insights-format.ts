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
  return `${durationPlays} of ${totalPlays} plays timed`
}

export function winRateCopy(
  winRate: number | null,
): string {
  return winRate === null ? "—" : `${winRate}%`
}
