import assert from "node:assert/strict"
import { afterEach, beforeEach, test } from "node:test"

import { agoLabel, clearAllSavedCopies, readThrough, saveCopy, savedCopy, setCacheOwner, staleSinceNow } from "./cache.ts"
import { RequestTimeoutError, isUnreachableError } from "./connectivity.ts"

const store = new Map<string, string>()

beforeEach(() => {
  store.clear()
  ;(globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => { store.set(key, value) },
    removeItem: (key: string) => { store.delete(key) },
    key: (index: number) => [...store.keys()][index] ?? null,
    get length() { return store.size },
  }
  setCacheOwner(7)
})

afterEach(() => {
  clearAllSavedCopies()
  setCacheOwner(null)
  delete (globalThis as { localStorage?: unknown }).localStorage
})

const offline = () => Object.assign(new Error("Couldn't connect to ShelfPick."), { cause: new TypeError("Load failed") })

test("a fresh answer is returned and saved; the saved copy is only used when the server cannot be reached", async () => {
  assert.deepEqual(await readThrough("games", async () => [{ id: 1 }]), [{ id: 1 }])
  assert.deepEqual(savedCopy<{ id: number }[]>("games")?.data, [{ id: 1 }])

  const offlineRead = await readThrough("games", async () => { throw offline() })
  assert.deepEqual(offlineRead, [{ id: 1 }])
  assert.notEqual(staleSinceNow(["games"]), null, "the screen is told it is showing a saved copy")

  await readThrough("games", async () => [{ id: 2 }])
  assert.equal(staleSinceNow(["games"]), null, "a fresh answer clears the notice")
})

test("a timeout counts as unreachable; an HTTP error from the server does not", async () => {
  saveCopy("plays", ["saved"])
  assert.deepEqual(await readThrough("plays", async () => { throw new RequestTimeoutError("took too long") }), ["saved"])
  await assert.rejects(readThrough("plays", async () => { throw new Error("Plays request failed: 500") }), /500/)
  assert.equal(isUnreachableError(new RequestTimeoutError("x")), true)
  assert.equal(isUnreachableError(new Error("x")), false)
})

test("offline with nothing saved is still an error", async () => {
  await assert.rejects(readThrough("never-opened", async () => { throw offline() }), /connect/)
})

test("copies belong to the signed-in account and are removed on sign-out", async () => {
  saveCopy("games", ["mine"])
  setCacheOwner(8)
  assert.equal(savedCopy("games"), null, "another account sees nothing")
  setCacheOwner(7)
  assert.deepEqual(savedCopy<string[]>("games")?.data, ["mine"])

  clearAllSavedCopies()
  assert.equal(savedCopy("games"), null)
})

test("nothing is saved or read while no account is signed in", async () => {
  setCacheOwner(null)
  saveCopy("games", ["x"])
  assert.equal(store.size, 0)
  assert.equal(savedCopy("games"), null)
})

test("the trimmed copy is what is saved, not the full answer", async () => {
  const everything = Array.from({ length: 10 }, (_, index) => index)
  const returned = await readThrough("plays", async () => everything, (plays) => plays.slice(0, 3))
  assert.equal(returned.length, 10)
  assert.deepEqual(savedCopy<number[]>("plays")?.data, [0, 1, 2])
})

test("a full device only costs the saved copy", async () => {
  const original = (globalThis as { localStorage: { setItem: (key: string, value: string) => void } }).localStorage.setItem
  ;(globalThis as { localStorage: { setItem: (key: string, value: string) => void } }).localStorage.setItem = () => { throw new Error("QuotaExceededError") }
  assert.deepEqual(await readThrough("games", async () => ["still returned"]), ["still returned"])
  assert.deepEqual(savedCopy<string[]>("games")?.data, ["still returned"], "kept for this session in memory")
  ;(globalThis as { localStorage: { setItem: (key: string, value: string) => void } }).localStorage.setItem = original
})

test("age labels", () => {
  const now = Date.UTC(2026, 10, 22, 12)
  assert.equal(agoLabel(now - 20_000, now), "just now")
  assert.equal(agoLabel(now - 5 * 60_000, now), "5 min ago")
  assert.equal(agoLabel(now - 3 * 3_600_000, now), "3 h ago")
  assert.equal(agoLabel(now - 72 * 3_600_000, now), "3 days ago")
})
