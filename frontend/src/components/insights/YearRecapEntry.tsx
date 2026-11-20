import { useEffect, useRef, useState } from "react"
import { getYearRecap, type YearRecap } from "../../api/client"
import { renderYearRecapCard } from "../../year-recap-card"
import { yearEntryFacts, yearEntryHeadline, yearHeroStats, yearRecapYear } from "../../year-recap"
import RecapPreview from "./RecapPreview"
import { useRecapThumbnail } from "./useRecapThumbnail"
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
  const thumbnailUrl = useRecapThumbnail(
    () => recap && recap.total_plays > 0
      ? renderYearRecapCard(recap, false)
      : Promise.reject(new Error("No recap to preview")),
    recap,
  )

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

  const hasPlays = !loading && recap !== null && recap.total_plays > 0

  return (
    <section className="year-recap-entry" aria-labelledby="year-recap-entry-title">
      {!hasPlays && (
        <article className="recaps-preview-card">
          <h2 id="year-recap-entry-title">Your {year} in games</h2>
          {loading && <p role="status" aria-busy="true">Loading your {year} plays…</p>}
          {!loading && error && (
            <>
              <p role="alert">{error}</p>
              <button type="button" className="secondary-button" onClick={retry}>Retry</button>
            </>
          )}
          {!loading && recap && recap.total_plays === 0 && (
            <p>No plays recorded in {year} yet. Save a play and your recap will appear here.</p>
          )}
        </article>
      )}
      {hasPlays && recap && (
        <RecapPreview
          className="recap-preview-year"
          thumbnailUrl={thumbnailUrl}
          thumbnailLabel={`Preview your ${year} Year in Review`}
          onOpen={() => setSharing(true)}
        >
          <p className="recap-preview-kicker">{year} Year in Review</p>
          <h2 id="year-recap-entry-title" className="recap-preview-headline">{yearEntryHeadline(recap)}</h2>
          <dl className="recap-hero-stats">
            {yearHeroStats(recap).map(stat => (
              <div key={stat.label}><dt>{stat.label}</dt><dd>{stat.value}</dd></div>
            ))}
          </dl>
          {yearEntryFacts(recap).map(fact => <p key={fact} className="recap-preview-detail">{fact}</p>)}
          <div className="recap-preview-actions">
            <button type="button" className="primary-button" onClick={() => setViewing(true)}>View my year</button>
            <button type="button" className="secondary-button" onClick={() => setSharing(true)}>Share</button>
          </div>
        </RecapPreview>
      )}
      {viewing && recap && recap.total_plays > 0 && !sharing && (
        <YearRecapStory recap={recap} onClose={() => setViewing(false)} onShare={() => setSharing(true)} />
      )}
      {sharing && recap && <YearRecapShareDialog recap={recap} onClose={() => setSharing(false)} />}
    </section>
  )
}

export default YearRecapEntry
