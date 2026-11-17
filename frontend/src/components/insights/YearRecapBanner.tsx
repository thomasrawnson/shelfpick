import { useEffect, useState } from "react"
import { getYearRecap } from "../../api/client"
import { yearRecapBannerYear, yearRecapDismissKey } from "../../year-recap"

type Props = { onOpen: () => void }

function readDismissed(year: number): boolean {
  try { return localStorage.getItem(yearRecapDismissKey(year)) === "1" } catch { return false }
}

// Shown on Pick from 1 December to 31 January, only when the year has plays.
function YearRecapBanner({ onOpen }: Props) {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"
  const year = yearRecapBannerYear(new Date(), timezone)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (year === null || readDismissed(year)) return
    let active = true
    void getYearRecap(year, timezone).then(recap => {
      if (active && recap.total_plays > 0) setVisible(true)
    }).catch(() => { /* A banner is optional; stay hidden on failure. */ })
    return () => { active = false }
  }, [year, timezone])

  if (year === null || !visible) return null

  function dismiss() {
    try { localStorage.setItem(yearRecapDismissKey(year as number), "1") } catch { /* Dismissal is best effort. */ }
    setVisible(false)
  }

  return (
    <aside className="year-recap-banner" aria-label={`${year} Year in Review`}>
      <div>
        <strong>Your {year} in games is ready</strong>
        <span>Step through your year and share it.</span>
      </div>
      <div className="year-recap-banner-actions">
        <button type="button" className="primary-button" onClick={onOpen}>View</button>
        <button type="button" className="ghost-button" onClick={dismiss}>Dismiss</button>
      </div>
    </aside>
  )
}

export default YearRecapBanner
