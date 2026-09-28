import { useEffect, useRef, useState } from "react"
import { addGameToCollection, completeOnboarding, searchBGGGames, syncBGGCollection, type BGGSearchResult } from "../api/client"
import type { AuthUser } from "../auth"
import BrandLogo from "./ui/BrandLogo"
import AvatarPicker from "./ui/AvatarPicker"
import type { AvatarId } from "../avatar-catalog"
import { timeBand, trackEvent } from "../telemetry"

type Props = { displayName: string | null; onComplete: (user: AuthUser) => void }
const counts = [1, 2, 3, 4, 5, 6]
const times = [30, 60, 90, 120, 0]

function OnboardingView({ displayName, onComplete }: Props) {
  const screenRef = useRef<HTMLElement>(null)
  const syncPending = useRef(false)
  const finishPending = useRef(false)
  const [step, setStep] = useState(0)
  const [username, setUsername] = useState("")
  const [syncing, setSyncing] = useState(false)
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<BGGSearchResult[]>([])
  const [searched, setSearched] = useState(false)
  const [searching, setSearching] = useState(false)
  const [addingId, setAddingId] = useState<number | null>(null)
  const [added, setAdded] = useState<number[]>([])
  const [playerCount, setPlayerCount] = useState<number | null>(null)
  const [playTime, setPlayTime] = useState<number | null>(null)
  const [name, setName] = useState(displayName ?? "")
  const [avatar, setAvatar] = useState<AvatarId>("forest")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    screenRef.current?.scrollTo(0, 0)
    screenRef.current?.closest(".phone")?.scrollTo(0, 0)
    window.scrollTo(0, 0)
  }, [step])

  async function importShelf() {
    if (!username.trim() || syncPending.current) return
    syncPending.current = true
    setSyncing(true); setError("")
    try {
      const result = await syncBGGCollection(username.trim())
      trackEvent("collection_import_completed", { source: "onboarding_bgg", result_count: result.games_synced })
      setStep(2)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not import your shelf.")
    } finally { syncPending.current = false; setSyncing(false) }
  }
  async function searchGames() {
    if (!query.trim()) return
    setSearching(true); setError("")
    try { setResults(await searchBGGGames(query.trim())); setSearched(true) }
    catch (err) { setError(err instanceof Error ? err.message : "Could not search games.") }
    finally { setSearching(false) }
  }
  async function addGame(id: number) {
    setAddingId(id); setError("")
    try { await addGameToCollection(id); setAdded((current) => [...current, id]) }
    catch (err) { setError(err instanceof Error ? err.message : "Could not add this game.") }
    finally { setAddingId(null) }
  }
  async function finish() {
    if (finishPending.current) return
    if (!name.trim()) { setError("Enter a player name to continue."); return }
    finishPending.current = true
    setBusy(true); setError("")
    try {
      const completedUser = await completeOnboarding({
        player_name: name.trim(), avatar_key: avatar,
        preferred_player_count: playerCount, preferred_play_time: playTime,
      })
      trackEvent("onboarding_completed", {
        source: "onboarding", player_count: playerCount ?? undefined, time_band: timeBand(playTime),
      })
      onComplete(completedUser)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not finish setup.")
    } finally { finishPending.current = false; setBusy(false) }
  }

  return <section className="onboarding-screen" ref={screenRef}>
    <header className="onboarding-header">
      <BrandLogo />
      <p className="eyebrow">Welcome to ShelfPick</p>
      <h1>{["Spend less time choosing. Spend more time playing.", "Build your shelf",
        "How do you usually play?", "Your player identity"][step]}</h1>
      <p className="subtitle">{[
        "Find a game that fits your collection and your table.",
        "Bring in your games now, or do it later.",
        "These become starting choices in Pick. Change them anytime.",
        "A simple identity for Pick, Plays and Game Night.",
      ][step]}</p>
    </header>
    <p className="onboarding-step-label">Step {step + 1} of 4</p>
    <div className="onboarding-progress" aria-label={"Step " + (step + 1) + " of 4"}>
      {[0, 1, 2, 3].map((index) => <span key={index}
        className={index === step ? "active" : index < step ? "complete" : ""}>{index + 1}</span>)}
    </div>
    {step === 0 && <div className="onboarding-card">
      <h2>Let's get your shelf ready</h2>
      <p>Four quick steps, then straight to Pick.</p>
      <button type="button" className="primary-button" onClick={() => setStep(1)}>Get started</button>
    </div>}
    {step === 1 && <div className="onboarding-card">
      <h2>Import from BGG</h2>
      <label className="setup-label" htmlFor="onboarding-bgg">BoardGameGeek username</label>
      <input id="onboarding-bgg" className="setup-input" value={username}
        autoCapitalize="none" autoCorrect="off" placeholder="Your BGG username"
        onChange={(event) => setUsername(event.target.value)} />
      <button type="button" className="primary-button setup-button"
        disabled={syncing || !username.trim()} onClick={() => void importShelf()}>
        {syncing ? "Importing..." : "Import from BGG"}</button>
      <div className="onboarding-divider">or add games manually</div>
      <form onSubmit={(event) => { event.preventDefault(); void searchGames() }}>
        <label className="setup-label" htmlFor="onboarding-game">Game name</label>
        <div className="onboarding-search-row">
          <input id="onboarding-game" className="setup-input" value={query}
            onChange={(event) => setQuery(event.target.value)} placeholder="e.g. Catan" />
          <button type="submit" className="secondary-button" disabled={searching || !query.trim()}>
            {searching ? "Searching..." : "Search"}</button>
        </div>
      </form>
      {results.length > 0 && <ul className="onboarding-results">
        {results.map((game) => <li key={game.bgg_id}><span>{game.name}</span>
          <button type="button" className="secondary-button"
            disabled={game.owned || added.includes(game.bgg_id) || addingId === game.bgg_id}
            onClick={() => void addGame(game.bgg_id)}>
            {game.owned || added.includes(game.bgg_id) ? "Added" : "Add"}</button>
        </li>)}
      </ul>}
      {searched && results.length === 0 && <p role="status">No games found. Try a different title.</p>}
      {added.length > 0 && <p role="status">{added.length} game{added.length === 1 ? "" : "s"} added.</p>}
      <button type="button" className="secondary-button onboarding-next" onClick={() => { setError(""); setStep(2) }}>Continue</button>
      <button type="button" className="onboarding-skip" onClick={() => { setError(""); setStep(2) }}>Skip for now</button>
    </div>}
    {step === 2 && <div className="onboarding-card">
      <h2>Your usual table</h2>
      <p>Choose either, both, or skip. These are defaults, not restrictions.</p>
      <fieldset className="onboarding-fieldset"><legend>Typical player count</legend>
        <div className="onboarding-choices">{counts.map((count) => <button key={count} type="button"
          className={playerCount === count ? "onboarding-choice selected" : "onboarding-choice"}
          aria-pressed={playerCount === count} onClick={() => setPlayerCount(count)}>
          {count === 6 ? "6+" : count}</button>)}</div>
      </fieldset>
      <fieldset className="onboarding-fieldset"><legend>Typical play time</legend>
        <div className="onboarding-choices">{times.map((value) => <button key={value} type="button"
          className={playTime === value ? "onboarding-choice selected" : "onboarding-choice"}
          aria-pressed={playTime === value} onClick={() => setPlayTime(value)}>
          {value === 0 ? "Any / varies" : value + "m"}</button>)}</div>
      </fieldset>
      <button type="button" className="primary-button onboarding-next" onClick={() => { setError(""); setStep(3) }}>Continue</button>
      <button type="button" className="onboarding-skip" onClick={() => { setError(""); setStep(3) }}>Skip preferences</button>
    </div>}
    {step === 3 && <div className="onboarding-card">
      <h2>How should we show you?</h2>
      <label className="setup-label" htmlFor="onboarding-name">Player name</label>
      <input id="onboarding-name" className="setup-input" maxLength={100} value={name}
        onChange={(event) => setName(event.target.value)} />
      <AvatarPicker inputName="onboarding-avatar" name={name || "You"} value={avatar}
        onChange={setAvatar} disabled={busy} />
      <button type="button" className="primary-button onboarding-next" disabled={busy}
        onClick={() => void finish()}>{busy ? "Finishing..." : "Start picking"}</button>
    </div>}
    {error && <p className="error-message" role="alert">{error}</p>}
    {step > 0 && <button type="button" className="onboarding-skip" disabled={busy || syncing}
      onClick={() => { setError(""); setStep(step - 1) }}>Back</button>}
  </section>
}
export default OnboardingView
