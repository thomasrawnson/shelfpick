import { useEffect, useRef, useState } from "react"
import { QRCodeSVG } from "qrcode.react"

import {
  closeGameNightVoting,
  getGameNightRecommendations,
  getGameNightVotingHostState,
  openGameNightVoting,
  type GameNightVotingHostState,
  type PickerMatch,
} from "../api/client"
import PlayLogForm from "./collection/PlayLogForm"
import PlayerSelectionStep from "./picker/PlayerSelectionStep"
import TimeStep from "./picker/TimeStep"
import { timeBand, trackEvent } from "../telemetry"


type Props = {
  enabled: boolean
  votingEnabled: boolean
  defaultTime?: number | null
  onBack: () => void
  onViewGame: (bggId: number) => void
  onUnlockPro: () => void
}

type Step = "players" | "player_selection" | "time" | "shortlist" | "voting" | "reveal"


function GameNightView({ enabled, votingEnabled, defaultTime = null, onBack, onViewGame, onUnlockPro }: Props) {
  const [step, setStep] = useState<Step>("players")
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<number[]>([])
  const [selectedPlayerNames, setSelectedPlayerNames] = useState<string[]>([])
  const [maxPlayTime, setMaxPlayTime] = useState<number | null>(defaultTime)
  const [matches, setMatches] = useState<PickerMatch[]>([])
  const [selectedMatch, setSelectedMatch] = useState<PickerMatch | null>(null)
  const [votingSession, setVotingSession] = useState<GameNightVotingHostState | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const completionTracked = useRef(false)
  const votingSessionId = votingSession?.session_id
  const votingStatus = votingSession?.status

  useEffect(() => {
    if (step !== "voting" || !votingSessionId || votingStatus !== "open") return
    const interval = window.setInterval(() => {
      void getGameNightVotingHostState(votingSessionId)
        .then((next) => {
          setVotingSession((current) => ({
            ...next,
            join_url: current?.join_url,
          }))
        })
        .catch((err) => {
          setError(err instanceof Error ? err.message : "Couldn't refresh voting.")
        })
    }, 4000)
    return () => window.clearInterval(interval)
  }, [step, votingSessionId, votingStatus])

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
    setVotingSession(null)
    setError("")
    completionTracked.current = false
  }

  function chooseMatch(match: PickerMatch) {
    if (!completionTracked.current) {
      completionTracked.current = true
      trackEvent("game_night_completed", {
        source: "game_night", player_count: selectedPlayerIds.length,
        time_band: timeBand(maxPlayTime), result_count: matches.length,
      })
    }
    setSelectedMatch(match)
    setStep("reveal")
  }

  async function openVoting() {
    setLoading(true)
    setError("")
    try {
      const session = await openGameNightVoting(
        matches.map((match) => match.game.bgg_id),
      )
      setVotingSession(session)
      setStep("voting")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't open phone voting.")
    } finally {
      setLoading(false)
    }
  }

  async function closeVoting() {
    if (!votingSession) return
    setLoading(true)
    setError("")
    try {
      setVotingSession(await closeGameNightVoting(votingSession.session_id))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't close voting.")
    } finally {
      setLoading(false)
    }
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
                  <button type="button" className="secondary-button" onClick={() => chooseMatch(match)}>
                    Choose this game
                  </button>
                </div>
              </li>
            ))}
          </ol>
        )}

        {matches.length >= 3 && votingEnabled && (
          <button
            type="button"
            className="primary-button"
            disabled={loading}
            onClick={() => {
              if (votingSession) setStep("voting")
              else void openVoting()
            }}
          >
            {loading
              ? "Opening voting…"
              : votingSession
                ? "Return to phone voting"
                : "Open phone voting"}
          </button>
        )}
        {matches.length >= 3 && !votingEnabled && (
          <div className="game-night-voting-upsell">
            <p>Phone voting is a ShelfPick Pro feature. You can still choose a game together here.</p>
            <button type="button" className="secondary-button" onClick={onUnlockPro}>See Pro features</button>
          </div>
        )}
        {error && <p className="form-error" role="alert">{error}</p>}

        <button type="button" className="ghost-button" onClick={() => setStep("players")}>
          Change players
        </button>
      </section>
    )
  }

  if (step === "voting" && votingSession) {
    const results = votingSession.results
    const counts = new Map(results?.counts.map((item) => [item.bgg_id, item.votes]) ?? [])
    const outcomeHeading = results?.outcome === "no_votes"
      ? "No votes were cast"
      : results?.outcome === "tie"
        ? "The vote is tied"
        : "Voting results"

    return (
      <section className="screen game-night-screen game-night-host-voting">
        <header>
          <p className="eyebrow">Phone voting</p>
          <h1>{votingSession.status === "open" ? "Invite the group" : outcomeHeading}</h1>
        </header>

        {votingSession.status === "open" && votingSession.join_url && (
          <>
            <div className="game-night-qr">
              <QRCodeSVG
                value={votingSession.join_url}
                size={220}
                level="M"
                marginSize={4}
                title="Scan to join ShelfPick Game Night voting"
                role="img"
              />
            </div>
            <label htmlFor="game-night-join-link">Join link</label>
            <div className="game-night-join-link">
              <input id="game-night-join-link" readOnly value={votingSession.join_url} />
              <button type="button" className="secondary-button" onClick={() => {
                void navigator.clipboard.writeText(votingSession.join_url ?? "")
                  .then(() => setError("Join link copied."))
                  .catch(() => setError("Couldn't copy the link. Select and copy it instead."))
              }}>Copy link</button>
            </div>
            <p className="game-night-participation" role="status">
              {votingSession.ballots_submitted} of {votingSession.participant_count} joined guests have voted
            </p>
            {votingSession.participant_names.length > 0 && (
              <p className="form-help">Joined: {votingSession.participant_names.join(", ")}</p>
            )}
            <button type="button" className="primary-button" disabled={loading} onClick={() => { void closeVoting() }}>
              {loading ? "Closing…" : "Close voting and show results"}
            </button>
          </>
        )}

        {votingSession.status === "closed" && results && (
          <>
            <ol className="game-night-vote-results">
              {matches.map((match) => (
                <li key={match.game.bgg_id}>
                  <div>
                    <strong>{match.game.name}</strong>
                    <span>{counts.get(match.game.bgg_id) ?? 0} votes</span>
                    {results.winner_bgg_ids.includes(match.game.bgg_id) && (
                      <span className="game-night-result-label">
                        {results.outcome === "tie" ? "Joint leader" : "Voting winner"}
                      </span>
                    )}
                  </div>
                  <button type="button" className="secondary-button" onClick={() => chooseMatch(match)}>
                    Choose this game
                  </button>
                </li>
              ))}
            </ol>
            {results.abstain_count > 0 && <p>{results.abstain_count} abstained.</p>}
            <p>The host still confirms the final game.</p>
          </>
        )}

        {votingSession.status === "expired" && (
          <div className="game-night-empty">
            <h2>This voting session has expired</h2>
            <p>Return to the shortlist to choose together or open a new vote.</p>
          </div>
        )}
        {error && <p className={error === "Join link copied." ? "form-success" : "form-error"} role="status">{error}</p>}
        <button type="button" className="ghost-button" onClick={() => setStep("shortlist")}>Back to shortlist</button>
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
