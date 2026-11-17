import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import { startVisibleInterval } from "./use-visible-interval.ts"

function fakeEnvironment() {
  const listeners = new Set<() => void>()
  const doc = {
    hidden: false,
    addEventListener: (_type: string, fn: () => void) => { listeners.add(fn) },
    removeEventListener: (_type: string, fn: () => void) => { listeners.delete(fn) },
  }
  let nextHandle = 1
  const timers = new Map<number, () => void>()
  const fakeTimers = {
    setInterval: (fn: () => void) => { timers.set(nextHandle, fn); return nextHandle++ },
    clearInterval: (handle: number) => { timers.delete(handle) },
  }
  return {
    doc,
    fakeTimers,
    activeTimers: () => timers.size,
    listenerCount: () => listeners.size,
    tick: () => timers.forEach((fn) => fn()),
    setHidden(hidden: boolean) {
      doc.hidden = hidden
      listeners.forEach((fn) => fn())
    },
  }
}

// Host and guest views both call the hook with a 4s interval and a fetch callback.
for (const view of ["host", "guest"]) {
  test(`${view} refresh stops while hidden and fetches once straight away when visible again`, () => {
    const env = fakeEnvironment()
    let fetches = 0
    startVisibleInterval(() => { fetches += 1 }, 4000, env.doc as never, env.fakeTimers as never)

    env.tick()
    assert.equal(fetches, 1)

    env.setHidden(true)
    assert.equal(env.activeTimers(), 0)
    env.tick()
    assert.equal(fetches, 1, "no refresh while hidden")

    env.setHidden(false)
    assert.equal(fetches, 2, "one fetch straight away on becoming visible")
    assert.equal(env.activeTimers(), 1)
    env.tick()
    assert.equal(fetches, 3, "interval carries on")
  })

  test(`${view} refresh is cleared on unmount`, () => {
    const env = fakeEnvironment()
    let fetches = 0
    const stop = startVisibleInterval(() => { fetches += 1 }, 4000, env.doc as never, env.fakeTimers as never)
    stop()
    assert.equal(env.activeTimers(), 0)
    assert.equal(env.listenerCount(), 0)
    env.setHidden(false)
    env.tick()
    assert.equal(fetches, 0)
  })
}

test("starts paused when the page is already hidden", () => {
  const env = fakeEnvironment()
  env.doc.hidden = true
  let fetches = 0
  startVisibleInterval(() => { fetches += 1 }, 4000, env.doc as never, env.fakeTimers as never)
  assert.equal(env.activeTimers(), 0)
  assert.equal(fetches, 0)
})

test("repeated visible events do not start extra timers or fetches", () => {
  const env = fakeEnvironment()
  let fetches = 0
  startVisibleInterval(() => { fetches += 1 }, 4000, env.doc as never, env.fakeTimers as never)
  env.setHidden(false)
  assert.equal(fetches, 0)
  assert.equal(env.activeTimers(), 1)
})

test("host and guest views use the shared hook and no raw setInterval", () => {
  for (const file of ["GameNightView.tsx", "GameNightGuestVotingView.tsx"]) {
    const source = readFileSync(new URL(`./components/${file}`, import.meta.url), "utf8")
    assert.match(source, /useVisibleInterval\(/, file)
    assert.doesNotMatch(source, /setInterval/, file)
  }
})
