import { useEffect, useState } from "react"

import { getCollectionStats, getGames, type Game } from "../../api/client"
import { recentlyPlayedGames } from "../../recently-played"
import ResilientGameArtwork from "../ResilientGameArtwork"

type Props = { onOpenGame: (bggId: number) => void }

// A quiet row of covers from your latest plays; renders nothing until there is one.
function RecentlyPlayed({ onOpenGame }: Props) {
  const [games, setGames] = useState<Game[]>([])

  useEffect(() => {
    let active = true
    void Promise.all([getGames(), getCollectionStats()])
      .then(([owned, stats]) => {
        if (active) setGames(recentlyPlayedGames(owned.filter(game => game.owned), stats))
      })
      .catch(() => { /* Recent plays are optional; stay hidden on failure. */ })
    return () => { active = false }
  }, [])

  if (games.length === 0) return null

  return (
    <section className="tonight-recent" aria-labelledby="tonight-recent-title">
      <h2 className="tonight-label" id="tonight-recent-title">Recently played</h2>
      {/* The row scrolls sideways; its right edge fades so a cut-off title reads as "more" rather than a bug. */}
      <div className="tonight-recent-scroll">
        <ul>
          {games.map(game => (
            <li key={game.bgg_id}>
              <button type="button" onClick={() => onOpenGame(game.bgg_id)} aria-label={game.name}>
                <span className="tonight-recent-cover">
                  <ResilientGameArtwork
                    src={game.image_url ?? game.thumbnail_url}
                    alt=""
                    gameName={game.name}
                  />
                </span>
                <span className="tonight-recent-name">{game.name}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

export default RecentlyPlayed
