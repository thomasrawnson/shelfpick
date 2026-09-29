import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react"
import {
  discardLiveTimer,
  finishLiveTimer,
  getLiveTimer,
  getLiveTimerRecovery,
  pauseLiveTimer,
  resumeLiveTimer,
  startLiveTimer,
  type LiveTimer,
} from "./api/client"

type TimerContextValue = {
  enabled: boolean
  timer: LiveTimer | null
  loading: boolean
  pending: boolean
  error: string
  start: (bggId: number, participantNames: string[], location: string) => Promise<void>
  pause: () => Promise<void>
  resume: () => Promise<void>
  finish: () => Promise<void>
  discard: () => Promise<void>
  refresh: () => Promise<void>
}

const LiveTimerContext = createContext<TimerContextValue | null>(null)
const unavailable = async () => undefined
const DISABLED_TIMER: TimerContextValue = {
  enabled: false, timer: null, loading: false, pending: false, error: "",
  start: unavailable, pause: unavailable, resume: unavailable, finish: unavailable,
  discard: unavailable, refresh: unavailable,
}

export function LiveTimerProvider({ enabled, children }: { enabled: boolean; children: ReactNode }) {
  const [timer, setTimer] = useState<LiveTimer | null>(null)
  const [loading, setLoading] = useState(true)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState("")
  const actionPending = useRef(false)

  const refresh = useCallback(async () => {
    try {
      setTimer(await (enabled ? getLiveTimer() : getLiveTimerRecovery()))
      setError("")
    }
    catch (err) { setError(err instanceof Error ? err.message : "Couldn't restore the live timer.") }
    finally { setLoading(false) }
  }, [enabled])

  useEffect(() => {
    const id = window.setTimeout(() => { void refresh() }, 0)
    return () => window.clearTimeout(id)
  }, [refresh])

  async function act(action: () => Promise<LiveTimer | null>) {
    if (!enabled) return
    if (actionPending.current) return
    actionPending.current = true
    setPending(true)
    setError("")
    try { setTimer(await action()) }
    catch (err) { setError(err instanceof Error ? err.message : "Couldn't update the live timer."); throw err }
    finally { actionPending.current = false; setPending(false) }
  }

  return <LiveTimerContext.Provider value={{
    enabled, timer, loading, pending, error,
    start: (bggId, names, location) => act(() => startLiveTimer(bggId, names, location)),
    pause: () => act(pauseLiveTimer),
    resume: () => act(resumeLiveTimer),
    finish: () => act(finishLiveTimer),
    discard: () => act(async () => { await discardLiveTimer(); return null }),
    refresh,
  }}>{children}</LiveTimerContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useLiveTimer(): TimerContextValue {
  const value = useContext(LiveTimerContext)
  return value ?? DISABLED_TIMER
}
