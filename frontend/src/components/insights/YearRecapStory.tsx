import { createPortal } from "react-dom"
import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react"
import type { YearRecap } from "../../api/client"
import { lightImpact } from "../../haptics"
import {
  formatHours,
  hoursCoverage,
  monthName,
  monthsChartLabel,
  plural,
  slideSummary,
  slideTitle,
  storyProgress,
  weekdayName,
  yearSlideKinds,
  type YearSlideKind,
} from "../../year-recap"

const AUTO_ADVANCE_MS = 8000
const SWIPE_DISTANCE = 40

type Props = {
  recap: YearRecap
  onClose: () => void
  onShare: () => void
}

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false,
  )
  useEffect(() => {
    const query = window.matchMedia?.("(prefers-reduced-motion: reduce)")
    if (!query) return
    const update = () => setReduced(query.matches)
    query.addEventListener("change", update)
    return () => query.removeEventListener("change", update)
  }, [])
  return reduced
}

function SlideBody({ kind, recap }: { kind: YearSlideKind; recap: YearRecap }) {
  switch (kind) {
    case "totals": {
      const coverage = hoursCoverage(recap)
      return (
        <div className="year-story-stats">
          <p><strong>{recap.total_plays}</strong><span>{recap.total_plays === 1 ? "Play" : "Plays"}</span></p>
          <p><strong>{recap.unique_games}</strong><span>{recap.unique_games === 1 ? "Game" : "Games"}</span></p>
          <p>
            <strong>{recap.total_duration_minutes === null ? "Not recorded" : formatHours(recap.total_duration_minutes)}</strong>
            <span>{recap.total_duration_minutes === null ? "Play time" : "Played"}</span>
          </p>
          {coverage && <p className="year-story-note">{coverage}.</p>}
        </div>
      )
    }
    case "top-games":
      return (
        <ol className="year-story-list">
          {recap.top_games.map(game => (
            <li key={game.bgg_id}><span>{game.name}</span><b>{plural(game.play_count, "play")}</b></li>
          ))}
        </ol>
      )
    case "new-games":
      return (
        <>
          <p className="year-story-big">{recap.new_games_count}</p>
          <p className="year-story-note">{recap.new_games_count === 1 ? "game" : "games"} you played for the first time.</p>
          <ul className="year-story-list">
            {recap.new_games.map(game => (
              <li key={game.bgg_id}><span>{game.name}</span><b>{plural(game.play_count, "play")}</b></li>
            ))}
          </ul>
        </>
      )
    case "months":
      return (
        <>
          <p className="year-story-big">{monthName(recap.busiest_month ?? 1)}</p>
          <p className="year-story-note">{plural(recap.plays_by_month[(recap.busiest_month ?? 1) - 1], "play")}</p>
          <div className="year-story-bars" role="img" aria-label={monthsChartLabel(recap)}>
            {(() => {
              const max = Math.max(...recap.plays_by_month, 1)
              return recap.plays_by_month.map((count, index) => (
                <span
                  key={index}
                  className={recap.busiest_month === index + 1 ? "is-peak" : undefined}
                  style={{ height: `${Math.max(count ? 8 : 3, (count / max) * 100)}%` }}
                />
              ))
            })()}
          </div>
          <div className="year-story-bar-labels" aria-hidden="true">
            {recap.plays_by_month.map((_, index) => <span key={index}>{monthName(index + 1).slice(0, 1)}</span>)}
          </div>
        </>
      )
    case "weekday":
      return (
        <>
          <p className="year-story-big">{weekdayName(recap.busiest_weekday ?? 1)}s</p>
          <p className="year-story-note">{plural(recap.plays_by_weekday[(recap.busiest_weekday ?? 1) - 1], "play")} on your busiest day.</p>
        </>
      )
    case "longest":
      return recap.longest_play && (
        <>
          <p className="year-story-big">{formatHours(recap.longest_play.duration_minutes)}</p>
          <p className="year-story-note">{recap.longest_play.name}</p>
        </>
      )
    case "co-players":
      return (
        <ol className="year-story-list">
          {recap.co_players.map(player => (
            <li key={player.name}><span>{player.name}</span><b>{plural(player.play_count, "play")}</b></li>
          ))}
        </ol>
      )
    case "closing":
      return <p className="year-story-note">Share a picture of your year. Player names stay out unless you add them.</p>
  }
}

function YearRecapStory({ recap, onClose, onShare }: Props) {
  const kinds = yearSlideKinds(recap)
  const reducedMotion = usePrefersReducedMotion()
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const pointerStart = useRef<number | null>(null)
  const last = kinds.length - 1

  useEffect(() => { rootRef.current?.focus() }, [])

  const goTo = useCallback((next: number) => {
    if (next < 0 || next > last) return
    setIndex(next)
    void lightImpact()
  }, [last])

  // Auto-advance is off for reduced motion and while paused; it stops on the last slide.
  useEffect(() => {
    if (reducedMotion || paused || index >= last) return
    const timer = window.setTimeout(() => goTo(index + 1), AUTO_ADVANCE_MS)
    return () => window.clearTimeout(timer)
  }, [index, last, reducedMotion, paused, goTo])

  function onKeyDown(event: KeyboardEvent) {
    if (event.key === "ArrowRight") goTo(index + 1)
    else if (event.key === "ArrowLeft") goTo(index - 1)
    else if (event.key === "Escape") onClose()
  }

  function onPointerUp(event: PointerEvent<HTMLDivElement>) {
    const start = pointerStart.current
    pointerStart.current = null
    if (start === null) return
    const distance = event.clientX - start
    if (Math.abs(distance) >= SWIPE_DISTANCE) {
      goTo(distance < 0 ? index + 1 : index - 1)
      return
    }
    const bounds = event.currentTarget.getBoundingClientRect()
    goTo(event.clientX - bounds.left < bounds.width / 3 ? index - 1 : index + 1)
  }

  const kind = kinds[index]
  const title = slideTitle(kind, recap)
  const progress = storyProgress(kinds, index)

  // Portalled so it sits above the app header and tab bar, which have their own stacking contexts.
  return createPortal(
    <div
      ref={rootRef}
      className={`year-story${reducedMotion ? " is-reduced-motion" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-label={`${recap.year} Year in Review`}
      tabIndex={-1}
      onKeyDown={onKeyDown}
    >
      <div className="year-story-progress" role="presentation">
        {progress.segments.map((segment, position) => (
          <span
            key={kinds[position]}
            className={segment === "upcoming" ? undefined : `is-${segment}`}
          >
            {segment === "current" && !reducedMotion && !paused && index < last && (
              <i key={index} style={{ animationDuration: `${AUTO_ADVANCE_MS}ms` }} />
            )}
          </span>
        ))}
      </div>
      <div className="year-story-bar">
        <p aria-hidden="true">{progress.counter}</p>
        <div>
          {!reducedMotion && index < last && (
            <button type="button" className="ghost-button" aria-pressed={paused} onClick={() => setPaused(value => !value)}>
              {paused ? "Play" : "Pause"}
            </button>
          )}
          <button type="button" className="ghost-button" onClick={onClose}>Close</button>
        </div>
      </div>

      <div
        className="year-story-stage"
        onPointerDown={event => { pointerStart.current = event.clientX }}
        onPointerCancel={() => { pointerStart.current = null }}
        onPointerUp={onPointerUp}
      >
        <section
          key={kind}
          className="year-story-slide"
          role="group"
          aria-roledescription="slide"
          aria-label={`${progress.counter}: ${title}. ${slideSummary(kind, recap)}`}
        >
          <h2>{title}</h2>
          <SlideBody kind={kind} recap={recap} />
        </section>
      </div>

      <div className="year-story-controls">
        <button type="button" className="secondary-button" disabled={index === 0} onClick={() => goTo(index - 1)}>
          <span aria-hidden="true">‹ </span>Previous
        </button>
        {index === last
          ? <button type="button" className="primary-button" onClick={onShare}>Share my year</button>
          : <button type="button" className="primary-button" onClick={() => goTo(index + 1)}>Next<span aria-hidden="true"> ›</span></button>}
      </div>
    </div>,
    document.body,
  )
}

export default YearRecapStory
