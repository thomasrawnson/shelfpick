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
import { useLocation } from "react-router-dom"
import MonthlyRecapPanel from "./insights/MonthlyRecapPanel"
import YearRecapEntry from "./insights/YearRecapEntry"
import TrendsPanel from "./stats/TrendsPanel"
import { insightHistoryState }
  from "../ui-empty-state"
import {
  durationCoverageCopy,
  formatRecordedHours,
  playerWinRateCopy,
} from "../insights-format"


type StatsSection =
  | "trends"
  | "collection"
  | "play"
  | "group"
  | "recaps"

const statsSections: Array<{
  id: StatsSection
  label: string
}> = [
  {
    id: "trends",
    label: "Trends",
  },
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
    label: "Players",
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
  const location = useLocation()
  const openYearRecap = (location.state as { openYearRecap?: boolean } | null)?.openYearRecap === true
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
    retryKey,
    setRetryKey,
  ] = useState(0)

  const [
    selectedPlayerId,
    setSelectedPlayerId,
  ] = useState<number | null>(
    null,
  )

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
    openYearRecap ? "recaps" : "trends"
  )


  useEffect(() => {
    async function loadInsights() {
      setError("")

      try {
        const result =
          await getCollectionInsights()

        setInsights(result)
      } catch (err) {
        console.error(err)

        setError(
          "Couldn't load your stats.",
        )
      } finally {
        setLoading(false)
      }
    }

    loadInsights()
  }, [retryKey])


  function retryInsights() {
    setLoading(true)
    setRetryKey(
      (current) => current + 1,
    )
  }


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
        <h1>Stats</h1>
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
        <h1>Stats</h1>

        <p className="error-message">
          {error}
        </p>

        <button
          type="button"
          className="secondary-button"
          onClick={retryInsights}
        >
          Retry
        </button>
      </section>
    )
  }

  const historyState = insightHistoryState(
    insights.total_plays,
  )

  const durationCoverage = durationCoverageCopy(
    insights.total_plays,
    insights.duration_plays,
  )


  return (
    <section className="screen insights-screen">
      <header>
        <h1>Stats</h1>
      </header>


      <div
        className="stats-section-tabs"
        role="group"
        aria-label="Stats sections"
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


      {activeSection === "trends" && (
        <TrendsPanel onOpenGame={onOpenGame} />
      )}


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
                Owned games played
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
            <p className="stats-period">
              All time
            </p>
          </div>

          {historyState === "none" ? (
            <article className="stats-empty-card">
              <h2>No plays recorded yet</h2>
              <p>
                Log your first play to start building your play stats.
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
                {formatRecordedHours(
                  insights
                    .total_duration_minutes,
                )}
              </strong>

              <span>
                {
                  insights
                    .total_duration_minutes
                  === null
                    ? "Recorded time"
                    : "Hours recorded"
                }
              </span>

              {durationCoverage && (
                <small>
                  {durationCoverage}
                </small>
              )}
            </article>
          </div>

          <div className="insights-mini-grid">
            <article className="insight-mini-card">
              <span>
                Games in history
              </span>

              <strong>
                {
                  insights
                    .historical_played_games_count
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
        <>
          <MonthlyRecapPanel />
          <YearRecapEntry autoOpen={openYearRecap} />
        </>
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
          <article className="players-card neglected-card" aria-labelledby="stats-waiting-title">
            <div className="players-card-header">
              <h2 id="stats-waiting-title">
                Waiting on the shelf
              </h2>
            </div>

            <table className="stats-table">
              <thead>
                <tr>
                  <th scope="col">Game</th>
                  <th scope="col">Plays</th>
                </tr>
              </thead>
              <tbody>
                {insights.neglected_games
                  .slice(0, showAllNeglected ? undefined : 3)
                  .map((game) => (
                    <tr key={game.bgg_id}>
                      <th scope="row">
                        <button
                          type="button"
                          className="stats-row-link"
                          onClick={() => onOpenGame(game.bgg_id)}
                        >
                          {game.name}
                        </button>
                      </th>
                      <td>{game.play_count}</td>
                    </tr>
                  ))}
              </tbody>
            </table>

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
          <article className="players-card" aria-labelledby="stats-players-title">
            <div className="players-card-header">
              <h2 id="stats-players-title">
                Players
              </h2>
            </div>

            <p className="stats-table-note">
              Plays each person took part in, so these can add up to more than your total. Win rate counts only plays with a recorded result.
            </p>

            <table className="stats-table">
              <thead>
                <tr>
                  <th scope="col">Player</th>
                  <th scope="col">Plays</th>
                  <th scope="col">Wins</th>
                  <th scope="col">Win rate</th>
                </tr>
              </thead>
              <tbody>
                {insights.frequent_players.map((player) => (
                  <tr key={player.id}>
                    <th scope="row">
                      <button
                        type="button"
                        className="stats-row-link"
                        onClick={() => setSelectedPlayerId(player.id)}
                      >
                        {player.name}
                      </button>
                    </th>
                    <td>{player.play_count}</td>
                    <td>{player.win_count}</td>
                    <td>{playerWinRateCopy(player.win_count, player.decided_count)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </article>
        )
      }


      {
        activeSection === "group"
        && insights
          .top_games_by_player
          .length > 0
        && (
          <article className="players-card" aria-labelledby="stats-favourites-title">
            <div className="players-card-header">
              <h2 id="stats-favourites-title">
                Favourite game
              </h2>
            </div>

            <table className="stats-table">
              <thead>
                <tr>
                  <th scope="col">Player</th>
                  <th scope="col" className="stats-table-text">Game</th>
                  <th scope="col">Plays</th>
                </tr>
              </thead>
              <tbody>
                {insights.top_games_by_player
                  .slice(0, showAllFavourites ? undefined : 3)
                  .map((favourite) => (
                    <tr key={favourite.player_id}>
                      <th scope="row">
                        <button
                          type="button"
                          className="stats-row-link"
                          onClick={() => setSelectedPlayerId(favourite.player_id)}
                        >
                          {favourite.player_name}
                        </button>
                      </th>
                      <td className="stats-table-text">
                        <button
                          type="button"
                          className="stats-row-link stats-row-link-secondary"
                          onClick={() => onOpenGame(favourite.bgg_id)}
                        >
                          {favourite.game_name}
                        </button>
                      </td>
                      <td>{favourite.play_count}</td>
                    </tr>
                  ))}
              </tbody>
            </table>

            {insights.top_games_by_player.length > 3 && (
              <button
                type="button"
                className="insights-view-all"
                onClick={() => setShowAllFavourites((current) => !current)}
              >
                {showAllFavourites ? "Show less" : "View all"}
              </button>
            )}
          </article>
        )
      }


      {
        activeSection === "group"
        && insights
          .common_groups
          .length > 0
        && (
          <article className="players-card" aria-labelledby="stats-groups-title">
            <div className="players-card-header">
              <h2 id="stats-groups-title">
                Who plays together
              </h2>
            </div>

            <table className="stats-table">
              <thead>
                <tr>
                  <th scope="col">Group</th>
                  <th scope="col">Plays</th>
                </tr>
              </thead>
              <tbody>
                {insights.common_groups
                  .slice(0, showAllGroups ? undefined : 3)
                  .map((group) => (
                    <tr key={group.player_ids.join("-")}>
                      <th scope="row" className="stats-table-wrap">
                        {group.player_names.join(" + ")}
                      </th>
                      <td>{group.play_count}</td>
                    </tr>
                  ))}
              </tbody>
            </table>

            {insights.common_groups.length > 3 && (
              <button
                type="button"
                className="insights-view-all"
                onClick={() => setShowAllGroups((current) => !current)}
              >
                {showAllGroups ? "Show less" : "View all"}
              </button>
            )}
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
                : "Your plays do not include player details yet. Add players next time to build group stats."}
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


    </section>
  )
}


export default InsightsView
