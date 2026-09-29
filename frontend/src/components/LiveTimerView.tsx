import { useEffect, useState } from "react"
import type { Game } from "../api/client"
import { useLiveTimer } from "../live-timer"
import { elapsedSeconds, formatElapsed } from "../live-timer-utils"
import PlayLogForm from "./collection/PlayLogForm"

function timerGame(timer: NonNullable<ReturnType<typeof useLiveTimer>["timer"]>): Game {
  return {
    ...timer.game, year_published: null, min_players: null, max_players: null,
    min_play_time: null, max_play_time: null, min_age: null, complexity: null,
    rating: null, owned: true, categories: [], mechanics: [],
  }
}

type RecoveryProps = {
  timer: NonNullable<ReturnType<typeof useLiveTimer>["timer"]>
  onBack: () => void
  playSaved: boolean
  onPlaySaved: () => Promise<void>
}

export function LiveTimerRecovery({ timer, onBack, playSaved, onPlaySaved }: RecoveryProps) {
  const elapsed = elapsedSeconds(timer)
  const wasActive = timer.status !== "finished"
  const statusDescription = timer.status === "running"
    ? "This timer was running when Pro access changed."
    : timer.status === "paused"
      ? "This timer was paused when Pro access changed."
      : "This timer finished before Pro access changed."

  return <section className="screen live-timer-screen live-timer-recovery-screen">
    <button type="button" className="collection-back" onClick={onBack}>← Back</button>
    <header>
      <h1>{timer.game.name}</h1>
      <p>{timer.status === "finished" ? "Finished timer retained" : "Live timer retained"}</p>
    </header>
    <p className="live-timer-clock" aria-label={`Retained duration ${formatElapsed(elapsed)}`}>{formatElapsed(elapsed)}</p>
    <section className="live-timer-recovery-note" aria-labelledby="timer-access-heading">
      <h2 id="timer-access-heading">Pro access changed</h2>
      <p>{statusDescription} Its saved details are safe, but live timer controls require Pro.</p>
      {wasActive
        ? <p>Nothing was finished, discarded or cleared. If Pro returns, this timer and its controls will be restored.</p>
        : <p>Save the finished play below. The retained timer is removed only after that save succeeds.</p>}
    </section>
    {playSaved && <p className="live-timer-recovery-saved" role="status">
      {wasActive ? "Manual play saved. Your retained timer was not changed." : "Timed play saved."}
    </p>}
    <div className="live-timer-recovery-form-heading">
      <h2>{wasActive ? "Log this play manually" : "Save your finished play"}</h2>
      <p>{wasActive
        ? "Manual play logging remains available. Saving here will not finish or discard the retained timer."
        : "Review the retained duration and details before saving."}</p>
    </div>
    <PlayLogForm
      game={timerGame(timer)}
      presentation="dedicated"
      initialPlayerCount={Math.max(1, timer.draft.participant_names?.length ?? 1)}
      initialPlayerNames={timer.draft.participant_names ?? []}
      initialDurationMinutes={Math.max(0, Math.round(elapsed / 60))}
      initialLocation={timer.draft.location ?? ""}
      timerSessionId={timer.status === "finished" ? timer.public_id : null}
      onSaved={onPlaySaved}
    />
  </section>
}

function LiveTimerView({ onBack }: { onBack: () => void }) {
  const { enabled, timer, loading, pending, error, pause, resume, finish, discard } = useLiveTimer()
  const [, redraw] = useState(0)
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const [playSaved, setPlaySaved] = useState(false)
  useEffect(() => {
    if (!enabled || timer?.status !== "running") return
    const id = window.setInterval(() => redraw(value => value + 1), 1000)
    return () => window.clearInterval(id)
  }, [enabled, timer?.public_id, timer?.status])

  if (loading) return <section className="screen live-timer-screen"><h1>Live timer</h1><p role="status">Restoring timer...</p></section>
  if (!timer) return <section className="screen live-timer-screen"><button className="collection-back" onClick={onBack}>← Back</button>{playSaved ? <><h1>Play saved</h1><p role="status">Your timed play was saved.</p></> : <><h1>No retained timer</h1>{error && <p className="error-message" role="alert">{error}</p>}<p>{enabled ? "Start one from a game's play form." : "Manual play logging remains available from any game in Collection."}</p></>}</section>

  if (!enabled) return <LiveTimerRecovery
    timer={timer}
    onBack={onBack}
    playSaved={playSaved}
    onPlaySaved={async () => { setPlaySaved(true) }}
  />

  const elapsed = elapsedSeconds(timer)
  const game = timerGame(timer)
  return <section className="screen live-timer-screen">
    <button type="button" className="collection-back" onClick={onBack}>← Back</button>
    <header><h1>{timer.game.name}</h1><p>{timer.status === "running" ? "Timer running" : timer.status === "paused" ? "Timer paused" : "Review this play before saving"}</p></header>
    <p className="live-timer-clock" aria-live="off">{formatElapsed(elapsed)}</p>
    {error && <p className="error-message" role="alert">{error}</p>}
    {timer.status !== "finished" && <div className="live-timer-controls">
      {timer.status === "running"
        ? <button className="secondary-button" type="button" disabled={pending} onClick={() => void pause()}>Pause</button>
        : <button className="secondary-button" type="button" disabled={pending} onClick={() => void resume()}>Resume</button>}
      <button className="primary-button" type="button" disabled={pending} onClick={() => void finish()}>Finish</button>
    </div>}
    {timer.status === "finished" && <PlayLogForm
      game={game}
      presentation="dedicated"
      initialPlayerCount={Math.max(1, timer.draft.participant_names?.length ?? 1)}
      initialPlayerNames={timer.draft.participant_names ?? []}
      initialDurationMinutes={Math.max(0, Math.round(elapsed / 60))}
      initialLocation={timer.draft.location ?? ""}
      timerSessionId={timer.public_id}
      onSaved={async () => { setPlaySaved(true) }}
    />}
    <div className="live-timer-discard">
      {!confirmDiscard ? <button type="button" className="ghost-button" onClick={() => setConfirmDiscard(true)}>Discard timer</button> : <div className="live-timer-discard-confirm" role="group" aria-label="Confirm timer discard">
        <p>Discard this timer and its unsaved duration?</p>
        <button type="button" className="danger-button" disabled={pending} onClick={() => void discard()}>Yes, discard</button>
        <button type="button" className="ghost-button" onClick={() => setConfirmDiscard(false)}>Keep timer</button>
      </div>}
    </div>
  </section>
}

export default LiveTimerView
