import { useState } from "react"
import { formatPlayerCount } from "../../player-count"

import {
  moveWishlistGameToCollection,
  type Game,
} from "../../api/client"
import { Analytics } from "../../analytics"
import ResilientGameArtwork from "../ResilientGameArtwork"


type Props = {
  game: Game
  onBack: () => void
  onRemove: () => Promise<void>
  onConverted: (game: Game) => void
}


function WishlistGameDetail({
  game,
  onBack,
  onRemove,
  onConverted,
}: Props) {
  const [confirmingAdd, setConfirmingAdd] = useState(false)
  const [adding, setAdding] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [error, setError] = useState("")

  async function addToCollection() {
    if (adding || removing) {
      return
    }

    setAdding(true)
    setError("")

    try {
      const converted =
        await moveWishlistGameToCollection(game.bgg_id)
      Analytics.track("game_added", { source: "wishlist_move" })
      onConverted(converted)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Couldn't add that game to your collection.",
      )
      setAdding(false)
    }
  }

  async function removeSavedGame() {
    if (adding || removing) {
      return
    }

    setRemoving(true)
    setError("")

    try {
      await onRemove()
      onBack()
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Couldn't remove that game.",
      )
      setRemoving(false)
    }
  }

  return (
    <section className="wishlist-detail">
      <button
        type="button"
        className="collection-back"
        onClick={onBack}
      >
        ← Back to Want to Play
      </button>

      <article className="collection-detail">
        <div className="collection-detail-image">
          <ResilientGameArtwork
            src={game.image_url ?? game.thumbnail_url}
            alt={`Cover of ${game.name}`}
            gameName={game.name}
          />
        </div>

        <div className="collection-detail-heading">
          <p className="eyebrow">
            {game.year_published ?? "Board game"}
          </p>
          <h1>{game.name}</h1>
          <p className="wishlist-status">Want to Play</p>
        </div>

        <div className="detail-stats">
          <div>
            <strong>{game.rating?.toFixed(1) ?? "—"}</strong>
            <span>Rating</span>
          </div>
          <div>
            <strong>{game.complexity?.toFixed(1) ?? "—"}</strong>
            <span>Weight</span>
          </div>
          <div>
            <strong>{game.max_play_time ?? "—"}</strong>
            <span>Minutes</span>
          </div>
        </div>

        <div className="detail-section">
          <p className="preference-label">Players</p>
          <p>{formatPlayerCount(game.min_players, game.max_players) ?? "Unknown"}</p>
        </div>

        {game.categories.length > 0 && (
          <div className="detail-section">
            <p className="preference-label">Categories</p>
            <div className="detail-tags">
              {game.categories.map((category) => (
                <span key={category}>{category}</span>
              ))}
            </div>
          </div>
        )}

        {game.mechanics.length > 0 && (
          <div className="detail-section">
            <p className="preference-label">Mechanics</p>
            <div className="detail-tags">
              {game.mechanics.map((mechanic) => (
                <span key={mechanic}>{mechanic}</span>
              ))}
            </div>
          </div>
        )}

        <div className="wishlist-detail-actions">
          {confirmingAdd ? (
            <div className="wishlist-add-confirm">
              <p>
                Add {game.name} to your owned collection? It will be
                removed from Want to Play.
              </p>
              <div>
                <button
                  type="button"
                  className="ghost-button"
                  disabled={adding}
                  onClick={() => setConfirmingAdd(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="primary-button"
                  disabled={adding}
                  onClick={addToCollection}
                >
                  {adding ? "Adding..." : "Confirm add"}
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              className="primary-button wishlist-add-owned"
              disabled={removing}
              onClick={() => setConfirmingAdd(true)}
            >
              Add to Collection
            </button>
          )}

          <button
            type="button"
            className="ghost-button wishlist-detail-remove"
            disabled={adding || removing}
            onClick={removeSavedGame}
          >
            {removing ? "Removing..." : "Remove from Want to Play"}
          </button>

          {error && (
            <p className="error-message" role="alert">{error}</p>
          )}
        </div>
      </article>
    </section>
  )
}


export default WishlistGameDetail
