import assert from "node:assert/strict"
import test from "node:test"

import { readTonightMode, saveTonightMode } from "./tonight-mode.ts"

const store = (value) => ({ getItem: () => value, setItem: () => {} })

test("an explicit mode wins, then the last mode used, then a group", () => {
  assert.equal(readTonightMode("vote", store("solo")), "vote")
  assert.equal(readTonightMode(null, store("solo")), "solo")
  assert.equal(readTonightMode("nonsense", store("vote")), "vote")
  assert.equal(readTonightMode(null, store("nonsense")), "group")
  assert.equal(readTonightMode(null, null), "group")
})

test("saving survives unavailable storage", () => {
  assert.doesNotThrow(() => saveTonightMode("solo", { setItem: () => { throw new Error("blocked") } }))
  let saved = ""
  saveTonightMode("vote", { setItem: (_key, value) => { saved = value } })
  assert.equal(saved, "vote")
})
