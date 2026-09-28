import { useEffect, useRef, useState } from "react"

import {
  addToWishlist,
  getDiscoverRecommendations,
  removeFromWishlist,
  type DiscoverMode,
  type DiscoverPersonalisationSignal,
  type DiscoverPersonalisationStatus,
  type DiscoverRecommendation,
} from "../api/client"
import RetryNotice from "./ui/RetryNotice"
import { trackEvent } from "../telemetry"
import { discoverEmptyCopy, discoverPersonalisationCopy } from "../discover-state"


type Props = {
  personalized: boolean
  onViewWishlist: () => void
  onUnlockPro: () => void
  onPersonalize: () => void
}

const tabs: Array<{ mode: DiscoverMode; label: string }> = [
  { mode: "hot", label: "Hot" },
  { mode: "top100", label: "Top 100" },
  { mode: "for_you", label: "For You" },
]

function recommendationLabel(
  mode: DiscoverMode,
  recommendation: DiscoverRecommendation,
  index: number,
) {
  if (mode === "hot") return "Hot now"
  if (mode === "top100" && recommendation.source_rank) {
    return `#${recommendation.source_rank}`
  }
  if (index === 0) return "Top match"
  if (index < 3) return "Strong match"
  return "Good fit"
}

function complexityLabel(value: number | null | undefined) {
  if (value == null) return null
  if (value <= 2) return "Light"
  if (value <= 3) return "Medium"
  if (value <= 4) return "Heavy"
  return "Very heavy"
}

function DiscoverView({ personalized, onViewWishlist, onUnlockPro, onPersonalize }: Props) {
  const [mode, setMode] = useState<DiscoverMode>("hot")
  const [recommendations, setRecommendations] = useState<DiscoverRecommendation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [updatingIds, setUpdatingIds] = useState<Set<number>>(new Set())
  const [actionError, setActionError] = useState("")
  const [reloadKey, setReloadKey] = useState(0)
  const [dismissedCount, setDismissedCount] = useState(0)
  const [personalisationStatus, setPersonalisationStatus] =
    useState<DiscoverPersonalisationStatus>("unknown")
  const [personalisationSignals, setPersonalisationSignals] =
    useState<DiscoverPersonalisationSignal[]>([])
  const pendingIds = useRef(new Set<number>())
  const lastTrackedTab = useRef<DiscoverMode | null>(null)

  useEffect(() => {
    if (lastTrackedTab.current === mode) return
    lastTrackedTab.current = mode
    trackEvent("discover_opened", {
      source: "discover", tab: mode === "top100" ? "top500" : mode,
    })
  }, [mode])

  useEffect(() => {
    if (mode === "for_you" && !personalized) return

    let cancelled = false
    getDiscoverRecommendations(mode)
      .then((result) => {
        if (!cancelled) {
          setRecommendations(result.recommendations)
          setPersonalisationStatus(result.personalisation.status)
          setPersonalisationSignals(result.personalisation.signals)
          setDismissedCount(0)
          setError("")
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Couldn't load recommendations.")
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [mode, personalized, reloadKey])

  function selectMode(nextMode: DiscoverMode) {
    if (nextMode === mode) return
    setMode(nextMode)
    setRecommendations([])
    setError("")
    setActionError("")
    setDismissedCount(0)
    setPersonalisationStatus("unknown")
    setPersonalisationSignals([])
    setLoading(nextMode !== "for_you" || personalized)
  }

  function retry() {
    setLoading(true)
    setReloadKey((current) => current + 1)
  }

  async function toggleWishlist(recommendation: DiscoverRecommendation) {
    const bggId = recommendation.game.bgg_id
    if (pendingIds.current.has(bggId)) return
    pendingIds.current.add(bggId)
    const wasWishlisted = recommendation.wishlisted

    setActionError("")
    setUpdatingIds((current) => new Set(current).add(bggId))
    setRecommendations((current) => current.map((item) => (
      item.game.bgg_id === bggId
        ? { ...item, wishlisted: !wasWishlisted }
        : item
    )))

    try {
      if (wasWishlisted) await removeFromWishlist(bggId)
      else {
        await addToWishlist(bggId)
        trackEvent("wishlist_added", { source: "discover" })
      }
    } catch (err) {
      setRecommendations((current) => current.map((item) => (
        item.game.bgg_id === bggId
          ? { ...item, wishlisted: wasWishlisted }
          : item
      )))
      setActionError(
        err instanceof Error ? err.message : "Couldn't update Want to Play.",
      )
    } finally {
      pendingIds.current.delete(bggId)
      setUpdatingIds((current) => {
        const next = new Set(current)
        next.delete(bggId)
        return next
      })
    }
  }

  function dismissRecommendation(bggId: number) {
    setRecommendations((current) => current.filter(
      (item) => item.game.bgg_id !== bggId,
    ))
    setDismissedCount((current) => current + 1)
  }

  const groupedRecommendations = recommendations.reduce<Map<string, DiscoverRecommendation[]>>(
    (groups, recommendation) => {
      const section = recommendation.section ?? "Games to discover"
      groups.set(section, [...(groups.get(section) ?? []), recommendation])
      return groups
    },
    new Map(),
  )
  const emptyCopy = discoverEmptyCopy(mode, dismissedCount > 0)
  const personalisationCopy = discoverPersonalisationCopy(
    personalisationStatus,
    personalisationSignals,
  )

  function renderCard(recommendation: DiscoverRecommendation, index: number) {
    const { game, reasons, wishlisted } = recommendation
    const complexity = complexityLabel(game.complexity)

    return (
      <article key={game.bgg_id} className="discover-card">
        <button
          type="button"
          className={wishlisted ? "discover-save-button saved" : "discover-save-button"}
          aria-label={wishlisted
            ? `Remove ${game.name} from Want to Play`
            : `Save ${game.name} to Want to Play`}
          aria-pressed={wishlisted}
          title={wishlisted ? "Remove from Want to Play" : "Save to Want to Play"}
          disabled={updatingIds.has(game.bgg_id)}
          onClick={() => { void toggleWishlist(recommendation) }}
        >
          {wishlisted ? "✓" : "+"}
        </button>

        <div className="discover-media">
          {game.image_url ? (
            <img className="discover-image" src={game.image_url} alt="" />
          ) : (
            <div className="discover-image-placeholder" aria-hidden="true">?</div>
          )}
        </div>

        <div className="discover-copy">
          <h2>{game.name}</h2>
          <p className="discover-meta">
            {game.min_players}–{game.max_players} players
            {game.max_play_time ? ` · ${game.max_play_time} min` : ""}
            {complexity ? ` · ${complexity}` : ""}
          </p>
          <span className="discover-match-pill">
            {recommendationLabel(mode, recommendation, index)}
          </span>
          {reasons.length > 0 && (
            <details className="discover-reason-details">
              <summary>Why this match?</summary>
              <ul className="discover-reasons">
                {reasons.map((reason) => <li key={reason}>{reason}</li>)}
              </ul>
            </details>
          )}
          <div className="discover-actions">
            <a
              className="discover-bgg-link"
              href={`https://boardgamegeek.com/boardgame/${game.bgg_id}`}
              target="_blank"
              rel="noreferrer"
            >
              View on BGG
            </a>
            <button
              type="button"
              className="discover-dismiss-button"
              onClick={() => dismissRecommendation(game.bgg_id)}
            >
              Not interested
            </button>
          </div>
        </div>
      </article>
    )
  }

  return (
    <section className="screen discover-screen">
      <header className="discover-header">
        <div>
          <h1>Discover games</h1>
        </div>
        <button type="button" className="discover-wishlist-link" onClick={onViewWishlist}>
          Want to Play <span aria-hidden="true">→</span>
        </button>
      </header>

      <div className="discover-tabs" role="tablist" aria-label="Discover lists">
        {tabs.map((tab) => (
          <button
            key={tab.mode}
            type="button"
            role="tab"
            aria-selected={mode === tab.mode}
            className={mode === tab.mode ? "discover-tab active" : "discover-tab"}
            onClick={() => selectMode(tab.mode)}
          >
            {tab.label}
            {tab.mode === "for_you" && !personalized && (
              <span className="discover-pro-badge">Pro</span>
            )}
          </button>
        ))}
      </div>

      {mode === "for_you" && !personalized ? (
        <div className="discover-locked">
          <h2>For You is a Pro feature</h2>
          <p>
            For You can use your Owned shelf, saved play preferences and recorded
            plays to surface games that fit how you play.
          </p>
          <button type="button" className="primary-button" onClick={onUnlockPro}>
            Compare Free and Pro
          </button>
        </div>
      ) : (
        <>
          {loading && <p className="subtitle">Finding games...</p>}
          {error && <RetryNotice message={error} busy={loading} onRetry={retry} />}
          {actionError && <p className="error-message" role="alert">{actionError}</p>}
          {mode === "for_you" && recommendations.length > 0 && personalisationStatus === "personalised" && (
            <section className="discover-personalisation-note" aria-labelledby="discover-personalised-heading">
              <h2 id="discover-personalised-heading">{personalisationCopy?.title}</h2>
              <p>{personalisationCopy?.body}</p>
            </section>
          )}
          {mode === "for_you" && recommendations.length > 0 && personalisationStatus === "popular_fallback" && (
            <section className="discover-personalisation-note" aria-labelledby="discover-fallback-heading">
              <div>
                <h2 id="discover-fallback-heading">{personalisationCopy?.title}</h2>
                <p>{personalisationCopy?.body}</p>
              </div>
              <button type="button" className="secondary-button" onClick={onPersonalize}>
                {personalisationCopy?.actionLabel}
              </button>
            </section>
          )}
          {!loading && !error && recommendations.length === 0 && (
            <div className="discover-empty">
              <h2>{emptyCopy.title}</h2>
              <p>{emptyCopy.body}</p>
              <button
                type="button"
                className="secondary-button"
                onClick={() => {
                  if (emptyCopy.actionMode === mode) {
                    retry()
                    return
                  }

                  selectMode(emptyCopy.actionMode)
                }}
              >
                {emptyCopy.actionLabel}
              </button>
            </div>
          )}

          {mode === "for_you" ? (
            <div className="discover-sections">
              {[...groupedRecommendations.entries()].map(([section, games]) => (
                <section key={section} className="discover-section">
                  <h2>{section}</h2>
                  <div className="discover-list">
                    {games.map((game, index) => renderCard(game, index))}
                  </div>
                </section>
              ))}
            </div>
          ) : (
            <div className="discover-list">
              {recommendations.map((game, index) => renderCard(game, index))}
            </div>
          )}
        </>
      )}
    </section>
  )
}


export default DiscoverView
