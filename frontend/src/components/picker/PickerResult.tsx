import {
  useRef,
  useState,
  type TouchEvent,
} from "react"

import type {
  PickerMatch,
  PickerMode,
} from "../../api/client"

import Disclosure
  from "../ui/Disclosure"


type Props = {
  match: PickerMatch
  matchIndex: number
  totalMatches: number
  mode: PickerMode
  playerCount: number
  hasMoreMatches: boolean
  onTryAnother: () => void
  onViewGame: () => void
  onStartOver: () => void
  onLogPlay: () => void
  playSavedMessage?: string
}


function modeLabel(
  mode: PickerMode,
) {
  if (mode === "different") {
    return "Something different"
  }

  if (mode === "surprise") {
    return "Surprise pick"
  }

  return "Tonight's pick"
}


function ShareIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M14 5h5v5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M10 14 19 5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M19 13v4a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}


function PickerResult({
  match,
  matchIndex,
  totalMatches,
  mode,
  playerCount,
  hasMoreMatches,
  onTryAnother,
  onViewGame,
  onStartOver,
  onLogPlay,
  playSavedMessage = "",
}: Props) {
  const [shareMessage, setShareMessage] =
    useState("")

  const touchStartX =
    useRef<number | null>(null)

  const game = match.game
  const coverUrl =
    game.image_url ?? game.thumbnail_url ?? null

  const playerText =
    game.min_players !== null
    && game.max_players !== null
      ? game.min_players === game.max_players
        ? `${game.min_players} players`
        : `${game.min_players}–${game.max_players} players`
      : null

  const timeText =
    game.max_play_time !== null
      ? game.min_play_time !== null
        && game.min_play_time === game.max_play_time
        ? `${game.max_play_time} min`
        : `${game.min_play_time ?? "?"}–${game.max_play_time} min`
      : null

  const weightText =
    game.complexity !== null
      ? game.complexity <= 2
        ? "Light"
        : game.complexity <= 3
          ? "Medium"
          : "Heavy"
      : null

  const score = Math.round(match.score)
  const primaryReason =
    match.reasons.find(
      (reason) => !/^Supports?\s+\d+\s+player/i.test(reason)
    )
    ?? (
      match.ai_used
      && match.ai_explanation
        ? match.ai_explanation
        : match.reasons[0] ?? null
    )

  const bestAtText =
    `Best at ${playerCount} player${
      playerCount === 1 ? "" : "s"
    }`

  const contextualPlayerText =
    game.min_players === playerCount
    && game.max_players === playerCount
      ? bestAtText
      : playerText
        ? `${playerText} · ${bestAtText}`
        : bestAtText

  const additionalReasons = match.reasons
    .filter((reason) => reason !== primaryReason)
    .slice(0, 3)

  const additionalAiReason =
    match.ai_used
    && match.ai_explanation
    && match.ai_explanation !== primaryReason
      ? match.ai_explanation
      : null


  async function sharePick() {
    const reason =
      match.ai_used
      && match.ai_explanation
        ? match.ai_explanation
        : match.reasons[0]

    const text = [
      `Tonight's pick: ${game.name}`,
      `${playerCount} player${
        playerCount === 1 ? "" : "s"
      }`,
      reason ? `Why: ${reason}` : null,
      "Picked with ShelfPick",
    ]
      .filter(Boolean)
      .join("\n")

    setShareMessage("")

    try {
      if (navigator.share) {
        await navigator.share({
          title: game.name,
          text,
        })
        setShareMessage("Pick shared.")
        return
      }

      await navigator.clipboard.writeText(text)
      setShareMessage("Pick copied.")
    } catch (err) {
      if (
        err instanceof DOMException
        && err.name === "AbortError"
      ) {
        return
      }

      console.error(err)
      setShareMessage(
        "Couldn't share this pick.",
      )
    }
  }

  function handleTouchStart(
    event: TouchEvent<HTMLElement>,
  ) {
    touchStartX.current =
      event.changedTouches[0]?.clientX ?? null
  }

  function handleTouchEnd(
    event: TouchEvent<HTMLElement>,
  ) {
    const startX = touchStartX.current
    const endX =
      event.changedTouches[0]?.clientX ?? null

    touchStartX.current = null

    if (
      startX === null
      || endX === null
      || !hasMoreMatches
    ) {
      return
    }

    if (startX - endX > 70) {
      onTryAnother()
    }
  }


  return (
    <section
      className="screen reveal-screen picker-result-card"
      aria-labelledby="picker-result-title"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div className="picker-result-heading-row">
        <p className="picker-result-mode">
          {modeLabel(mode)}
        </p>

        <button
          type="button"
          className="picker-share-icon-button"
          onClick={sharePick}
          aria-label={`Share ${game.name}`}
          title="Share"
        >
          <ShareIcon />
        </button>
      </div>

      <button
        type="button"
        className="picker-hero-link"
        onClick={onViewGame}
        aria-label={`View ${game.name}`}
      >
        <div className="picker-cover-wrap">
          {coverUrl ? (
            <img
              className="picker-cover-image"
              src={coverUrl}
              alt=""
            />
          ) : (
            <div
              className="picker-cover-placeholder"
              aria-hidden="true"
            >
              Cover art
            </div>
          )}
        </div>

        <div className="picker-result-status">
          <span
            className="picker-result-score"
            aria-label={`Match score ${score}`}
          >
            <strong>{score}</strong>
            <span>match</span>
          </span>

          <span className="picker-result-counter">
            Pick {matchIndex + 1} of {totalMatches}
          </span>
        </div>

        <div className="picker-result-copy">
          <h2
            id="picker-result-title"
            className="picker-result-title"
          >
            {game.name}
          </h2>

          <span className="picker-view-game">
            View game details
          </span>
        </div>
      </button>

      {primaryReason && (
        <div className="picker-fit-summary">
          <p className="picker-fit-label">
            Why it fits
          </p>
          <p className="picker-primary-reason">
            {primaryReason}
          </p>
        </div>
      )}

      <div
        className="picker-result-meta"
        aria-label="Game fit"
      >
        {contextualPlayerText && (
          <span>{contextualPlayerText}</span>
        )}
        {contextualPlayerText && timeText && <span>·</span>}
        {timeText && <span>{timeText}</span>}
        {(contextualPlayerText || timeText) && weightText && (
          <span>·</span>
        )}
        {weightText && <span>{weightText}</span>}
      </div>

      {(additionalReasons.length > 0 || additionalAiReason) && (
        <Disclosure
          label="More reasons"
          className="picker-reason-details"
        >
          <div className="picker-reason-detail-body">
            {additionalAiReason && (
              <p>
                {additionalAiReason}
              </p>
            )}

            {additionalReasons.length > 0 && (
              <ul>
                {additionalReasons.map((reason) => (
                  <li key={reason}>
                    {reason}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Disclosure>
      )}

      <div className="picker-primary-action">
        <button
          type="button"
          className="primary-button log-play-button"
          onClick={onLogPlay}
        >
          Log a play
        </button>
      </div>

      {playSavedMessage && (
        <p className="play-confirmation" role="status">
          {playSavedMessage}
        </p>
      )}

      <div className="picker-result-footer">
        <button
          type="button"
          className="try-another-link"
          onClick={onTryAnother}
          disabled={!hasMoreMatches}
        >
          {hasMoreMatches
            ? "Try another"
            : "No more matches"}
        </button>
      </div>

      {shareMessage && (
        <p className="share-message" role="status">
          {shareMessage}
        </p>
      )}

      {!hasMoreMatches
        && totalMatches > 1 && (
        <p className="picker-exhausted">
          You've seen every matching game.
        </p>
      )}

      <button
        type="button"
        className="picker-start-over"
        onClick={onStartOver}
      >
        Start over
      </button>
    </section>
  )
}


export default PickerResult
