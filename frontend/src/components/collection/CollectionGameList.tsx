import { formatPlayerCount } from "../../player-count"
import type {
  CollectionGameStats,
  Game,
} from "../../api/client"
import ResilientGameArtwork from "../ResilientGameArtwork"
import { collectionEmptyKind } from "../../ui-empty-state"
import { Link } from "react-router-dom"
import { APP_PATHS } from "../../routes"

export type ShelfLayout = "grid" | "list"

type Props = {
  layout?: ShelfLayout
  games: Game[]
  totalGames: number
  statsByGame: Map<
    number,
    CollectionGameStats
  >
  onOpenGame: (game: Game) => void
  onAddGame: () => void
  onClearFilters: () => void
}

function CollectionGameList({
  layout = "list",
  games,
  totalGames,
  statsByGame,
  onOpenGame,
  onAddGame,
  onClearFilters,
}: Props) {
  if (games.length === 0) {
    const emptyKind = collectionEmptyKind(totalGames)

    return (
      <div className="collection-empty">
        <strong>
          {emptyKind === "empty"
            ? "Your shelf is empty"
            : "No games match these filters"}
        </strong>
        <p>
          {emptyKind === "empty"
            ? "Add an owned game to start picking and tracking plays."
            : "Clear the search and play filter to see your full collection."}
        </p>
        <div className="collection-empty-actions">
          {emptyKind === "empty" ? <>
            <button type="button" className="primary-button" data-add-game-trigger onClick={onAddGame}>Add game</button>
            <Link className="secondary-button" to={APP_PATHS.settingsCollectionData}>Import from BGG</Link>
          </> : <button type="button" className="secondary-button" onClick={onClearFilters}>Clear filters</button>}
        </div>
      </div>
    )
  }

  if (layout === "grid") {
    return (
      <ul className="collection-grid" aria-label="Games on your shelf">
        {games.map((game) => {
          const playCount = statsByGame.get(game.bgg_id)?.play_count ?? 0
          const playLabel = playCount > 0 ? `${playCount} ${playCount === 1 ? "play" : "plays"}` : null
          return (
            <li key={game.bgg_id}>
              <button
                type="button"
                className="collection-tile"
                aria-label={playLabel ? `${game.name}, ${playLabel}` : game.name}
                onClick={() => onOpenGame(game)}
              >
                <span className="collection-tile-cover">
                  <ResilientGameArtwork
                    src={game.image_url ?? game.thumbnail_url}
                    alt=""
                    gameName={game.name}
                  />
                  {playLabel && <span className="collection-tile-plays" aria-hidden="true">{playLabel}</span>}
                </span>
                <strong>{game.name}</strong>
              </button>
            </li>
          )
        })}
      </ul>
    )
  }

  return (
    <div className="collection-list">
      {games.map((game) => {
        const stats =
          statsByGame.get(game.bgg_id)
        const playCount =
          stats?.play_count ?? 0
        const gameMeta = [
          game.year_published,
          formatPlayerCount(game.min_players, game.max_players),
          game.max_play_time !== null
            ? `${game.max_play_time} min`
            : null,
        ].filter(Boolean)

        return (
          <button
            className="collection-game"
            key={game.bgg_id}
            onClick={() => onOpenGame(game)}
          >
            <div className="collection-thumb">
              <ResilientGameArtwork
                src={game.thumbnail_url ?? game.image_url}
                alt=""
                gameName={game.name}
              />
            </div>

            <div className="collection-game-info">
              <strong>{game.name}</strong>
              {gameMeta.length > 0 && (
                <span className="collection-game-meta">
                  {gameMeta.join(" · ")}
                </span>
              )}
            </div>

            {playCount > 0 && (
              <span className="collection-play-count">
                {`${playCount} ${
                    playCount === 1
                      ? "play"
                      : "plays"
                  }`}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

export default CollectionGameList
