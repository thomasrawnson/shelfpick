import assert from "node:assert/strict"
import { test } from "node:test"

import {
  BACKOFF_BASE_MS,
  BACKOFF_MAX_MS,
  backoffDelay,
  cleanPayload,
  createPlayQueue,
  queueKey,
  type PlayPayload,
  type SendResult,
} from "./play-queue.ts"
import { createMemoryStore } from "./store.ts"

const KEY = queueKey(7)

function play(id: string, overrides: Partial<PlayPayload> = {}): PlayPayload {
  return {
    client_id: id,
    bgg_id: 100,
    played_at: "2026-11-22T12:00:00.000Z",
    duration_minutes: null,
    location: "Home",
    participants: [
      { name: "Ana", score: 10, is_winner: true },
      { name: "Ben", score: 5, is_winner: false },
      { name: "Cy", score: 3, is_winner: false },
    ],
    outcome_type: "competitive",
    coop_result: null,
    scoresheet_id: 4,
    scoresheet_version: 2,
    result_override: false,
    ...overrides,
  }
}

// A stand-in for the server: one play per client_id, like the real unique constraint.
function fakeServer(script: Array<"ok" | "lose-reply" | "offline" | "reject" | "auth"> = []) {
  const saved = new Map<string, PlayPayload>()
  const sent: string[] = []
  async function send(payload: PlayPayload): Promise<SendResult> {
    sent.push(payload.client_id)
    const step = script.shift() ?? "ok"
    if (step === "offline") return { kind: "retry", message: "You're offline." }
    if (step === "auth") return { kind: "auth" }
    if (step === "reject") return { kind: "rejected", message: "The same player can't be added twice.", status: 400 }
    if (!saved.has(payload.client_id)) saved.set(payload.client_id, payload)
    if (step === "lose-reply") return { kind: "retry", message: "This request took too long." }
    return { kind: "ok", playId: saved.size }
  }
  return { saved, sent, send }
}

function queue(store = createMemoryStore(), send = fakeServer().send, extra: { now?: () => number; random?: () => number } = {}) {
  return { store, queue: createPlayQueue({ store, key: KEY, send, random: () => 0.5, ...extra }) }
}

test("a queued play survives a reload with its scoresheet breakdown and pinned version", async () => {
  const store = createMemoryStore()
  const first = queue(store).queue
  const withBreakdown = play("a", {
    participants: [{ name: "Ana", score: 12, is_winner: true, score_breakdown: { wonders: 12, coins: [3, 4] } }],
  })
  await first.enqueue(withBreakdown)

  const reloaded = queue(store).queue
  await reloaded.load()

  assert.equal(reloaded.items().length, 1)
  const item = reloaded.items()[0]
  assert.equal(item.clientId, "a")
  assert.equal(item.status, "pending")
  assert.equal(item.payload.scoresheet_id, 4)
  assert.equal(item.payload.scoresheet_version, 2)
  assert.deepEqual(item.payload.participants[0].score_breakdown, { wonders: 12, coins: [3, 4] })
})

test("plays sync in the order they were logged and leave the queue only after a 2xx", async () => {
  const server = fakeServer()
  const { queue: q } = queue(createMemoryStore(), server.send)
  await q.enqueue(play("one"))
  await q.enqueue(play("two"))
  await q.enqueue(play("three"))

  const summary = await q.sync()

  assert.deepEqual(server.sent, ["one", "two", "three"])
  assert.deepEqual(summary, { synced: 3, failed: 0, stopped: null })
  assert.equal(q.items().length, 0)
})

test("a network failure keeps the play, stops the run so order holds, and backs off exponentially", async () => {
  let clock = 1_000_000
  const server = fakeServer(["offline", "offline", "offline"])
  const { queue: q } = queue(createMemoryStore(), server.send, { now: () => clock })
  await q.enqueue(play("one"))
  await q.enqueue(play("two"))

  const first = await q.sync()
  assert.deepEqual(server.sent, ["one"], "the second play is not sent ahead of the first")
  assert.equal(first.stopped, "retry")
  assert.equal(q.items()[0].attempts, 1)
  assert.equal(q.items()[0].nextAttemptAt, clock + BACKOFF_BASE_MS)

  // Not due yet: a normal run waits, Sync now does not.
  await q.sync()
  assert.deepEqual(server.sent, ["one"])
  await q.sync({ force: true })
  assert.deepEqual(server.sent, ["one", "one"])
  assert.equal(q.items()[0].nextAttemptAt, clock + BACKOFF_BASE_MS * 2)

  clock += BACKOFF_BASE_MS * 2
  await q.sync()
  assert.equal(q.items()[0].nextAttemptAt, clock + BACKOFF_BASE_MS * 4)

  const finish = await q.sync({ force: true })
  assert.deepEqual(finish, { synced: 2, failed: 0, stopped: null })
  assert.deepEqual(server.sent, ["one", "one", "one", "one", "two"])
})

test("backoff doubles from two seconds, is capped, and is jittered within twenty percent", () => {
  assert.equal(backoffDelay(1, () => 0.5), BACKOFF_BASE_MS)
  assert.equal(backoffDelay(2, () => 0.5), BACKOFF_BASE_MS * 2)
  assert.equal(backoffDelay(4, () => 0.5), BACKOFF_BASE_MS * 8)
  assert.equal(backoffDelay(30, () => 0.5), BACKOFF_MAX_MS)
  assert.equal(backoffDelay(3, () => 0), BACKOFF_BASE_MS * 4 * 0.8)
  assert.equal(backoffDelay(3, () => 1), BACKOFF_BASE_MS * 4 * 1.2)
})

test("a lost reply cannot duplicate: the server saved the play, the client timed out, the retry gives one play", async () => {
  const server = fakeServer(["lose-reply"])
  const { queue: q } = queue(createMemoryStore(), server.send)
  await q.enqueue(play("lost"))

  const first = await q.sync()
  assert.equal(first.stopped, "retry")
  assert.equal(server.saved.size, 1, "the first attempt reached the server")
  assert.equal(q.items().length, 1, "the client does not know, so the play stays queued")

  const second = await q.sync({ force: true })
  assert.deepEqual(second, { synced: 1, failed: 0, stopped: null })
  assert.equal(server.saved.size, 1, "still one play on the server")
  assert.deepEqual(server.sent, ["lost", "lost"], "both attempts carried the same client_id")
  assert.equal(q.items().length, 0)
})

test("a lost reply followed by the app being closed still ends with one play after relaunch", async () => {
  const store = createMemoryStore()
  const server = fakeServer(["lose-reply"])
  const before = queue(store, server.send).queue
  await before.enqueue(play("closed"))
  await before.sync()

  const relaunched = queue(store, server.send).queue
  await relaunched.load()
  assert.equal(relaunched.items().length, 1)
  await relaunched.sync({ force: true })

  assert.equal(server.saved.size, 1)
  assert.equal(relaunched.items().length, 0)
})

test("a 4xx marks that play failed, does not block the plays behind it, and Retry or Discard resolve it", async () => {
  const server = fakeServer(["reject"])
  const { queue: q } = queue(createMemoryStore(), server.send)
  await q.enqueue(play("bad"))
  await q.enqueue(play("good"))

  const summary = await q.sync()

  assert.deepEqual(summary, { synced: 1, failed: 1, stopped: null })
  assert.deepEqual(server.sent, ["bad", "good"])
  const [failed] = q.items()
  assert.equal(failed.status, "failed")
  assert.equal(failed.error, "The same player can't be added twice.")

  // A failed play is not sent again by a normal run.
  await q.sync({ force: true })
  assert.deepEqual(server.sent, ["bad", "good"])

  assert.deepEqual(await q.retry("bad"), { ok: true })
  assert.equal(q.items()[0].status, "pending")
  assert.deepEqual(await q.sync(), { synced: 1, failed: 0, stopped: null })
  assert.equal(q.items().length, 0)

  await q.enqueue(play("worse"))
  server.sent.length = 0
  const again = fakeServer(["reject"])
  const { queue: q2 } = queue(createMemoryStore(), again.send)
  await q2.enqueue(play("discard-me"))
  await q2.sync()
  assert.deepEqual(await q2.remove("discard-me"), { ok: true })
  assert.equal(q2.items().length, 0)
})

test("editing a waiting play changes what is sent and keeps its place; editing a failed play queues it again", async () => {
  const server = fakeServer(["reject"])
  const { queue: q } = queue(createMemoryStore(), server.send)
  await q.enqueue(play("first"))
  await q.enqueue(play("second"))
  const before = q.items().map((item) => item.seq)

  const edit = await q.update("first", play("ignored-id", { location: "Pub", duration_minutes: 45 }))
  assert.deepEqual(edit, { ok: true })
  assert.equal(q.items()[0].clientId, "first", "the edit keeps the original client_id")
  assert.equal(q.items()[0].payload.client_id, "first")
  assert.equal(q.items()[0].payload.location, "Pub")
  assert.deepEqual(q.items().map((item) => item.seq), before)

  await q.sync()
  assert.equal(q.items()[0].status, "failed")
  await q.update("first", play("first", { participants: [{ name: "Ana", score: 1, is_winner: true }] }))
  assert.equal(q.items()[0].status, "pending")
  assert.equal(q.items()[0].error, null)
  await q.sync()
  assert.equal(server.saved.get("first")?.participants.length, 1)
})

test("deleting a waiting play removes it and it is never sent", async () => {
  const server = fakeServer()
  const { queue: q } = queue(createMemoryStore(), server.send)
  await q.enqueue(play("keep"))
  await q.enqueue(play("drop"))

  assert.deepEqual(await q.remove("drop"), { ok: true })
  await q.sync()

  assert.deepEqual(server.sent, ["keep"])
  assert.deepEqual(await q.remove("drop"), { ok: false, reason: "synced" })
})

test("an edit or delete that arrives while the play is being sent waits for the answer", async () => {
  const store = createMemoryStore()
  let release: (result: SendResult) => void = () => undefined
  let calls = 0
  const send = (payload: PlayPayload) => {
    calls += 1
    void payload
    return new Promise<SendResult>((resolve) => { release = resolve })
  }
  const { queue: q } = queue(store, send)
  await q.enqueue(play("busy"))

  const running = q.sync()
  await new Promise((resolve) => setTimeout(resolve, 5))
  assert.equal(calls, 1)
  const edit = q.update("busy", play("busy", { location: "Late edit" }))
  const removal = q.remove("busy")
  release({ kind: "ok", playId: 1 })

  await running
  assert.deepEqual(await edit, { ok: false, reason: "synced" })
  assert.deepEqual(await removal, { ok: false, reason: "synced" })
  assert.equal(q.items().length, 0)
})

test("a session that expired stops the run without counting an attempt and keeps every play", async () => {
  const server = fakeServer(["auth"])
  const { queue: q } = queue(createMemoryStore(), server.send)
  await q.enqueue(play("one"))
  await q.enqueue(play("two"))

  const summary = await q.sync()

  assert.equal(summary.stopped, "auth")
  assert.deepEqual(server.sent, ["one"])
  assert.equal(q.items().length, 2)
  assert.equal(q.items()[0].attempts, 0)
  assert.equal(q.items()[0].nextAttemptAt, 0)
})

test("overlapping triggers share one run, so a play is not sent twice at once", async () => {
  const server = fakeServer()
  const { queue: q } = queue(createMemoryStore(), server.send)
  await q.enqueue(play("only"))

  await Promise.all([q.sync(), q.sync(), q.sync({ force: true })])

  assert.deepEqual(server.sent, ["only"])
})

test("the queue stores the play only: no token, and no field that is not part of a play", async () => {
  const store = createMemoryStore()
  const { queue: q } = queue(store)
  const dirty = { ...play("clean"), token: "secret-token", Authorization: "Bearer secret-token" } as PlayPayload
  dirty.participants = [{ ...dirty.participants[0], password: "hunter2" } as PlayPayload["participants"][number]]

  await q.enqueue(dirty)

  const stored = JSON.stringify(store.dump())
  assert.ok(!stored.includes("secret-token"))
  assert.ok(!stored.includes("hunter2"))
  assert.ok(!/authorization|token|password/i.test(stored))
  assert.deepEqual(Object.keys(cleanPayload(dirty)).sort(), [
    "bgg_id", "client_id", "coop_result", "duration_minutes", "location", "outcome_type", "participants",
    "played_at", "result_override", "scoresheet_id", "scoresheet_version",
  ])
})

test("unreadable storage is kept aside, not overwritten", async () => {
  const store = createMemoryStore({ [KEY]: "{not json" })
  const { queue: q } = queue(store)
  await q.load()
  assert.equal(q.items().length, 0)

  await q.enqueue(play("new"))

  assert.equal(store.dump()[`${KEY}.unreadable`], "{not json")
  assert.equal(JSON.parse(store.dump()[KEY]).items.length, 1)
})

test("subscribers hear about every change", async () => {
  const { queue: q } = queue()
  let heard = 0
  const stop = q.subscribe(() => { heard += 1 })
  await q.enqueue(play("a"))
  await q.sync()
  stop()
  const after = heard
  await q.enqueue(play("b"))
  assert.ok(after >= 2)
  assert.equal(heard, after)
})
