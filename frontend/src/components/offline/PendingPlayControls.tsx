import { useState } from "react"

import type { GamePlay } from "../../api/client"
import { usePlaySync } from "../../offline/play-sync-context"

type Props = {
  play: GamePlay
  // Also offer Delete for a play that is simply waiting (history already has its own Delete).
  withDelete?: boolean
  onChanged?: () => void
}

// The badge for a play logged on this device, and for one the server refused: Retry, and Discard
// after a confirmation.
function PendingPlayControls({ play, withDelete = false, onChanged }: Props) {
  const { retryQueued, discardQueued } = usePlaySync()
  const [confirming, setConfirming] = useState(false)
  const [message, setMessage] = useState("")
  const failed = Boolean(play.sync_error)
  if (!play.pending || !play.client_id) return null
  const clientId = play.client_id

  async function discard() {
    const result = await discardQueued(clientId)
    setConfirming(false)
    if (!result.ok) setMessage("This play just synced. Delete it from the play's history instead.")
    onChanged?.()
  }

  return (
    <div className={failed ? "pending-play pending-play-failed" : "pending-play"}>
      <span className="pending-badge">{failed ? "Couldn't sync" : "Pending sync"}</span>
      {failed && <span className="pending-reason">{play.sync_error}</span>}
      {message && <span className="pending-reason" role="alert">{message}</span>}
      {confirming ? (
        <span className="pending-confirm">
          <span>Discard this play? It was never saved.</span>
          <button type="button" className="ghost-button" onClick={() => setConfirming(false)}>Cancel</button>
          <button type="button" className="delete-play-confirm-button" onClick={() => void discard()}>Discard play</button>
        </span>
      ) : (
        <span className="pending-actions">
          {failed && <button type="button" className="secondary-button" onClick={() => { void retryQueued(clientId) }}>Retry</button>}
          {(failed || withDelete) && (
            <button type="button" className="delete-play-button" onClick={() => setConfirming(true)}>
              {failed ? "Discard" : "Delete"}
            </button>
          )}
        </span>
      )}
    </div>
  )
}

export default PendingPlayControls
