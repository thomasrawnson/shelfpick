import { useState } from "react"

import type {
  Game,
  GameHistory as GameHistoryData,
  GamePlay,
} from "../../api/client"
import { useCoverAccent } from "../../use-cover-accent"
import { rematchPrefill, type PlayPrefill } from "../../play-results"

import ResilientGameArtwork from "../ResilientGameArtwork"
import GameHistory from "./GameHistory"
import PlayLogForm from "./PlayLogForm"

type Props = {
  game: Game
  history: GameHistoryData | null
  historyLoading: boolean
  onBack: () => void
  onPlaySaved: () => Promise<void>
  onRemove: () => Promise<void>
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

  const [
    confirmingRemove,
    setConfirmingRemove,
  ] = useState(false)

  const [rematch, setRematch] = useState<{
    key: number
    prefill: PlayPrefill
  } | null>(null)

  const [
    removing,
    setRemoving,
  ] = useState(false)

  const [
    removeError,
    setRemoveError,
  ] = useState("")

  async function confirmRemove() {
    setRemoving(true)
    setRemoveError("")

    try {
      await onRemove()
    } catch (err) {
      console.error(err)

      setRemoveError(
        "Couldn't remove this game from your collection.",
      )

      setRemoving(false)
      setConfirmingRemove(false)
    }
  }

  return (
    <section className="screen collection-screen">
      <button
        type="button"
        className="collection-back"
        onClick={onBack}
      >
        ← Back to shelf
      </button>

      <article className="collection-detail has-cover-accent" style={accentStyle}>
        <div className="collection-detail-image">
          <ResilientGameArtwork
            src={game.image_url ?? game.thumbnail_url}
            alt={`Cover of ${game.name}`}
            gameName={game.name}
          />
        </div>

        <div className="collection-detail-heading">
          <p className="eyebrow">
            {game.year_published ??
              "Board game"}
          </p>

          <h1>{game.name}</h1>
        </div>

        <div className="detail-stats">
          <div>
            <strong>
              {game.rating?.toFixed(
                1,
              ) ?? "—"}
            </strong>

            <span>Rating</span>
          </div>

          <div>
            <strong>
              {game.complexity?.toFixed(
                1,
              ) ?? "—"}
            </strong>

            <span>Weight</span>
          </div>

          <div>
            <strong>
              {game.max_play_time ??
                "—"}
            </strong>

            <span>Minutes</span>
          </div>
        </div>

        <PlayLogForm
          key={rematch?.key ?? 0}
          game={game}
          onSaved={onPlaySaved}
          initialOpen={rematch !== null}
          initialPlayerCount={rematch?.prefill.names.length}
          initialPlayerNames={rematch?.prefill.names}
          initialTeams={rematch?.prefill.teams}
          initialOutcomeType={rematch?.prefill.outcomeType}
          initialLocation={rematch?.prefill.location}
        />

        <div className="detail-section">
          <p className="preference-label">
            Players
          </p>

          <p>
            {game.min_players ?? "?"}
            –
            {game.max_players ?? "?"}
          </p>
        </div>

        {game.categories.length >
          0 && (
          <div className="detail-section">
            <p className="preference-label">
              Categories
            </p>

            <div className="detail-tags">
              {game.categories.map(
                (category) => (
                  <span
                    key={category}
                  >
                    {category}
                  </span>
                ),
              )}
            </div>
          </div>
        )}

        {game.mechanics.length >
          0 && (
          <div className="detail-section">
            <p className="preference-label">
              Mechanics
            </p>

            <div className="detail-tags">
              {game.mechanics.map(
                (mechanic) => (
                  <span
                    key={mechanic}
                  >
                    {mechanic}
                  </span>
                ),
              )}
            </div>
          </div>
        )}

        <GameHistory
          game={game}
          history={history}
          loading={
            historyLoading
          }
          onPlayDeleted={
            onPlaySaved
          }
          onPlayEdited={
            onPlaySaved
          }
          onRematch={(play: GamePlay) => {
            setRematch({
              key: (rematch?.key ?? 0) + 1,
              prefill: rematchPrefill(play),
            })
            window.scrollTo({ top: 0, behavior: "smooth" })
          }}
        />

        <div className="detail-section collection-danger-zone">
          {confirmingRemove ? (
            <div className="remove-collection-confirm">
              <span>
                Remove {game.name}{" "}
                from your collection?
              </span>

              <div className="remove-collection-confirm-actions">
                <button
                  type="button"
                  className="ghost-button"
                  disabled={removing}
                  onClick={() =>
                    setConfirmingRemove(
                      false,
                    )
                  }
                >
                  Cancel
                </button>

                <button
                  type="button"
                  className="remove-collection-button"
                  disabled={removing}
                  onClick={
                    confirmRemove
                  }
                >
                  {removing
                    ? "Removing..."
                    : "Remove from collection"}
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              className="remove-collection-button"
              onClick={() =>
                setConfirmingRemove(
                  true,
                )
              }
            >
              Remove from collection
            </button>
          )}

          {removeError && (
            <p className="error-message">
              {removeError}
            </p>
          )}
        </div>
      </article>
    </section>
  )
}

export default GameDetail
