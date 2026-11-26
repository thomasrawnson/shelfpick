import { useId, useState } from "react"
import { formatPlayerCount } from "../../player-count"

import type {
  Game,
  GameHistory as GameHistoryData,
  GamePlay,
} from "../../api/client"
import { displayTerms, shownTerms, TERM_LIMIT } from "../../detail-terms"
import { metaLine, minutesOrDash, scaled } from "../../game-detail-format"
import { useCoverAccent } from "../../use-cover-accent"
import { rematchPrefill, type PlayPrefill } from "../../play-results"

import ResilientGameArtwork from "../ResilientGameArtwork"
import ConfirmSheet from "../ui/ConfirmSheet"
import OverflowMenu from "../ui/OverflowMenu"
import GameHistory from "./GameHistory"
import { LogPlayButton } from "./PlayLogForm"

type Props = {
  game: Game
  history: GameHistoryData | null
  historyLoading: boolean
  onBack: () => void
  onPlaySaved: () => Promise<void>
  onRemove: () => Promise<void>
}

// Mechanics or categories: plain secondary text, the first six, and Show all when there are more.
function Terms({ label, terms }: { label: string; terms: readonly string[] }) {
  const [expanded, setExpanded] = useState(false)
  const listId = useId()
  const visible = displayTerms(terms)
  if (visible.length === 0) return null
  const shown = shownTerms(visible, expanded)

  return (
    <section className="detail-block" aria-label={label}>
      <h2 className="section-label">{label}</h2>
      <ul className="detail-terms" id={listId}>
        {shown.map((term) => <li key={term}>{term}</li>)}
      </ul>
      {visible.length > TERM_LIMIT && (
        <button
          type="button"
          className="text-action"
          aria-expanded={expanded}
          aria-controls={listId}
          onClick={() => setExpanded((current) => !current)}
        >
          {expanded ? "Show fewer" : `Show all ${visible.length}`}
        </button>
      )}
    </section>
  )
}

function Metric({ label, value, scale }: { label: string; value: string; scale?: string | null }) {
  return (
    <div className="detail-metric">
      <strong>{value}{scale && <span className="detail-scale">{scale}</span>}</strong>
      <span>{label}</span>
    </div>
  )
}

function GameDetail({
  game,
  history,
  historyLoading,
  onBack,
  onPlaySaved,
  onRemove,
}: Props) {
  const accentStyle = useCoverAccent(game.image_url ?? game.thumbnail_url, game.name)
  const [confirmingRemove, setConfirmingRemove] = useState(false)
  const [rematch, setRematch] = useState<{ key: number; prefill: PlayPrefill } | null>(null)
  const [removing, setRemoving] = useState(false)
  const [removeError, setRemoveError] = useState("")

  async function confirmRemove() {
    setRemoving(true)
    setRemoveError("")

    try {
      await onRemove()
    } catch (err) {
      console.error(err)
      setRemoveError("Couldn't remove this game from your collection.")
      setRemoving(false)
      setConfirmingRemove(false)
    }
  }

  const rating = scaled(game.rating, 10)
  const weight = scaled(game.complexity, 5)
  const meta = metaLine(formatPlayerCount(game.min_players, game.max_players), game.max_play_time)

  return (
    <section className="screen tab-screen collection-screen game-detail-screen">
      <div className="detail-nav">
        <button type="button" className="text-action detail-back" onClick={onBack}>
          <span aria-hidden="true">←</span> Back to shelf
        </button>
        <OverflowMenu
          label={`More options for ${game.name}`}
          items={[{
            key: "remove",
            label: "Remove from collection",
            destructive: true,
            onSelect: () => setConfirmingRemove(true),
          }]}
        />
      </div>

      <article className="game-detail has-cover-accent" style={accentStyle}>
        <div className="detail-hero">
          <div className="detail-cover">
            <ResilientGameArtwork
              src={game.image_url ?? game.thumbnail_url}
              alt={`Cover of ${game.name}`}
              gameName={game.name}
            />
          </div>

          <div className="detail-title">
            <p className="detail-year">{game.year_published ?? "Board game"}</p>
            <h1>{game.name}</h1>
            {meta && <p className="detail-meta">{meta}</p>}
          </div>
        </div>

        <LogPlayButton
          key={rematch?.key ?? 0}
          game={game}
          onSaved={onPlaySaved}
          defaultOpen={rematch !== null}
          initialPlayerCount={rematch?.prefill.names.length}
          initialPlayerNames={rematch?.prefill.names}
          initialTeams={rematch?.prefill.teams}
          initialOutcomeType={rematch?.prefill.outcomeType}
          initialLocation={rematch?.prefill.location}
        />

        <div className="detail-metrics">
          <Metric label="Rating" value={rating.value} scale={rating.scale} />
          <Metric label="Weight" value={weight.value} scale={weight.scale} />
          <Metric label="Minutes" value={minutesOrDash(game.max_play_time)} />
        </div>

        <Terms label="Categories" terms={game.categories} />
        <Terms label="Mechanics" terms={game.mechanics} />

        <GameHistory
          game={game}
          history={history}
          loading={historyLoading}
          onPlayDeleted={onPlaySaved}
          onPlayEdited={onPlaySaved}
          onRematch={(play: GamePlay) => {
            setRematch({
              key: (rematch?.key ?? 0) + 1,
              prefill: rematchPrefill(play),
            })
            window.scrollTo({ top: 0, behavior: "smooth" })
          }}
        />

        {removeError && <p className="error-message" role="alert">{removeError}</p>}
      </article>

      {confirmingRemove && (
        <ConfirmSheet
          title={`Remove ${game.name}?`}
          confirmLabel="Remove from collection"
          busyLabel="Removing…"
          busy={removing}
          onConfirm={() => { void confirmRemove() }}
          onCancel={() => setConfirmingRemove(false)}
        >
          {game.name} leaves your shelf. Plays you logged for it stay in your history.
        </ConfirmSheet>
      )}
    </section>
  )
}

export default GameDetail
