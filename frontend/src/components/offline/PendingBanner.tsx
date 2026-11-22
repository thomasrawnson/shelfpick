import { useNavigate } from "react-router-dom"

import { usePlaySync } from "../../offline/play-sync-context"
import { useOnline } from "../../offline/connectivity"
import { APP_PATHS } from "../../routes"

// "N plays waiting to sync" with Sync now, and a pointer to plays the server refused.
function PendingBanner() {
  const { waiting, failed, syncing, syncNow } = usePlaySync()
  const online = useOnline()
  const navigate = useNavigate()
  if (waiting === 0 && failed.length === 0) return null

  return (
    <div className="sync-banner" role="status" aria-live="polite">
      {waiting > 0 && (
        <div className="sync-banner-row">
          <span>
            {waiting} {waiting === 1 ? "play" : "plays"} waiting to sync
            {!online && !syncing ? " · offline" : ""}
          </span>
          <button type="button" className="sync-banner-button" disabled={syncing} onClick={() => void syncNow()}>
            {syncing ? "Syncing…" : "Sync now"}
          </button>
        </div>
      )}
      {failed.length > 0 && (
        <div className="sync-banner-row sync-banner-failed">
          <span>{failed.length} {failed.length === 1 ? "play" : "plays"} couldn't be saved</span>
          <button type="button" className="sync-banner-button" onClick={() => navigate(APP_PATHS.plays)}>Review</button>
        </div>
      )}
    </div>
  )
}

export default PendingBanner
