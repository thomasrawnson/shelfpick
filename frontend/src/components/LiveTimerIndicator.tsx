import { useEffect, useState } from "react"
import { useLiveTimer } from "../live-timer"
import { elapsedSeconds, formatElapsed } from "../live-timer-utils"

function LiveTimerIndicator({ onOpen }: { onOpen: () => void }) {
  const { timer } = useLiveTimer()
  const [, redraw] = useState(0)
  useEffect(() => {
    if (timer?.status !== "running") return
    const id = window.setInterval(() => redraw(value => value + 1), 1000)
    return () => window.clearInterval(id)
  }, [timer?.public_id, timer?.status])
  if (!timer) return null
  const stateLabel = timer.status === "running" ? "Running" : timer.status === "paused" ? "Paused" : "Ready to save"
  const elapsed = formatElapsed(elapsedSeconds(timer))
  return <button type="button" className="live-timer-indicator" onClick={onOpen}
    aria-label={`Open timer for ${timer.game.name}. ${elapsed}, ${stateLabel}.`}>
    <span className="live-timer-indicator-copy"><strong>{timer.game.name}</strong><small>{stateLabel}</small></span>
    <span className="live-timer-indicator-time">{elapsed}</span>
  </button>
}

export default LiveTimerIndicator
