import { useEffect, useRef, useState } from "react"
import { getYearRecap, type YearRecap } from "../../api/client"
import { SHORT_YEAR_PLAY_LIMIT, yearRecapYear } from "../../year-recap"
import YearRecapShareDialog from "./YearRecapShareDialog"
import YearRecapStory from "./YearRecapStory"

type Props = { autoOpen?: boolean }

function YearRecapEntry({ autoOpen = false }: Props) {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"
  const year = yearRecapYear(new Date(), timezone)
  const [recap, setRecap] = useState<YearRecap | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [retryKey, setRetryKey] = useState(0)
  const [viewing, setViewing] = useState(false)
  const [sharing, setSharing] = useState(false)
  const autoOpened = useRef(false)

  useEffect(() => {
    let active = true
    void getYearRecap(year, timezone).then(result => {
      if (!active) return
      setRecap(result)
      if (autoOpen && !autoOpened.current && result.total_plays > 0) {
        autoOpened.current = true
        setViewing(true)
      }
    }).catch(() => {
      if (active) setError(`Couldn't load your ${year} Year in Review.`)
    }).finally(() => {
      if (active) setLoading(false)
    })
    return () => { active = false }
  }, [year, timezone, retryKey, autoOpen])

  function retry() {
    setLoading(true)
    setError("")
    setRetryKey(current => current + 1)
  }

  return (
    <article className="year-recap-entry recaps-preview-card" aria-labelledby="year-recap-entry-title">
      <p className="insight-label">{year} in review</p>
      <h2 id="year-recap-entry-title">Your year in review</h2>
      {loading && <p role="status" aria-busy="true">Loading your {year} plays…</p>}
      {!loading && error && (
        <>
          <p role="alert">{error}</p>
          <button type="button" className="secondary-button" onClick={retry}>Retry</button>
        </>
      )}
      {!loading && recap && recap.total_plays === 0 && (
        <p>No plays recorded in {year} yet. Save a play and your year in review will appear here.</p>
      )}
      {!loading && recap && recap.total_plays > 0 && (
        <>
          <p>
            {recap.total_plays} {recap.total_plays === 1 ? "play" : "plays"} across {recap.unique_games} {recap.unique_games === 1 ? "game" : "games"}.
            {recap.total_plays < SHORT_YEAR_PLAY_LIMIT ? " A short one so far." : " Step through your year and share it."}
          </p>
          <button type="button" className="primary-button" onClick={() => setViewing(true)}>View my year</button>
        </>
      )}
      {viewing && recap && recap.total_plays > 0 && !sharing && (
        <YearRecapStory recap={recap} onClose={() => setViewing(false)} onShare={() => setSharing(true)} />
      )}
      {sharing && recap && <YearRecapShareDialog recap={recap} onClose={() => setSharing(false)} />}
    </article>
  )
}

export default YearRecapEntry
