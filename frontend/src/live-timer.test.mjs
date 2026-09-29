import assert from "node:assert/strict"
import { after, before, test } from "node:test"
import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { createServer } from "vite"

let server
let formatElapsed
let elapsedSeconds
let LiveTimerIndicator
let LiveTimerRecovery

before(async () => {
  server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: "custom" })
  const timerModule = await server.ssrLoadModule("/src/live-timer-utils.ts")
  formatElapsed = timerModule.formatElapsed
  elapsedSeconds = timerModule.elapsedSeconds
  LiveTimerIndicator = (await server.ssrLoadModule("/src/components/LiveTimerIndicator.tsx")).default
  LiveTimerRecovery = (await server.ssrLoadModule("/src/components/LiveTimerView.tsx")).LiveTimerRecovery
})

after(async () => { await server?.close() })

test("elapsed display derives from timestamps rather than interval ticks", () => {
  const timer = {
    status: "running",
    running_since: "2026-09-28T12:00:00.000Z",
    accumulated_seconds: 40,
    elapsed_seconds: 50,
  }
  assert.equal(elapsedSeconds(timer, Date.parse("2026-09-28T12:00:30.000Z")), 70)
  assert.equal(formatElapsed(3670), "01:01:10")
})

test("timer indicator is absent without the authoritative provider state", () => {
  assert.equal(renderToStaticMarkup(React.createElement(LiveTimerIndicator, { onOpen() {} })), "")
})

function retainedTimer(status) {
  return {
    public_id: "timer-recovery-1",
    status,
    accumulated_seconds: 900,
    running_since: status === "running" ? "2099-09-28T12:00:00.000Z" : null,
    finished_at: status === "finished" ? "2026-09-28T12:15:00.000Z" : null,
    elapsed_seconds: 900,
    draft: { participant_names: ["Alex"], location: "The Dice Cup" },
    game: { bgg_id: 13, name: "Recovery Game", image_url: null, thumbnail_url: null },
  }
}

for (const status of ["running", "paused"]) {
  test(`${status} timer after Pro loss keeps manual logging without paid controls`, () => {
    const markup = renderToStaticMarkup(React.createElement(LiveTimerRecovery, {
      timer: retainedTimer(status), onBack() {}, playSaved: false, async onPlaySaved() {},
    }))
    assert.match(markup, /Live timer retained/)
    assert.match(markup, new RegExp(`was ${status} when Pro access changed`))
    assert.match(markup, /Nothing was finished, discarded or cleared/)
    assert.match(markup, /If Pro returns, this timer and its controls will be restored/)
    assert.match(markup, /Log this play manually/)
    assert.match(markup, /Saving here will not finish or discard the retained timer/)
    assert.match(markup, /value="Alex"/)
    assert.match(markup, /value="The Dice Cup"/)
    assert.doesNotMatch(markup, />Pause<|>Resume<|>Finish<|Discard timer/)
  })
}

test("finished timer after Pro loss opens an ordinary prefilled save form", () => {
  const markup = renderToStaticMarkup(React.createElement(LiveTimerRecovery, {
    timer: retainedTimer("finished"), onBack() {}, playSaved: false, async onPlaySaved() {},
  }))
  assert.match(markup, /Finished timer retained/)
  assert.match(markup, /Save your finished play/)
  assert.match(markup, /retained timer is removed only after that save succeeds/)
  assert.match(markup, /value="15"/)
  assert.match(markup, /value="Alex"/)
  assert.match(markup, /value="The Dice Cup"/)
  assert.doesNotMatch(markup, />Pause<|>Resume<|>Finish<|Discard timer/)
})
