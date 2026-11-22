import { useState } from "react"

import { Analytics } from "../analytics"
import { APP_PATHS } from "../routes"
import Sheet from "./ui/Sheet"

// The one-time choice about optional usage analytics. Nothing is collected until the
// answer is "Share usage data"; either answer is stored and the choice is not asked
// again. It can be changed in Settings > Help > About.
function AnalyticsChoice() {
  // Guests opening a voting link are not asked; without a stored choice nothing is collected for them.
  const [open, setOpen] = useState(() => !Analytics.hasChoice() && !window.location.pathname.startsWith(APP_PATHS.gameNightJoin))
  if (!open) return null

  const answer = (share: boolean) => {
    Analytics.setEnabled(share)
    setOpen(false)
  }

  return <Sheet labelledBy="analytics-choice-title" onEscape={() => answer(false)}>
    <div className="analytics-choice">
      <h2 id="analytics-choice-title">Help improve ShelfPick?</h2>
      <p>ShelfPick can count which features are used, such as logging a play or opening Stats. The counts are anonymous.
        No account details, game or player names, search text or notes are included.</p>
      <p>This is optional and off unless you choose to share. You can change it any time in Settings, under Help.</p>
      <div className="analytics-choice-actions">
        <button type="button" className="primary-button" onClick={() => answer(true)}>Share usage data</button>
        <button type="button" className="secondary-button" onClick={() => answer(false)}>Not now</button>
      </div>
    </div>
  </Sheet>
}

export default AnalyticsChoice
