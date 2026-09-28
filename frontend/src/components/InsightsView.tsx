import {
  useEffect,
  useState,
} from "react"

import {
  getCollectionInsights,
  type CollectionInsights,
} from "../api/client"

import PlayerProfile
  from "./players/PlayerProfile"

import RankingCategorySummary
  from "./rankings/RankingCategorySummary"
import { insightHistoryState }
  from "../ui-empty-state"


type StatsSection =
  | "collection"
  | "play"
  | "group"
  | "recaps"

const statsSections: Array<{
  id: StatsSection
  label: string
}> = [
  {
    id: "collection",
    label: "Collection",
  },
  {
    id: "play",
    label: "Play",
  },
  {
    id: "group",
    label: "Friends",
  },
  {
    id: "recaps",
    label: "Recaps",
  },
]


function formatPlayedAt(
  value: string,
): string {
  const date =
    new Date(value)

  return new Intl.DateTimeFormat(
    undefined,
    {
      day: "numeric",
      month: "short",
      year: "numeric",
    },
  ).format(date)
}


function formatHours(
  minutes: number,
): string {
  const hours =
    minutes / 60

  if (hours < 10) {
    return hours.toFixed(1)
  }

  return (
    Math.round(hours)
      .toString()
  )
}


type Props = {
  onOpenGame:
    (bggId: number) => void
  onOpenCollection: () => void
  onOpenPicker: () => void
}


function InsightsView({
  onOpenGame,
  onOpenCollection,
  onOpenPicker,
}: Props) {
  const [
    insights,
    setInsights,
  ] = useState<
    CollectionInsights | null
  >(null)

  const [
    loading,
    setLoading,
  ] = useState(true)

  const [
    error,
    setError,
  ] = useState("")

  const [
    selectedPlayerId,
    setSelectedPlayerId,
  ] = useState<number | null>(
    null,
  )

  const [
    showMonthlyPlays,
    setShowMonthlyPlays,
  ] = useState(false)

  const [
    showAllNeglected,
    setShowAllNeglected,
  ] = useState(false)

  const [
    showAllFavourites,
    setShowAllFavourites,
  ] = useState(false)

  const [
    showAllGroups,
    setShowAllGroups,
  ] = useState(false)

  const [
    activeSection,
    setActiveSection,
  ] = useState<StatsSection>(
    "collection"
  )


  useEffect(() => {
    async function loadInsights() {
      try {
        const result =
          await getCollectionInsights()

        setInsights(result)
      } catch (err) {
        console.error(err)

        setError(
          "Couldn't load your collection insights.",
        )
      } finally {
        setLoading(false)
      }
    }

    loadInsights()
  }, [])


  if (
    selectedPlayerId !== null
  ) {
    return (
      <PlayerProfile
        playerId={
          selectedPlayerId
        }
        onBack={() =>
          setSelectedPlayerId(
            null
          )
        }
        onSelectPlayer={(
          playerId: number,
        ) =>
          setSelectedPlayerId(
            playerId
          )
        }
      />
    )
  }

  if (loading) {
    return (
      <section className="screen insights-screen">
        <h1>Insights</h1>
        <p className="subtitle" role="status">Crunching the numbers...</p>
      </section>
    )
  }


  if (
    error
    || !insights
  ) {
    return (
      <section className="screen insights-screen">
        <h1>Insights</h1>

        <p className="error-message">
          {error}
        </p>
      </section>
    )
  }

  const historyState = insightHistoryState(
    insights.total_plays,
  )


  return (
    <section className="screen insights-screen">
      <header>
        <h1>Insights</h1>
      </header>


      <div
        className="stats-section-tabs"
        aria-label="Insights sections"
      >
        {statsSections.map(
          (section) => (
            <button
              type="button"
              aria-pressed={
                activeSection
                === section.id
              }
              className={
                activeSection
                === section.id
                  ? "stats-section-tab active"
                  : "stats-section-tab"
              }
              key={section.id}
              onClick={() =>
                setActiveSection(
                  section.id
                )
              }
            >
              {section.label}
            </button>
          ),
        )}
      </div>


      {activeSection === "collection" && (
        <div
          className="stats-section-content"
        >
          <div className="stats-section-heading">
            <h2>
              Explore your shelf
            </h2>
          </div>

          {insights.total_games === 0 ? (
            <article className="stats-empty-card">
              <h2>Your collection is empty</h2>
              <p>
                Add an owned game to see shelf coverage and play history here.
              </p>
              <button
                type="button"
                className="secondary-button"
                onClick={onOpenCollection}
              >
                Open Collection
              </button>
            </article>
          ) : <>
          <div className="insights-stat-grid">
            <article className="stat-card">
              <strong>
                {insights.total_games}
              </strong>

              <span>
                Games owned
              </span>
            </article>

            <article className="stat-card">
              <strong>
                {
                  insights
                    .collection_played_percentage
                }%
              </strong>

              <span>
                Shelf explored
              </span>
            </article>
          </div>

          <div className="insights-mini-grid">
            <article className="insight-mini-card">
              <span>
                Games played
              </span>

              <strong>
                {
                  insights
                    .played_games_count
                }
              </strong>
            </article>

            <article className="insight-mini-card">
              <span>
                Still waiting
              </span>

              <strong>
                {
                  insights
                    .never_played_count
                }
              </strong>
            </article>
          </div>

          <RankingCategorySummary />
          </>}
        </div>
      )}


      {activeSection === "play" && (
        <div
          className="stats-section-content"
        >
          <div className="stats-section-heading">
            <h2>
              Time around the table
            </h2>
          </div>

          {historyState === "none" ? (
            <article className="stats-empty-card">
              <h2>No plays recorded yet</h2>
              <p>
                Log your first play to start building factual play insights.
              </p>
              <button
                type="button"
                className="secondary-button"
                onClick={onOpenPicker}
              >
                Pick a game
              </button>
            </article>
          ) : <>
          <div className="insights-stat-grid">
            <article className="stat-card">
              <strong>
                {insights.total_plays}
              </strong>

              <span>
                Plays
              </span>
            </article>

            <article className="stat-card">
              <strong>
                {formatHours(
                  insights
                    .total_duration_minutes,
                )}
              </strong>

              <span>
                Hours played
              </span>
            </article>
          </div>

          <div className="insights-mini-grid">
            <article className="insight-mini-card">
              <span>
                Games played
              </span>

              <strong>
                {
                  insights
                    .played_games_count
                }
              </strong>
            </article>

            <article className="insight-mini-card">
              <span>
                Avg. play
              </span>

              <strong>
                {
                  insights
                    .average_duration_minutes
                  !== null
                    ? `${
                        insights
                          .average_duration_minutes
                      }m`
                    : "—"
                }
              </strong>
            </article>
          </div>
          </>}
        </div>
      )}


      {activeSection === "recaps" && (
        <div className="stats-section-heading">
          <h2>
            This month in games
          </h2>
        </div>
      )}


      {activeSection === "recaps" && (
      <article className="monthly-activity-card">
        <button
          type="button"
          className="monthly-activity-trigger"
          onClick={() =>
            setShowMonthlyPlays(
              (current) => !current
            )
          }
        >
          <div>
            <p className="insight-label">
              This month
            </p>

            <h2>
              Around the table
            </h2>
          </div>

          <span className="monthly-activity-chevron">
            {
              showMonthlyPlays
                ? "⌃"
                : "⌄"
            }
          </span>
        </button>

        <div className="monthly-activity-grid">
          <div className="monthly-activity-stat">
            <strong>
              {
                insights
                  .monthly_activity
                  .plays
              }
            </strong>

            <span>
              Plays
            </span>
          </div>

          <div className="monthly-activity-stat">
            <strong>
              {
                insights
                  .monthly_activity
                  .unique_games
              }
            </strong>

            <span>
              Games
            </span>
          </div>

          <div className="monthly-activity-stat">
            <strong>
              {
                insights
                  .monthly_activity
                  .new_games
              }
            </strong>

            <span>
              New
            </span>
          </div>

          <div className="monthly-activity-stat">
            <strong>
              {
                insights
                  .monthly_activity
                  .repeat_plays
              }
            </strong>

            <span>
              Repeat
            </span>
          </div>
        </div>

        {
          showMonthlyPlays
          && (
            <div className="monthly-play-list">
              {
                insights
                  .monthly_activity
                  .recent_plays
                  .map(
                    (play) => (
                      <div
                        key={
                          play.play_id
                        }
                        className="monthly-play-row"
                      >
                        <button
                          type="button"
                          className="monthly-play-game"
                          onClick={() =>
                            onOpenGame(
                              play.bgg_id
                            )
                          }
                        >
                          {
                            play
                              .game_name
                          }
                        </button>

                        <div className="monthly-play-meta">
                          <span>
                            {
                              formatPlayedAt(
                                play
                                  .played_at
                              )
                            }
                          </span>

                          <span>
                            {
                              play
                                .player_count
                            }{" "}
                            players
                          </span>
                        </div>
                      </div>
                    ),
                  )
              }

              {
                insights
                  .monthly_activity
                  .recent_plays
                  .length === 0
                && (
                  <div className="insight-empty">
                    <p>No plays recorded this month.</p>
                    <button
                      type="button"
                      className="ghost-button"
                      onClick={onOpenPicker}
                    >
                      Pick a game
                    </button>
                  </div>
                )
              }
            </div>
          )
        }
      </article>
      )}


      {activeSection === "play" && historyState === "ready" && (
      <div className="insight-feature-list">
        <article className="insight-feature">
          <p className="insight-label">
            Most played
          </p>

          {
            insights.most_played
              ? (
                <>
                  <h2>
                    {
                      insights
                        .most_played
                        .name
                    }
                  </h2>

                  <p className="insight-detail">
                    {
                      insights
                        .most_played
                        .play_count
                    }{" "}
                    {
                      insights
                        .most_played
                        .play_count
                      === 1
                        ? "play"
                        : "plays"
                    }
                  </p>
                </>
              )
              : (
                <p className="insight-empty">
                  No plays recorded yet.
                </p>
              )
          }
        </article>


        <article className="insight-feature">
          <p className="insight-label">
            Last played
          </p>

          {
            insights.last_played
              ? (
                <>
                  <h2>
                    {
                      insights
                        .last_played
                        .name
                    }
                  </h2>

                  <p className="insight-detail">
                    {
                      formatPlayedAt(
                        insights
                          .last_played
                          .played_at,
                      )
                    }
                  </p>
                </>
              )
              : (
                <p className="insight-empty">
                  Nothing has hit the
                  table yet.
                </p>
              )
          }
        </article>
      </div>
      )}


      {
        activeSection === "collection"
        && insights
          .neglected_games
          .length > 0
        && (
          <article className="players-card neglected-card">
            <div className="players-card-header">
              <div>
                <h2>
                  Waiting on the shelf
                </h2>
              </div>
            </div>

            <div className="player-list">
              {
                insights
                  .neglected_games
                  .slice(
                    0,
                    showAllNeglected
                      ? undefined
                      : 3
                  )
                  .map(
                    (
                      game,
                      index,
                    ) => (
                      <div
                        className="player-row neglected-game-row"
                        key={
                          game.bgg_id
                        }
                      >
                        <span className="player-rank">
                          {
                            index + 1
                          }
                        </span>

                        <button
                          type="button"
                          className="stats-game-link neglected-game-name"
                          onClick={() =>
                            onOpenGame(
                              game.bgg_id
                            )
                          }
                        >
                          <strong>
                            {
                              game.name
                            }
                          </strong>

                        </button>

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

            {
              insights
                .neglected_games
                .length > 3
              && (
                <button
                  type="button"
                  className="insights-view-all"
                  onClick={() =>
                    setShowAllNeglected(
                      (current) =>
                        !current
                    )
                  }
                >
                  {
                    showAllNeglected
                      ? "Show less"
                      : "View all"
                  }
                </button>
              )
            }
          </article>
        )
      }


      {
        activeSection === "group"
        && insights
          .frequent_players
          .length > 0
        && (
          <article className="players-card">
            <div className="players-card-header">
              <div>
                <h2>
                  Friends
                </h2>
              </div>

              <span>
                Top 3
              </span>
            </div>

            <div className="player-list">
              {
                insights
                  .frequent_players
                  .slice(
                    0,
                    3
                  )
                  .map(
                    (
                      player,
                      index,
                    ) => (
                      <div
                        className="player-row"
                        key={
                          player.id
                        }
                      >
                        <span className="player-rank">
                          {
                            index + 1
                          }
                        </span>

                        <button
                          type="button"
                          className="player-name player-name-link"
                          onClick={() =>
                            setSelectedPlayerId(
                              player.id
                            )
                          }
                        >
                          {
                            player.name
                          }
                        </button>

                        <div className="player-stat">
                          <strong>
                            {
                              player
                                .play_count
                            }
                          </strong>

                          <span>
                            plays
                          </span>
                        </div>

                        <div className="player-stat">
                          <strong>
                            {
                              player
                                .win_count
                            }
                          </strong>

                          <span>
                            wins
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
        activeSection === "group"
        && insights
          .top_games_by_player
          .length > 0
        && (
          <article className="players-card">
            <div className="players-card-header">
              <div>
                <h2>
                  Friends favourites
                </h2>
              </div>
            </div>

            <div className="player-list">
              {
                insights
                  .top_games_by_player
                  .slice(
                    0,
                    showAllFavourites
                      ? undefined
                      : 3
                  )
                  .map(
                    (
                      favourite,
                      index,
                    ) => (
                      <div
                        className="player-row favourite-game-row"
                        key={
                          favourite
                            .player_id
                        }
                      >
                        <span className="player-rank">
                          {
                            index + 1
                          }
                        </span>

                        <div className="favourite-game-copy">
                          <button
                            type="button"
                            className="favourite-player-link"
                            onClick={() =>
                              setSelectedPlayerId(
                                favourite
                                  .player_id
                              )
                            }
                          >
                            {
                              favourite
                                .player_name
                            }
                          </button>

                          <button
                            type="button"
                            className="stats-game-link favourite-game-link"
                            onClick={() =>
                              onOpenGame(
                                favourite
                                  .bgg_id
                              )
                            }
                          >
                            {
                              favourite
                                .game_name
                            }
                          </button>
                        </div>

                        <div className="player-stat">
                          <strong>
                            {
                              favourite
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

            {
              insights
                .top_games_by_player
                .length > 3
              && (
                <button
                  type="button"
                  className="insights-view-all"
                  onClick={() =>
                    setShowAllFavourites(
                      (current) =>
                        !current
                    )
                  }
                >
                  {
                    showAllFavourites
                      ? "Show less"
                      : "View all"
                  }
                </button>
              )
            }
          </article>
        )
      }


      {
        activeSection === "group"
        && insights
          .common_groups
          .length > 0
        && (
          <article className="players-card">
            <div className="players-card-header">
              <div>
                <p className="insight-label">
                  Regular groups
                </p>

                <h2>
                  Who plays together
                </h2>
              </div>
            </div>

            <div className="player-list">
              {
                insights
                  .common_groups
                  .slice(
                    0,
                    showAllGroups
                      ? undefined
                      : 3
                  )
                  .map(
                    (
                      group,
                      index,
                    ) => (
                      <div
                        className="player-row common-group-row"
                        key={
                          group
                            .player_ids
                            .join("-")
                        }
                      >
                        <span className="player-rank">
                          {
                            index + 1
                          }
                        </span>

                        <div className="player-name common-group-names">
                          {
                            group
                              .player_names
                              .join(" + ")
                          }
                        </div>

                        <div className="player-stat">
                          <strong>
                            {
                              group
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

            {
              insights
                .common_groups
                .length > 3
              && (
                <button
                  type="button"
                  className="insights-view-all"
                  onClick={() =>
                    setShowAllGroups(
                      (current) =>
                        !current
                    )
                  }
                >
                  {
                    showAllGroups
                      ? "Show less"
                      : "View all"
                  }
                </button>
              )
            }
          </article>
        )
      }


      {
        activeSection === "group"
        && insights.frequent_players.length === 0
        && insights.top_games_by_player.length === 0
        && insights.common_groups.length === 0
        && (
          <article className="stats-empty-card">
            <span aria-hidden="true">
              ◌
            </span>

            <h2>
              {historyState === "none"
                ? "No group plays recorded yet"
                : "No player history recorded yet"}
            </h2>

            <p>
              {historyState === "none"
                ? "Log a play with its players to start building group history."
                : "Your plays do not include player details yet. Add players next time to build group insights."}
            </p>

            <button
              type="button"
              className="secondary-button"
              onClick={onOpenPicker}
            >
              Pick a game
            </button>
          </article>
        )
      }


      {activeSection === "recaps" && (
        <article className="recaps-preview-card">
          <p className="insight-label">
            More stories to come
          </p>

          <h2>
            Your year in review
          </h2>

          <p>
            Yearly recaps will surface milestones, favourite groups, new discoveries and the games that defined your year.
          </p>
        </article>
      )}
    </section>
  )
}


export default InsightsView
