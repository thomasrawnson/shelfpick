import type { CoopResult, OutcomeType, PlayParticipant } from "../api/client"
import type { KeyValueStore } from "./store"

// Plays logged without a connection wait here until they reach the server (SP-NATIVE-01c).
//
// - Every play has a random client_id. The server keeps one play per (account, client_id), so
//   sending a play again after a lost response is safe: it answers with the play it already has.
// - An item leaves the queue only after a 2xx. A network failure keeps it, waits with exponential
//   backoff and stops the run, so plays reach the server in the order they were logged.
// - A 4xx the server will not accept marks the item failed. It stays for Retry or Discard and does
//   not block the plays behind it.
// - The queue holds the play only. It never holds the sign-in token.

export interface PlayPayload {
  client_id: string
  bgg_id: number
  played_at: string
  duration_minutes: number | null
  location?: string | null
  timer_session_id?: string | null
  picker_session_id?: string | null
  participants: PlayParticipant[]
  outcome_type: OutcomeType
  coop_result: CoopResult | null
  scoresheet_id?: number | null
  scoresheet_version?: number | null
  result_override?: boolean
}

export type SendResult =
  | { kind: "ok"; playId: number }
  | { kind: "retry"; message: string }
  | { kind: "rejected"; message: string; status: number }
  | { kind: "auth" }

export interface QueuedPlay {
  clientId: string
  seq: number
  createdAt: string
  payload: PlayPayload
  status: "pending" | "failed"
  attempts: number
  nextAttemptAt: number
  error: string | null
}

export type SyncSummary = {
  synced: number
  failed: number
  stopped: "retry" | "auth" | null
}

export type MutationResult = { ok: true } | { ok: false; reason: "missing" | "synced" }

export const BACKOFF_BASE_MS = 2_000
export const BACKOFF_MAX_MS = 5 * 60_000

export function backoffDelay(attempts: number, random: () => number = Math.random): number {
  const exponential = Math.min(BACKOFF_MAX_MS, BACKOFF_BASE_MS * 2 ** Math.max(0, attempts - 1))
  return Math.round(exponential * (0.8 + random() * 0.4))
}

// Only these fields are stored, so a stray field (a token, say) on an object can never be persisted.
export function cleanPayload(payload: PlayPayload): PlayPayload {
  const clean: PlayPayload = {
    client_id: payload.client_id,
    bgg_id: payload.bgg_id,
    played_at: payload.played_at,
    duration_minutes: payload.duration_minutes,
    participants: payload.participants.map((participant) => ({
      name: participant.name,
      score: participant.score,
      is_winner: participant.is_winner,
      team: participant.team ?? null,
      rank: participant.rank ?? null,
      role: participant.role ?? null,
      score_breakdown: participant.score_breakdown ?? null,
    })),
    outcome_type: payload.outcome_type,
    coop_result: payload.coop_result,
  }
  for (const key of ["location", "timer_session_id", "picker_session_id", "scoresheet_id", "scoresheet_version", "result_override"] as const) {
    if (payload[key] !== undefined) (clean as unknown as Record<string, unknown>)[key] = payload[key]
  }
  return clean
}

type Options = {
  store: KeyValueStore
  key: string
  send: (payload: PlayPayload) => Promise<SendResult>
  now?: () => number
  random?: () => number
  onSynced?: (item: QueuedPlay, playId: number) => void
}

type PersistedQueue = { v: 1; nextSeq: number; items: QueuedPlay[] }

export function createPlayQueue({ store, key, send, now = Date.now, random = Math.random, onSynced }: Options) {
  let items: QueuedPlay[] = []
  let nextSeq = 1
  let loaded: Promise<void> | null = null
  let tail: Promise<unknown> = Promise.resolve()
  let running: Promise<SyncSummary> | null = null
  let inFlight: { clientId: string; done: Promise<void> } | null = null
  const listeners = new Set<() => void>()

  function emit() { for (const listener of listeners) listener() }

  async function persist() {
    const state: PersistedQueue = { v: 1, nextSeq, items }
    await store.set(key, JSON.stringify(state))
  }

  // One change at a time, each saved before the next starts.
  function mutate<T>(change: () => T | Promise<T>): Promise<T> {
    const result = tail.then(() => load()).then(async () => {
      const value = await change()
      await persist()
      emit()
      return value
    })
    tail = result.catch(() => undefined)
    return result
  }

  function load(): Promise<void> {
    loaded ??= (async () => {
      const raw = await store.get(key)
      if (raw === null) return
      try {
        const state = JSON.parse(raw) as PersistedQueue
        if (state?.v !== 1 || !Array.isArray(state.items)) throw new Error("unrecognised queue")
        items = state.items
        nextSeq = Math.max(state.nextSeq ?? 1, ...items.map((item) => item.seq + 1), 1)
      } catch {
        // Keep what was there rather than overwrite it with an empty queue.
        await store.set(`${key}.unreadable`, raw)
      }
      emit()
    })()
    return loaded
  }

  function find(clientId: string) { return items.find((item) => item.clientId === clientId) }

  async function afterSend(clientId: string, result: SendResult): Promise<"continue" | "stop"> {
    if (result.kind === "ok") {
      const item = find(clientId)
      await mutate(() => { items = items.filter((queued) => queued.clientId !== clientId) })
      if (item) onSynced?.(item, result.playId)
      return "continue"
    }
    if (result.kind === "rejected") {
      await mutate(() => {
        items = items.map((item) => item.clientId === clientId ? { ...item, status: "failed", error: result.message } : item)
      })
      return "continue"
    }
    if (result.kind === "retry") {
      await mutate(() => {
        items = items.map((item) => item.clientId === clientId
          ? { ...item, attempts: item.attempts + 1, nextAttemptAt: now() + backoffDelay(item.attempts + 1, random), error: result.message }
          : item)
      })
    }
    return "stop"
  }

  async function run(force: boolean): Promise<SyncSummary> {
    await load()
    const summary: SyncSummary = { synced: 0, failed: 0, stopped: null }
    const attempted = new Set<string>()
    for (;;) {
      const next = items
        .filter((item) => item.status === "pending" && !attempted.has(item.clientId))
        .sort((a, b) => a.seq - b.seq)[0]
      if (!next) return summary
      if (!force && next.nextAttemptAt > now()) { summary.stopped = "retry"; return summary }
      attempted.add(next.clientId)
      let release: () => void = () => undefined
      inFlight = { clientId: next.clientId, done: new Promise<void>((resolve) => { release = resolve }) }
      let result: SendResult
      try {
        result = await send(next.payload)
      } catch (error) {
        result = { kind: "retry", message: error instanceof Error ? error.message : "Couldn't reach ShelfPick." }
      }
      let verdict: "continue" | "stop"
      try {
        verdict = await afterSend(next.clientId, result)
      } finally {
        inFlight = null
        release()
      }
      if (result.kind === "ok") summary.synced += 1
      if (result.kind === "rejected") summary.failed += 1
      if (verdict === "stop") {
        summary.stopped = result.kind === "auth" ? "auth" : "retry"
        return summary
      }
    }
  }

  // An edit or delete that arrives while that play is being sent waits for the answer first.
  async function settled(clientId: string): Promise<void> {
    if (inFlight?.clientId === clientId) await inFlight.done
  }

  return {
    load,
    items: (): QueuedPlay[] => items,
    subscribe(listener: () => void): () => void {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },

    async enqueue(payload: PlayPayload): Promise<QueuedPlay> {
      return mutate(() => {
        const item: QueuedPlay = {
          clientId: payload.client_id,
          seq: nextSeq++,
          createdAt: new Date(now()).toISOString(),
          payload: cleanPayload(payload),
          status: "pending",
          attempts: 0,
          nextAttemptAt: 0,
          error: null,
        }
        const existing = find(item.clientId)
        items = existing ? items.map((queued) => queued === existing ? { ...item, seq: existing.seq } : queued) : [...items, item]
        return item
      })
    },

    // Editing a waiting play changes what will be sent; a failed play goes back to waiting.
    async update(clientId: string, payload: PlayPayload): Promise<MutationResult> {
      await load()
      await settled(clientId)
      return mutate((): MutationResult => {
        const existing = find(clientId)
        if (!existing) return { ok: false, reason: "synced" }
        items = items.map((item) => item.clientId === clientId
          ? { ...item, payload: cleanPayload({ ...payload, client_id: clientId }), status: "pending", attempts: 0, nextAttemptAt: 0, error: null }
          : item)
        return { ok: true }
      })
    },

    async remove(clientId: string): Promise<MutationResult> {
      await load()
      await settled(clientId)
      return mutate((): MutationResult => {
        if (!find(clientId)) return { ok: false, reason: "synced" }
        items = items.filter((item) => item.clientId !== clientId)
        return { ok: true }
      })
    },

    async retry(clientId: string): Promise<MutationResult> {
      await load()
      return mutate((): MutationResult => {
        const existing = find(clientId)
        if (!existing) return { ok: false, reason: "missing" }
        items = items.map((item) => item.clientId === clientId
          ? { ...item, status: "pending", attempts: 0, nextAttemptAt: 0, error: null }
          : item)
        return { ok: true }
      })
    },

    // One run at a time. Waiting is skipped when force is set (Sync now).
    sync(options: { force?: boolean } = {}): Promise<SyncSummary> {
      running ??= run(options.force === true).finally(() => { running = null })
      return running
    },

    // When the next waiting play is due, or null when nothing waits.
    nextDueAt(): number | null {
      const waiting = items.filter((item) => item.status === "pending")
      return waiting.length ? Math.min(...waiting.map((item) => item.nextAttemptAt)) : null
    },
  }
}

export type PlayQueue = ReturnType<typeof createPlayQueue>

export function queueKey(userId: number): string {
  return `shelfpick.offline.plays.${userId}`
}

// Account deletion: the plays that never synced go with the account.
export async function clearPlayQueue(store: KeyValueStore, userId: number): Promise<void> {
  await store.remove(queueKey(userId))
  await store.remove(`${queueKey(userId)}.unreadable`)
}
