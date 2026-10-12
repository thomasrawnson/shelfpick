import { useEffect, useState } from "react"
import { getMonthlyRecap, type MonthlyRecap } from "../../api/client"
import { monthInTimezone, shiftMonth } from "../../monthly-recap-month"
import MonthlyRecapShareDialog from "./MonthlyRecapShareDialog"

function durationCopy(recap: MonthlyRecap): string {
  if (recap.total_duration_minutes === null) return "Play time was not recorded this month."
  const hours = Math.floor(recap.total_duration_minutes / 60)
  const minutes = recap.total_duration_minutes % 60
  const value = [hours ? `${hours}h` : "", minutes ? `${minutes}m` : ""].filter(Boolean).join(" ")
  return `${value} recorded across ${recap.duration_plays} of ${recap.total_plays} ${recap.total_plays === 1 ? "play" : "plays"}.`
}

function MonthlyRecapPanel() {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"
  const currentMonth = monthInTimezone(new Date(), timezone)
  const [month, setMonth] = useState(currentMonth)
  const [recap, setRecap] = useState<MonthlyRecap | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [retryKey, setRetryKey] = useState(0)
  const [sharing, setSharing] = useState(false)

  useEffect(() => {
    let active = true
    void getMonthlyRecap(month, timezone).then(result => {
      if (active) setRecap(result)
    }).catch(() => {
      if (active) {
        setRecap(null)
        setError("Couldn't load this monthly recap.")
      }
    }).finally(() => {
      if (active) setLoading(false)
    })
    return () => { active = false }
  }, [month, timezone, retryKey])

  function selectMonth(nextMonth: string) {
    setMonth(nextMonth)
    setRecap(null)
    setLoading(true)
    setError("")
    setSharing(false)
  }

  function retry() {
    setLoading(true)
    setError("")
    setRetryKey(current => current + 1)
  }

  return (
    <div className="stats-section-content monthly-recap-section">
      <div className="stats-section-heading recap-heading-row">
        <div>
          <h2>This month in games</h2>
          <p>Turn your recorded plays into a private, shareable recap.</p>
        </div>
        <div className="recap-month-controls" aria-label="Select recap month">
          <button type="button" className="ghost-button" aria-label="Previous month" onClick={() => selectMonth(shiftMonth(month, -1))}>Previous</button>
          <time dateTime={month} aria-live="polite">{recap?.month_label ?? month}</time>
          <button type="button" className="ghost-button" aria-label="Next month" disabled={month >= currentMonth} onClick={() => selectMonth(shiftMonth(month, 1))}>Next</button>
        </div>
      </div>

      {loading && <article className="monthly-recap-state" aria-busy="true"><p role="status">Loading your recorded plays…</p></article>}
      {!loading && error && (
        <article className="monthly-recap-state">
          <p role="alert">{error}</p>
          <button type="button" className="secondary-button" onClick={retry}>Retry</button>
        </article>
      )}
      {!loading && recap && recap.total_plays === 0 && (
        <article className="monthly-recap-state">
          <h3>No plays recorded in {recap.month_label}</h3>
          <p>Only saved play history appears here, so there is no recap to share for this month.</p>
        </article>
      )}
      {!loading && recap && recap.total_plays > 0 && (
        <article className="monthly-recap-card">
          <div className="monthly-recap-summary">
            <div><strong>{recap.total_plays}</strong><span>{recap.total_plays === 1 ? "Play" : "Plays"}</span></div>
            <div><strong>{recap.unique_games}</strong><span>{recap.unique_games === 1 ? "Game" : "Games"}</span></div>
          </div>
          <div className="monthly-recap-copy">
            <p>{durationCopy(recap)}</p>
            {recap.most_played && <p><strong>Most played:</strong> {recap.most_played.name} · {recap.most_played.play_count} {recap.most_played.play_count === 1 ? "play" : "plays"}</p>}
          </div>
          <button type="button" className="primary-button monthly-recap-share" onClick={() => setSharing(true)}>Share this month</button>
        </article>
      )}
      {sharing && recap && <MonthlyRecapShareDialog recap={recap} onClose={() => setSharing(false)} />}
    </div>
  )
}

export default MonthlyRecapPanel
