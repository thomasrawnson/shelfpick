import {
  useEffect,
  useState,
} from "react"

import {
  getPlayerStats,
  type PlayerStats,
} from "../../api/client"

import LoadingMessage
  from "../ui/LoadingMessage"
import { winRateCopy }
  from "../../insights-format"


type Props = {
  playerId: number
  onBack: () => void
  onSelectPlayer:
    (playerId: number) => void
}


function formatDate(
  value: string,
): string {
  return new Intl.DateTimeFormat(
    undefined,
    {
      day: "numeric",
      month: "short",
      year: "numeric",
    },
  ).format(
    new Date(value),
  )
}


const outcomeLabels = {
  win: "Win",
  loss: "Loss",
  draw: "Draw",
  unknown: "Not recorded",
} as const


function PlayerProfile({
  playerId,
  onBack,
  onSelectPlayer,
}: Props) {
  const [
    stats,
    setStats,
  ] = useState<
    PlayerStats | null
  >(null)

  const [
    loading,
    setLoading,
  ] = useState(true)

  const [
    error,
    setError,
  ] = useState("")


  useEffect(() => {
    async function loadStats() {
      setLoading(true)
      setError("")

      try {
        const result =
          await getPlayerStats(
            playerId
          )

        setStats(result)
      } catch (err) {
        console.error(err)

        setError(
          "Couldn't load this player's stats.",
        )
      } finally {
        setLoading(false)
      }
    }

    loadStats()
  }, [playerId])


  if (loading) {
    return (
      <section className="screen insights-screen">
        <button
          type="button"
          className="player-profile-back"
          onClick={onBack}
        >
          ← Back to stats
        </button>

        <p className="eyebrow">
          Player profile
        </p>

        <h1>
          <LoadingMessage
            messages={[
              "Pulling up their stats...",
              "Tallying their wins...",
            ]}
          />
        </h1>
      </section>
    )
  }


  if (
    error
    || !stats
  ) {
    return (
      <section className="screen insights-screen">
        <button
          type="button"
          className="player-profile-back"
          onClick={onBack}
        >
          ← Back to stats
        </button>

        <p className="eyebrow">
          Player profile
        </p>

        <h1>
          Player stats
        </h1>

        <p className="error-message">
          {error}
        </p>
      </section>
    )
  }


  return (
    <section className="screen insights-screen player-profile">
      <button
        type="button"
        className="player-profile-back"
        onClick={onBack}
      >
        ← Back to stats
      </button>


      <header className="player-profile-header">
        <p className="eyebrow">
          Player profile
        </p>

        <h1>
          {stats.player.name}
        </h1>

        <p className="subtitle">
          A look at their time
          around your table.
        </p>
      </header>


      <div className="insights-stat-grid player-profile-stats">
        <article className="stat-card">
          <strong>
            {stats.total_plays}
          </strong>

          <span>
            Plays
          </span>
        </article>

        <article className="stat-card">
          <strong>
            {stats.unique_games}
          </strong>

          <span>
            Games
          </span>
        </article>

        <article className="stat-card">
          <strong>
            {stats.wins}
          </strong>

          <span>
            Wins
          </span>
        </article>

        <article className="stat-card">
          <strong>
            {stats.losses}
          </strong>

          <span>
            Losses
          </span>
        </article>

        <article className="stat-card">
          <strong>
            {stats.draws}
          </strong>

          <span>
            Draws
          </span>
        </article>

        <article className="stat-card">
          <strong>
            {stats.unknown_results}
          </strong>

          <span>
            Outcome not recorded
          </span>
        </article>

        <article className="stat-card">
          <strong>
            {winRateCopy(
              stats.win_rate,
            )}
          </strong>

          <span>
            Win rate
          </span>

          <small>
            {
              stats.decided_plays > 0
                ? `${stats.decided_plays} decided ${stats.decided_plays === 1 ? "play" : "plays"}`
                : "No decided outcomes"
            }
          </small>
        </article>
      </div>


      {
        stats
          .most_played_games
          .length > 0
        && (
          <article className="player-profile-section">
            <div className="player-profile-section-header">
              <p className="insight-label">
                Play history
              </p>

              <h2>
                Most played together
              </h2>
            </div>

            <div className="player-profile-list">
              {
                stats
                  .most_played_games
                  .map(
                    (
                      game,
                      index,
                    ) => (
                      <div
                        className="player-profile-row"
                        key={
                          game.bgg_id
                        }
                      >
                        <span className="player-rank">
                          {
                            index + 1
                          }
                        </span>

                        <div className="player-profile-row-main">
                          <strong>
                            {
                              game.name
                            }
                          </strong>

                          {
                            game
                              .last_played_at
                            && (
                              <span>
                                Last played{" "}
                                {
                                  formatDate(
                                    game
                                      .last_played_at
                                  )
                                }
                              </span>
                            )
                          }
                        </div>

                        <div className="player-stat">
                          <strong>
                            {
                              game
                                .play_count
                            }
                          </strong>

                          <span>
                            plays
                          </span>
                        </div>
                      </div>
                    ),
                  )
              }
            </div>
          </article>
        )
      }


      {
        stats
          .recent_games
          .length > 0
        && (
          <article className="player-profile-section">
            <div className="player-profile-section-header">
              <p className="insight-label">
                Latest
              </p>

              <h2>
                Recent plays
              </h2>
            </div>

            <div className="player-profile-list">
              {
                stats
                  .recent_games
                  .map(
                    (game) => (
                      <div
                        className="player-profile-row"
                        key={
                          game.play_id
                        }
                      >
                        <div className="player-profile-row-main">
                          <strong>
                            {
                              game.name
                            }
                          </strong>

                          <span>
                            {
                              formatDate(
                                game
                                  .played_at
                              )
                            }
                          </span>
                        </div>

                        <div className="player-recent-result">
                          <span
                            className={
                              game.outcome === "win"
                                ? "player-win-badge"
                                : "player-played-badge"
                            }
                          >
                            {
                              outcomeLabels[
                                game.outcome
                              ]
                            }
                          </span>

                          {
                            game.score
                            !== null
                            && (
                              <span className="player-score">
                                {
                                  game.score
                                }
                                {" "}
                                pts
                              </span>
                            )
                          }
                        </div>
                      </div>
                    ),
                  )
              }
            </div>
          </article>
        )
      }


      {
        stats
          .common_partners
          .length > 0
        && (
          <article className="player-profile-section">
            <div className="player-profile-section-header">
              <p className="insight-label">
                Table mates
              </p>

              <h2>
                Plays with
              </h2>
            </div>

            <div className="player-profile-list">
              {
                stats
                  .common_partners
                  .map(
                    (partner) => (
                      <button
                        type="button"
                        className="player-profile-row player-partner-row"
                        key={
                          partner.id
                        }
                        onClick={() =>
                          onSelectPlayer(
                            partner.id
                          )
                        }
                      >
                        <div className="player-profile-row-main">
                          <strong>
                            {
                              partner.name
                            }
                          </strong>

                          <span>
                            {
                              partner
                                .play_count
                            }
                            {" "}
                            {
                              partner
                                .play_count
                              === 1
                                ? "game together"
                                : "games together"
                            }
                          </span>
                        </div>

                        <span className="player-row-chevron">
                          ›
                        </span>
                      </button>
                    ),
                  )
              }
            </div>
          </article>
        )
      }
    </section>
  )
}


export default PlayerProfile
