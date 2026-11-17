import {
  useEffect,
  useState,
} from "react"

import {
  getRankings,
  type RankingSummary,
} from "../../api/client"
import { Link } from "react-router-dom"
import { APP_PATHS } from "../../routes"


function RankingCategorySummary() {
  const [
    summary,
    setSummary,
  ] = useState<RankingSummary | null>(
    null,
  )

  const [
    error,
    setError,
  ] = useState("")


  useEffect(() => {
    let active = true

    getRankings(
      true,
      20,
    )
      .then((result) => {
        if (active) {
          setSummary(result.summary)
        }
      })
      .catch((err) => {
        console.error(err)

        if (active) {
          setError(
            "Couldn't load shelf rankings.",
          )
        }
      })

    return () => {
      active = false
    }
  }, [])


  if (error) {
    return (
      <p className="error-message">
        {error}
      </p>
    )
  }

  if (!summary) {
    return null
  }


  const leaders = ([
    ["Publishers", summary.publishers],
    ["Designers", summary.designers],
    ["Mechanics", summary.mechanics],
    ["Categories", summary.categories],
  ] as const).filter(([, items]) => items.length > 0)

  // Publisher, designer, mechanic and category data arrives with a BGG sync.
  if (leaders.length === 0) {
    return (
      <section className="stats-sync-note" aria-labelledby="stats-sync-note-title">
        <h2 id="stats-sync-note-title">Shelf details</h2>
        <p>
          Sync your BoardGameGeek collection to see your top publishers, designers, mechanics and categories.
        </p>
        <Link className="stats-action-link" to={APP_PATHS.settingsCollectionData}>
          Sync collection
        </Link>
      </section>
    )
  }


  return (
    <section>
      <div className="stats-section-heading">
        <h2>
          Shelf leaders
        </h2>
      </div>

      <div className="rank-summary-grid">
        {leaders.map(
          ([label, items]) => (
            <article
              className="rank-summary-card"
              key={label}
            >
              <p className="insight-label">
                Top {label}
              </p>

              <ol>
                {items.map(
                  (item) => (
                    <li key={item.name}>
                      <span>
                        {item.name}
                      </span>
                      <strong>
                        {item.count}
                      </strong>
                    </li>
                  ),
                )}
              </ol>
            </article>
          ),
        )}
      </div>
    </section>
  )
}


export default RankingCategorySummary
