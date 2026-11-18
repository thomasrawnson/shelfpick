import { formatPlayerCount } from "../player-count"
import {
  useEffect,
  useRef,
  useLayoutEffect,
  useState,
} from "react"

import {
  getWishlist,
  getWishlistGame,
  removeFromWishlist,
  type Game,
} from "../api/client"

import WishlistGameDetail
  from "./collection/WishlistGameDetail"
import ResilientGameArtwork
  from "./ResilientGameArtwork"


type Props = {
  gameBggId: number | null
  onOpenGame: (bggId: number) => void
  onCloseGame: () => void
  onGameUnavailable: () => void
  onGameConverted: (game: Game) => void
  onContentReady: () => void
  onBrowseDiscover: () => void
}


function WishlistView({
  gameBggId,
  onOpenGame,
  onCloseGame,
  onGameUnavailable,
  onGameConverted,
  onContentReady,
  onBrowseDiscover,
}: Props) {
  const pending = useRef(false)
  const [games, setGames] = useState<Game[]>([])
  const [detailGame, setDetailGame] = useState<Game | null>(null)
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [error, setError] = useState("")
  const [removingId, setRemovingId] = useState<number | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    if (gameBggId !== null) {
      return
    }

    let active = true

    async function loadWishlist() {
      try {
        const result = await getWishlist()

        if (active) {
          setGames(result)
          setError("")
        }
      } catch (err) {
        if (active) {
          setError(
            err instanceof Error
              ? err.message
              : "Couldn't load your Want to Play list.",
          )
        }
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    void loadWishlist()

    return () => {
      active = false
    }
  }, [gameBggId, reloadKey])

  useEffect(() => {
    if (gameBggId === null) {
      return
    }

    let active = true
    const requestedBggId = gameBggId

    async function loadDetail() {
      setDetailLoading(true)
      setError("")

      try {
        const game = await getWishlistGame(requestedBggId)

        if (!active) {
          return
        }

        if (game === null) {
          onGameUnavailable()
          return
        }

        setDetailGame(game)
      } catch (err) {
        if (active) {
          setError(
            err instanceof Error
              ? err.message
              : "Couldn't load that saved game.",
          )
        }
      } finally {
        if (active) {
          setDetailLoading(false)
        }
      }
    }

    void loadDetail()

    return () => {
      active = false
    }
  }, [gameBggId, onGameUnavailable, reloadKey])

  useLayoutEffect(() => {
    if (loading || gameBggId !== null) {
      return
    }

    const frame = window.requestAnimationFrame(
      onContentReady,
    )

    return () => {
      window.cancelAnimationFrame(frame)
    }
  }, [gameBggId, loading, onContentReady])

  async function removeGame(game: Game) {
    if (pending.current) return
    pending.current = true
    setRemovingId(game.bgg_id)
    setError("")

    try {
      await removeFromWishlist(game.bgg_id)
      setGames((current) => current.filter(
        (item) => item.bgg_id !== game.bgg_id,
      ))
    } catch (err) {
      if (gameBggId === null) {
        setError(
          err instanceof Error
            ? err.message
            : "Couldn't remove that game.",
        )
      }
      throw err
    } finally {
      pending.current = false
      setRemovingId(null)
    }
  }

  if (gameBggId !== null) {
    if (
      detailLoading
      || (
        !error
        && detailGame?.bgg_id !== gameBggId
      )
    ) {
      return <p className="subtitle">Opening that saved game...</p>
    }

    if (error || !detailGame) {
      return (
        <div className="collection-empty wishlist-load-error">
          <strong>Couldn't open that saved game</strong>
          <p>{error || "That game is no longer in Want to Play."}</p>
          <div className="wishlist-error-actions">
            <button
              type="button"
              className="primary-button"
              onClick={() => setReloadKey((current) => current + 1)}
            >
              Try again
            </button>
            <button
              type="button"
              className="ghost-button"
              onClick={onCloseGame}
            >
              Back to Want to Play
            </button>
          </div>
        </div>
      )
    }

    return (
      <WishlistGameDetail
        game={detailGame}
        onBack={onCloseGame}
        onRemove={() => removeGame(detailGame)}
        onConverted={onGameConverted}
      />
    )
  }

  if (loading && games.length === 0 && !error) {
    return <p className="subtitle">Opening your Want to Play list...</p>
  }

  return (
    <>
      {error && (
        <div className="wishlist-load-error">
          <p className="error-message" role="alert">{error}</p>
          <button
            type="button"
            className="ghost-button"
            disabled={loading}
            onClick={() => {
              setLoading(true)
              setReloadKey((current) => current + 1)
            }}
          >
            {loading ? "Retrying…" : "Try again"}
          </button>
        </div>
      )}

      {games.length === 0 && !error && !loading && (
        <div className="collection-empty">
          <strong>Nothing in Want to Play yet</strong>
          <p>
            Save a game from Discover and it will appear here.
          </p>
          <button
            type="button"
            className="secondary-button"
            onClick={onBrowseDiscover}
          >
            Browse Discover
          </button>
        </div>
      )}

      <div className="wishlist-list">
        {games.map((game) => (
          <article className="wishlist-card" key={game.bgg_id}>
            <button
              type="button"
              className="wishlist-card-main"
              onClick={() => onOpenGame(game.bgg_id)}
              aria-label={`View details for ${game.name}`}
            >
              <span className="wishlist-image">
                <ResilientGameArtwork
                  src={game.thumbnail_url ?? game.image_url}
                  alt=""
                  gameName={game.name}
                />
              </span>

              <span className="wishlist-card-body">
                <strong>{game.name}</strong>
                <span className="wishlist-meta">
                  {formatPlayerCount(game.min_players, game.max_players) ?? "Player count unavailable"}
                  {game.max_play_time !== null
                    ? ` · ${game.max_play_time} min`
                    : ""}
                  {game.complexity !== null
                    ? ` · ${game.complexity.toFixed(1)} complexity`
                    : ""}
                </span>
              </span>
              <span className="collection-chevron" aria-hidden="true">›</span>
            </button>

            <button
              type="button"
              className="ghost-button wishlist-remove"
              disabled={removingId !== null}
              onClick={() => {
                void removeGame(game).catch(() => undefined)
              }}
            >
              {removingId === game.bgg_id ? "Removing..." : "Remove"}
            </button>
          </article>
        ))}
      </div>
    </>
  )
}


export default WishlistView
