import { useEffect, useState } from "react"

import {
  getGameNightVotingGuestState,
  joinGameNightVoting,
  submitGameNightBallot,
  type GameNightVotingPublicState,
} from "../api/client"
import BrandLogo from "./ui/BrandLogo"
import RetryNotice from "./ui/RetryNotice"


type Props = {
  joinToken: string
}

type Selection = number | "abstain" | null


function credentialKey(joinToken: string) {
  return `shelfpick-game-night-guest:${joinToken}`
}


function Results({ state }: { state: GameNightVotingPublicState }) {
  const results = state.results
  if (!results) return null
  const counts = new Map(results.counts.map((item) => [item.bgg_id, item.votes]))
  const heading = results.outcome === "no_votes"
    ? "No votes were cast"
    : results.outcome === "tie"
      ? "The vote is tied"
      : "The votes are in"

  return (
    <section className="game-night-guest-results" aria-labelledby="guest-results-heading">
      <h2 id="guest-results-heading">{heading}</h2>
      <ol className="game-night-vote-results">
        {state.candidates.map((candidate) => (
          <li key={candidate.bgg_id}>
            <span>{candidate.name}</span>
            <strong>{counts.get(candidate.bgg_id) ?? 0} votes</strong>
            {results.winner_bgg_ids.includes(candidate.bgg_id) && (
              <span className="game-night-result-label">
                {results.outcome === "tie" ? "Joint leader" : "Voting winner"}
              </span>
            )}
          </li>
        ))}
      </ol>
      {results.abstain_count > 0 && (
        <p>{results.abstain_count} {results.abstain_count === 1 ? "person abstained" : "people abstained"}.</p>
      )}
      <p>The host will confirm the final game.</p>
    </section>
  )
}


function GameNightGuestVotingView({ joinToken }: Props) {
  const storageKey = credentialKey(joinToken)
  const [credential, setCredential] = useState(() => localStorage.getItem(storageKey))
  const [state, setState] = useState<GameNightVotingPublicState | null>(null)
  const [displayName, setDisplayName] = useState("")
  const [selection, setSelection] = useState<Selection>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    let active = true
    const interval = setInterval(() => { void load() }, 4000)

    async function load() {
      try {
        const next = await getGameNightVotingGuestState(joinToken, credential)
        if (!active) return
        setState(next)
        setError("")
        if (credential && !next.guest) {
          localStorage.removeItem(storageKey)
          setCredential(null)
        }
        if (next.guest?.has_submitted) {
          setSelection(next.guest.current_vote ?? "abstain")
        }
        if (next.status !== "open") clearInterval(interval)
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : "Couldn't load this voting session.")
        }
      } finally {
        if (active) setLoading(false)
      }
    }

    void load()
    return () => {
      active = false
      clearInterval(interval)
    }
  }, [credential, joinToken, refreshKey, storageKey])

  async function join() {
    setSubmitting(true)
    setError("")
    try {
      const next = await joinGameNightVoting(joinToken, displayName)
      if (!next.guest_credential) throw new Error("ShelfPick couldn't restore this guest session.")
      localStorage.setItem(storageKey, next.guest_credential)
      setCredential(next.guest_credential)
      setState(next)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't join this voting session.")
    } finally {
      setSubmitting(false)
    }
  }

  async function submitVote() {
    if (!credential || selection === null) return
    setSubmitting(true)
    setError("")
    try {
      const next = await submitGameNightBallot(
        joinToken,
        credential,
        selection === "abstain" ? null : selection,
      )
      setState(next)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save your vote.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="screen game-night-screen game-night-guest-screen">
      <BrandLogo />
      <header>
        <p className="eyebrow">ShelfPick Game Night</p>
        <h1>Vote for tonight’s game</h1>
      </header>

      {loading && <p role="status">Loading voting session…</p>}
      {error && !state && (
        <RetryNotice message={error} onRetry={() => {
          setLoading(true)
          setRefreshKey((value) => value + 1)
        }} />
      )}

      {state?.status === "closed" && <Results state={state} />}

      {state?.status === "open" && !state.guest && (
        <form onSubmit={(event) => { event.preventDefault(); void join() }} className="game-night-join-form">
          <label htmlFor="game-night-guest-name">Your display name</label>
          <input
            id="game-night-guest-name"
            value={displayName}
            maxLength={40}
            autoComplete="nickname"
            onChange={(event) => setDisplayName(event.target.value)}
          />
          <button className="primary-button" type="submit" disabled={submitting || !displayName.trim()}>
            {submitting ? "Joining…" : "Join voting"}
          </button>
          <p className="form-help">
            No ShelfPick account is needed. This browser identifies your ballot for this session.
            A different browser or device could join again, so this cannot prove one vote per real person.
          </p>
        </form>
      )}

      {state?.status === "open" && state.guest && (
        <form onSubmit={(event) => { event.preventDefault(); void submitVote() }} className="game-night-ballot">
          <fieldset>
            <legend>Choose one game</legend>
            {state.candidates.map((candidate) => (
              <label key={candidate.bgg_id} className="game-night-ballot-option">
                <input
                  type="radio"
                  name="game-night-vote"
                  checked={selection === candidate.bgg_id}
                  onChange={() => setSelection(candidate.bgg_id)}
                />
                {candidate.thumbnail_url && <img src={candidate.thumbnail_url} alt="" />}
                <span>{candidate.name}</span>
              </label>
            ))}
            <label className="game-night-ballot-option game-night-abstain-option">
              <input
                type="radio"
                name="game-night-vote"
                checked={selection === "abstain"}
                onChange={() => setSelection("abstain")}
              />
              <span>Abstain from this vote</span>
            </label>
          </fieldset>
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="primary-button" type="submit" disabled={submitting || selection === null}>
            {submitting
              ? "Saving…"
              : state.guest.has_submitted
                ? "Update vote"
                : "Submit vote"}
          </button>
          {state.guest.has_submitted && (
            <p className="form-success" role="status">Your ballot is saved. You can change it until voting closes.</p>
          )}
          <p className="form-help">Joined as {state.guest.display_name}. Keep this page open for results.</p>
        </form>
      )}
    </section>
  )
}


export default GameNightGuestVotingView
