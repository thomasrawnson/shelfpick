import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react"

import { postPlay } from "../api/client"
import { lightImpact } from "../haptics"
import { isOnline, subscribeConnectivity } from "./connectivity"
import { setCacheOwner } from "./cache"
import {
  createPlayQueue,
  queueKey,
  type PlayPayload,
  type PlayQueue,
  type QueuedPlay,
  type SendResult,
} from "./play-queue"
import { newClientId } from "./client-id"
import { PlaySyncContext, type NewPlay, type PlaySync, type SubmitResult } from "./play-sync-context"
import { createDeviceStore } from "./store"

// Owns the queue of plays logged without a connection and decides when to send them: when the app
// opens, when the connection returns, when the app comes back to the foreground, on a backoff timer
// while anything waits, and on Sync now.

const NONE: QueuedPlay[] = []

async function sendToServer(payload: PlayPayload): Promise<SendResult> {
  const result = await postPlay(payload)
  return result.kind === "ok" ? { kind: "ok", playId: result.play.id } : result
}

export function PlaySyncProvider({ userId, children }: { userId: number; children: ReactNode }) {
  // Saved copies belong to this account. Layout effects of a parent run before the passive effects
  // of its children, so the first screen's reads already see the owner.
  useLayoutEffect(() => {
    setCacheOwner(userId)
    return () => setCacheOwner(null)
  }, [userId])

  const queue: PlayQueue = useMemo(
    () => createPlayQueue({ store: createDeviceStore(), key: queueKey(userId), send: sendToServer }),
    [userId],
  )
  const items = useSyncExternalStore(
    (listener) => queue.subscribe(listener),
    () => queue.items(),
    () => NONE,
  )
  const [syncing, setSyncing] = useState(false)
  const [syncedVersion, setSyncedVersion] = useState(0)
  const [timerTick, setTimerTick] = useState(0)
  const mounted = useRef(true)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])

  const runSync = useCallback(async (force: boolean) => {
    setSyncing(true)
    try {
      const summary = await queue.sync({ force })
      if (summary.synced > 0 && mounted.current) {
        void lightImpact()
        setSyncedVersion((version) => version + 1)
      }
    } finally {
      if (mounted.current) setSyncing(false)
      setTimerTick((tick) => tick + 1)
    }
  }, [queue])

  const syncNow = useCallback(() => runSync(true), [runSync])

  // Open, reconnect, foreground.
  useEffect(() => {
    let cancelled = false
    void queue.load().then(() => { if (!cancelled) void runSync(false) })
    const onOnline = () => { void runSync(true) }
    const onVisible = () => { if (document.visibilityState === "visible") void runSync(true) }
    window.addEventListener("online", onOnline)
    document.addEventListener("visibilitychange", onVisible)
    // Any successful call to the server also means the connection is back.
    let wasOnline = isOnline()
    const stopConnectivity = subscribeConnectivity(() => {
      const now = isOnline()
      if (now && !wasOnline) void runSync(true)
      wasOnline = now
    })
    return () => {
      cancelled = true
      window.removeEventListener("online", onOnline)
      document.removeEventListener("visibilitychange", onVisible)
      stopConnectivity()
    }
  }, [queue, runSync])

  // While plays wait, try again when the next one is due.
  useEffect(() => {
    const due = queue.nextDueAt()
    if (due === null) return
    const id = window.setTimeout(() => { void runSync(false) }, Math.max(1_000, due - Date.now()))
    return () => window.clearTimeout(id)
  }, [queue, items, timerTick, runSync])

  const submitPlay = useCallback(async (play: NewPlay): Promise<SubmitResult> => {
    const payload: PlayPayload = { ...play, client_id: newClientId() }
    // Plays already waiting go first, so the server sees them in the order they were logged.
    if (queue.items().some((item) => item.status === "pending")) await runSync(false)
    if (!queue.items().some((item) => item.status === "pending")) {
      const result = await postPlay(payload)
      if (result.kind === "ok") return { status: "synced", play: result.play }
      // The server refused the play (a 4xx). Nothing is queued: the person can fix it and try again.
      if (result.kind === "rejected") throw new Error(result.message)
      if (result.kind === "auth") throw new Error("Your session has expired. Please log in again.")
    }
    // No answer: keep the play on this device. The same client_id makes sending it again safe.
    await queue.enqueue(payload)
    return { status: "queued", clientId: payload.client_id }
  }, [queue, runSync])

  const value = useMemo<PlaySync>(() => ({
    items,
    waiting: items.filter((item) => item.status === "pending").length,
    failed: items.filter((item) => item.status === "failed"),
    syncing,
    syncedVersion,
    syncNow,
    submitPlay,
    updateQueued: async (clientId, changes) => {
      const existing = queue.items().find((item) => item.clientId === clientId)
      if (!existing) return { ok: false, reason: "synced" }
      return queue.update(clientId, { ...existing.payload, ...changes, client_id: clientId })
    },
    discardQueued: (clientId) => queue.remove(clientId),
    retryQueued: async (clientId) => {
      const result = await queue.retry(clientId)
      void runSync(true)
      return result
    },
  }), [items, syncing, syncedVersion, syncNow, submitPlay, queue, runSync])

  return <PlaySyncContext.Provider value={value}>{children}</PlaySyncContext.Provider>
}
