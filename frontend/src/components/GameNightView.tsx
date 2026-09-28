import { useRef, useState } from "react"

import {
  getGameNightRecommendations,
  type PickerMatch,
} from "../api/client"
import PlayLogForm from "./collection/PlayLogForm"
import PlayerSelectionStep from "./picker/PlayerSelectionStep"
import TimeStep from "./picker/TimeStep"
import { timeBand, trackEvent } from "../telemetry"


type Props = {
  enabled: boolean
  defaultTime?: number | null
  onBack: () => void
  onViewGame: (bggId: number) => void
  onUnlockPro: () => void
}

type Step = "players" | "player_selection" | "time" | "shortlist" | "reveal"


function GameNightView({ enabled, defaultTime = null, onBack, onViewGame, onUnlockPro }: Props) {
  const [step, setStep] = useState<Step>("players")
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<number[]>([])
  const [selectedPlayerNames, setSelectedPlayerNames] = useState<string[]>([])
  const [maxPlayTime, setMaxPlayTime] = useState<number | null>(defaultTime)
  const [matches, setMatches] = useState<PickerMatch[]>([])
  const [selectedMatch, setSelectedMatch] = useState<PickerMatch | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const completionTracked = useRef(false)

  async function findGames() {
    setLoading(true)
    setError("")

    try {
      const result = await getGameNightRecommendations(
        selectedPlayerIds,
        maxPlayTime,
      )
      setMatches(result)
      completionTracked.current = false
      setStep("shortlist")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't build this shortlist.")
    } finally {
      setLoading(false)
    }
  }

  function startOver() {
    setStep("players")
    setSelectedPlayerIds([])
    setSelectedPlayerNames([])
    setMaxPlayTime(defaultTime)
    setMatches([])
    setSelectedMatch(null)
    setError("")
    completionTracked.current = false
  }

  if (!enabled) {
    return (
      <section className="screen game-night-screen game-night-locked">
        <h1>Game Night isn’t included</h1>
        <p>Compare plans to see what’s available with your ShelfPick access.</p>
        <button type="button" className="secondary-button" onClick={onUnlockPro}>
          Compare Free and Pro
        </button>
      </section>
    )
  }

  if (step === "time") {
    return (
      <TimeStep
        maxPlayTime={maxPlayTime}
        loading={loading}
        error={error}
        onSelect={setMaxPlayTime}
        onFindGame={() => { void findGames() }}
        onBack={() => setStep("players")}
        supportingCopy="Choose the limit for everyone at the table."
        actionLabel="Find games"
      />
    )
  }

  if (step === "player_selection") {
    return (
      <PlayerSelectionStep
        selectedPlayerIds={selectedPlayerIds}
        onChange={(playerIds, playerNames) => {
          setSelectedPlayerIds(playerIds)
          setSelectedPlayerNames(playerNames)
        }}
        onBack={() => setStep("players")}
      />
    )
  }

  if (step === "shortlist") {
    return (
      <section className="screen game-night-screen">
        <header>
          <h1>Your shortlist</h1>
          <p className="subtitle">Choose one game to reveal for the group.</p>
        </header>

        {matches.length === 0 ? (
          <div className="game-night-empty">
            <h2>No games fit yet</h2>
            <p>Try allowing more time or changing who's playing.</p>
            <button type="button" className="secondary-button" onClick={() => setStep("time")}>
              Adjust time
            </button>
          </div>
        ) : (
          <ol className="game-night-shortlist">
            {matches.map((match) => (
              <li key={match.game.bgg_id}>
                {match.game.thumbnail_url && <img src={match.game.thumbnail_url} alt="" />}
                <div>
                  <h2>{match.game.name}</h2>
                  <p>{match.reasons[1] ?? match.reasons[0]}</p>
                  <button type="button" className="secondary-button" onClick={() => {
                    if (!completionTracked.current) {
                      completionTracked.current = true
                      trackEvent("game_night_completed", {
                        source: "game_night", player_count: selectedPlayerIds.length,
                        time_band: timeBand(maxPlayTime), result_count: matches.length,
                      })
                    }
                    setSelectedMatch(match); setStep("reveal")
                  }}>
                    Choose this game
                  </button>
                </div>
              </li>
            ))}
          </ol>
        )}

        <button type="button" className="ghost-button" onClick={() => setStep("players")}>
          Change players
        </button>
      </section>
    )
  }

  if (step === "reveal" && selectedMatch) {
    return (
      <section className="screen game-night-screen game-night-reveal">
        <header>
          <p className="eyebrow">Tonight's pick</p>
          <h1>{selectedMatch.game.name}</h1>
        </header>
        {selectedMatch.game.image_url && (
          <img className="game-night-cover" src={selectedMatch.game.image_url} alt={`Cover of ${selectedMatch.game.name}`} />
        )}
        <ul className="game-night-reasons">
          {selectedMatch.reasons.map((reason) => <li key={reason}>{reason}</li>)}
        </ul>
        <PlayLogForm
          game={selectedMatch.game}
          initialPlayerCount={selectedPlayerIds.length}
          onSaved={() => Promise.resolve()}
        />
        <button type="button" className="secondary-button" onClick={() => onViewGame(selectedMatch.game.bgg_id)}>
          View game
        </button>
        <button type="button" className="secondary-button" onClick={() => setStep("shortlist")}>
          Back to shortlist
        </button>
        <button type="button" className="ghost-button" onClick={startOver}>
          Start over
        </button>
      </section>
    )
  }

  return (
    <section className="screen game-night-screen">
      <button type="button" className="collection-back" onClick={onBack}>
        ← Back to Pick
      </button>

      <header>
        <h1>Who's playing?</h1>
        <p className="subtitle">
          Choose everyone at the table. Headcount and shared history shape the shortlist.
        </p>
      </header>

      <button
        type="button"
        className="picker-navigation-card"
        onClick={() => setStep("player_selection")}
      >
        <span>
          <strong>Choose players</strong>
          <small>
            {selectedPlayerNames.length > 0
              ? selectedPlayerNames.join(", ")
              : "Select everyone at the table"}
          </small>
        </span>
        <span className="picker-navigation-chevron" aria-hidden="true">›</span>
      </button>

      <div className="picker-step-actions">
        <button
          type="button"
          className="primary-button"
          disabled={selectedPlayerIds.length === 0}
          onClick={() => setStep("time")}
        >
          Continue with {selectedPlayerIds.length || ""} {selectedPlayerIds.length === 1 ? "player" : "players"}
        </button>
      </div>
    </section>
  )
}


export default GameNightView
