import {
  useEffect,
  useState,
} from "react"

import {
  chooseRankingGame,
  getRankingMatchup,
  markRankingGameUnplayed,
  type RankingGame,
} from "../api/client"

import LoadingMessage
  from "./ui/LoadingMessage"

import RankingTopList
  from "./rankings/RankingTopList"


type Props = {
  onBack: () => void
  showBack?: boolean
  onOpenGame?: (
    bggId: number,
  ) => void
}


function gameImage(game: RankingGame) {
  return (
    game.image_url
    ?? game.thumbnail_url
  )
}


function RankGamesView({
  onBack,
  showBack = true,
  onOpenGame,
}: Props) {
  const [matchup, setMatchup] =
    useState<RankingGame[]>([])

  const [loading, setLoading] =
    useState(true)

  const [saving, setSaving] =
    useState(false)

  const [playedOnly, setPlayedOnly] =
    useState(true)

  const [error, setError] =
    useState("")

  const [
    rankingRevision,
    setRankingRevision,
  ] = useState(0)


  async function loadMatchup(
    excludeBggIds: number[] = [],
    nextPlayedOnly = playedOnly,
  ) {
    let result = await getRankingMatchup(
      excludeBggIds,
      nextPlayedOnly,
    )

    if (
      result.games.length < 2
      && excludeBggIds.length > 0
    ) {
      result = await getRankingMatchup(
        [],
        nextPlayedOnly,
      )
    }

    setMatchup(result.games)
  }


  useEffect(() => {
    async function load() {
      try {
        const result =
          await getRankingMatchup([], true)

        setMatchup(result.games)
      } catch (err) {
        console.error(err)
        setError(
          "Couldn't load your game rankings.",
        )
      } finally {
        setLoading(false)
      }
    }

    void load()
  }, [])


  async function changePlayedOnly(
    nextPlayedOnly: boolean,
  ) {
    setPlayedOnly(nextPlayedOnly)
    setSaving(true)
    setError("")

    try {
      await loadMatchup([], nextPlayedOnly)
    } catch (err) {
      console.error(err)
      setError(
        "Couldn't update the ranking filter.",
      )
    } finally {
      setSaving(false)
    }
  }


  async function chooseGame(
    winner: RankingGame,
  ) {
    const loser = matchup.find(
      (game) =>
        game.bgg_id !== winner.bgg_id
    )

    if (!loser) {
      return
    }

    setSaving(true)
    setError("")

    try {
      await chooseRankingGame(
        winner.bgg_id,
        loser.bgg_id,
      )

      await loadMatchup([
        winner.bgg_id,
        loser.bgg_id,
      ])

      setRankingRevision(
        (current) => current + 1,
      )
    } catch (err) {
      console.error(err)
      setError(
        "Couldn't save that choice.",
      )
    } finally {
      setSaving(false)
    }
  }


  async function skipPair() {
    setSaving(true)
    setError("")

    try {
      await loadMatchup(
        matchup.map(
          (game) => game.bgg_id
        )
      )
    } catch (err) {
      console.error(err)
      setError(
        "Couldn't find another pair.",
      )
    } finally {
      setSaving(false)
    }
  }


  async function markUnplayed(
    game: RankingGame,
  ) {
    setSaving(true)
    setError("")

    try {
      await markRankingGameUnplayed(
        game.bgg_id
      )

      await loadMatchup(
        matchup.map(
          (item) => item.bgg_id
        )
      )

      setRankingRevision(
        (current) => current + 1,
      )
    } catch (err) {
      console.error(err)
      setError(
        "Couldn't update that game.",
      )
    } finally {
      setSaving(false)
    }
  }


  if (loading) {
    return (
      <section className="screen rankings-screen">
        {showBack && (
          <button
            type="button"
            className="ranking-back-button"
            onClick={onBack}
          >
            <span aria-hidden="true">←</span>
            Collection
          </button>
        )}

        <p className="subtitle" role="status">
          <LoadingMessage />
        </p>
      </section>
    )
  }


  return (
    <section className="screen rankings-screen">
      {showBack && (
        <button
          type="button"
          className="ranking-back-button"
          onClick={onBack}
        >
          <span aria-hidden="true">←</span>
          Collection
        </button>
      )}

      {error && (
        <p className="error-message">
          {error}
        </p>
      )}

      <div className="ranking-compare-view">
        {matchup.length === 2 ? (
          <>
            <h2 className="ranking-question">
              Which would you rather play?
            </h2>

            <div className="ranking-matchup">
              {matchup.map((game) => (
                <article
                  className="ranking-game-card"
                  key={game.bgg_id}
                >
                  <div className="ranking-game-image">
                    {gameImage(game) ? (
                      <img
                        src={gameImage(game) ?? ""}
                        alt=""
                      />
                    ) : (
                      <span>?</span>
                    )}
                  </div>

                  <h2>{game.name}</h2>

                  {game.year_published && (
                    <p>{game.year_published}</p>
                  )}

                  <button
                    type="button"
                    className="ranking-choose-button"
                    disabled={saving}
                    onClick={() =>
                      void chooseGame(game)
                    }
                  >
                    Prefer this
                  </button>

                  <button
                    type="button"
                    className="ranking-unplayed-button"
                    disabled={saving}
                    onClick={() =>
                      void markUnplayed(game)
                    }
                  >
                    Haven't played
                  </button>
                </article>
              ))}
            </div>

            <button
              type="button"
              className="ranking-skip-button"
              disabled={saving}
              onClick={() => void skipPair()}
            >
              {saving
                ? "Saving..."
                : "Skip this pair"}
            </button>
          </>
        ) : (
          <article className="ranking-empty-card">
            <h2>
              Two games needed
            </h2>

            <p>
              {playedOnly
                ? "Record a play for at least two games, or include unplayed games in Advanced options below."
                : "Add at least two base games to your collection to start ranking."}
            </p>
          </article>
        )}
      </div>

      <RankingTopList
        key={`${rankingRevision}-${playedOnly}`}
        playedOnly={playedOnly}
        onOpenGame={onOpenGame}
      />

      <details className="ranking-advanced-options">
        <summary>
          <span>
            <strong>Advanced options</strong>
            <small>
              Choose which games can appear
            </small>
          </span>
        </summary>

        <label className="ranking-played-filter">
          <input
            type="checkbox"
            checked={playedOnly}
            disabled={saving}
            onChange={(event) =>
              void changePlayedOnly(
                event.target.checked
              )
            }
          />

          <span>
            <strong>Only games I've played</strong>
            <small>
              Turn this off to include your whole shelf.
            </small>
          </span>
        </label>
      </details>
    </section>
  )
}


export default RankGamesView
