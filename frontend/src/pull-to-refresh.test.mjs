import assert from "node:assert/strict"
import test from "node:test"

import { PULL_MAX_PX, PULL_TRIGGER_PX, pullOffset, shouldRefresh } from "./pull-to-refresh.ts"

test("pull offset is damped, capped and never negative", () => {
  assert.equal(pullOffset(100, 80), 0)
  assert.equal(pullOffset(100, 160), 30)
  assert.equal(pullOffset(0, 1000), PULL_MAX_PX)
})

test("refresh triggers only past the threshold", () => {
  assert.equal(shouldRefresh(PULL_TRIGGER_PX - 1), false)
  assert.equal(shouldRefresh(PULL_TRIGGER_PX), true)
})
