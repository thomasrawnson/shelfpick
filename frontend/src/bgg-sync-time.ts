// The last successful BoardGameGeek sync on this device. The server does not
// record sync times, so Settings shows this device's most recent sync.
const storageKey = "shelfpick-bgg-last-sync"

export function rememberBggSync(at: Date = new Date()): void {
  window.localStorage?.setItem(storageKey, at.toISOString())
}

export function lastBggSync(): Date | null {
  if (typeof window === "undefined") return null
  const value = window.localStorage?.getItem(storageKey)
  const date = value ? new Date(value) : null
  return date && !Number.isNaN(date.getTime()) ? date : null
}

export function relativeSyncTime(at: Date, now: Date = new Date()): string {
  const minutes = Math.max(0, Math.round((now.getTime() - at.getTime()) / 60_000))
  if (minutes < 1) return "Just now"
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  return days < 30 ? `${days}d ago` : at.toLocaleDateString(undefined, { day: "numeric", month: "short" })
}
