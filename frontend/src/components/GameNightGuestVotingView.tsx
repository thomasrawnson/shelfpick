import { useEffect, useRef, useState } from "react"

import {
  getGameNightVotingGuestState,
  joinGameNightVoting,
  submitGameNightBallot,
  correctGameNightGuest,
  removeGameNightGuest,
  type GameNightVotingPublicState,
} from "../api/client"
import BrandLogo from "./ui/BrandLogo"
import RetryNotice from "./ui/RetryNotice"
import { clearCredential, getCredential, isNativeIos, saveCredential } from "../native-secure-storage"
import { PHONE_VOTING_V1_AVAILABLE } from "../game-night-availability"


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
  const [savedCredential, setSavedCredential] = useState<{ key: string; value: string | null } | null>(null)
  const credentialReady = savedCredential?.key === storageKey
  const credential = credentialReady ? savedCredential.value : null
  const [state, setState] = useState<GameNightVotingPublicState | null>(null)
  const [displayName, setDisplayName] = useState("")
  const [correctedName, setCorrectedName] = useState("")
  const nicknameDirty = useRef(false)
  const [privacyMessage, setPrivacyMessage] = useState("")
  const [guestRemoved, setGuestRemoved] = useState(false)
  const [selection, setSelection] = useState<Selection>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    let active = true
    void getCredential(storageKey).then((saved) => {
      if (!active) return
      setSavedCredential({ key: storageKey, value: saved })
    }).catch((failure) => {
      if (!active) return
      setError(failure instanceof Error ? failure.message : "Couldn't restore this guest session.")
      setLoading(false)
    })
    return () => { active = false }
  }, [storageKey, refreshKey])

  useEffect(() => {
    if (!PHONE_VOTING_V1_AVAILABLE || !credentialReady || guestRemoved) return
    let active = true
    const interval = setInterval(() => { void load() }, 4000)

    async function load() {
      try {
        const next = await getGameNightVotingGuestState(joinToken, credential)
        if (!active) return
        setState(next)
        if (next.guest && !nicknameDirty.current) setCorrectedName(next.guest.display_name)
        setError("")
        if (credential && !next.guest) {
          await clearCredential(storageKey)
          setSavedCredential({ key: storageKey, value: null })
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
  }, [credential, credentialReady, guestRemoved, joinToken, refreshKey, storageKey])

  async function join() {
    setSubmitting(true)
    setError("")
    try {
      const next = await joinGameNightVoting(joinToken, displayName)
      if (!next.guest_credential) throw new Error("ShelfPick couldn't restore this guest session.")
      await saveCredential(storageKey, next.guest_credential)
      setSavedCredential({ key: storageKey, value: next.guest_credential })
      setGuestRemoved(false)
      nicknameDirty.current = false
      setCorrectedName(next.guest?.display_name ?? "")
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

  async function updateNickname() {
    if (!credential || !correctedName.trim()) return
    setSubmitting(true)
    setError("")
    try {
      const name = correctedName.trim()
      await correctGameNightGuest(joinToken, credential, name)
      nicknameDirty.current = false
      setState(current => current?.guest ? {
        ...current, guest: { ...current.guest, display_name: name },
      } : current)
      setPrivacyMessage("Nickname updated for this Game Night.")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't update your nickname.")
    } finally { setSubmitting(false) }
  }

  async function removeMyData() {
    if (!credential || !window.confirm("Remove your nickname and vote from this Game Night?")) return
    setSubmitting(true)
    setError("")
    try {
      await removeGameNightGuest(joinToken, credential)
      await clearCredential(storageKey)
      setSavedCredential({ key: storageKey, value: null })
      setState(null)
      setGuestRemoved(true)
      setPrivacyMessage("Your guest nickname and vote were removed.")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't remove your guest data.")
    } finally { setSubmitting(false) }
  }

  if (!PHONE_VOTING_V1_AVAILABLE) {
    return <section className="screen game-night-screen game-night-guest-screen">
      <BrandLogo />
      <header>
        <p className="eyebrow">ShelfPick Game Night</p>
        <h1>Phone voting isn’t available</h1>
      </header>
      <p className="form-help">You can still choose a game together with your host. No new phone votes can be joined or cast in this version.</p>
      {!credentialReady && !error && <p role="status">Checking this device for an earlier guest entry…</p>}
      {error && !credential && <RetryNotice message={error} onRetry={() => setRefreshKey(value => value + 1)} />}
      {credentialReady && !credential && !guestRemoved && !error &&
        <p className="form-help">Guest information from an earlier vote can only be managed here on the device used to join.</p>}
      {privacyMessage && <p role="status" className="form-success">{privacyMessage}</p>}
      {credential && <section aria-labelledby="guest-privacy-heading" className="game-night-guest-privacy">
        <h2 id="guest-privacy-heading">Your earlier guest information</h2>
        <p className="form-help">This device holds the credential for your earlier entry. You can change its nickname or remove its nickname and vote, even though voting is unavailable.</p>
        {error && <p className="form-error" role="alert">{error}</p>}
        <label htmlFor="guest-corrected-name">New nickname</label>
        <input id="guest-corrected-name" value={correctedName} maxLength={40} onChange={event => setCorrectedName(event.target.value)} />
        <button type="button" className="secondary-button" disabled={submitting || !correctedName.trim()} onClick={() => void updateNickname()}>Update nickname</button>
        <button type="button" className="secondary-button" disabled={submitting} onClick={() => void removeMyData()}>Remove my guest data</button>
      </section>}
    </section>
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
          <label htmlFor="game-night-guest-name">Nickname (not your real name)</label>
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
            No account or email needed. Use a nickname. The host sees your nickname and group totals, not your individual choice. This {isNativeIos ? "app" : "browser"} keeps your vote for this Game Night; joining on another device could count twice.
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
      {privacyMessage && <p role="status" className="form-success">{privacyMessage}</p>}
      {credential && <section aria-labelledby="guest-privacy-heading" className="game-night-guest-privacy">
        <h2 id="guest-privacy-heading">Your guest information</h2>
        <p className="form-help">Edit or remove your nickname and vote, even after voting closes. This device proves which entry is yours.</p>
        {error && state && !(state.status === "open" && state.guest) && <p className="form-error" role="alert">{error}</p>}
        <label htmlFor="guest-corrected-name">Your nickname</label>
        <input id="guest-corrected-name" value={correctedName} maxLength={40} onChange={event => { nicknameDirty.current = true; setCorrectedName(event.target.value) }} />
        <button type="button" className="secondary-button" disabled={submitting || !correctedName.trim()} onClick={() => void updateNickname()}>Update nickname</button>
        <button type="button" className="secondary-button" disabled={submitting} onClick={() => void removeMyData()}>Remove my guest data</button>
      </section>}
    </section>
  )
}


export default GameNightGuestVotingView
