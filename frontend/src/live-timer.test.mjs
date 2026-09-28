import assert from "node:assert/strict"
import { after, before, test } from "node:test"
import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { createServer } from "vite"

let server
let formatElapsed
let elapsedSeconds
let LiveTimerIndicator

before(async () => {
  server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: "custom" })
  const timerModule = await server.ssrLoadModule("/src/live-timer-utils.ts")
  formatElapsed = timerModule.formatElapsed
  elapsedSeconds = timerModule.elapsedSeconds
  LiveTimerIndicator = (await server.ssrLoadModule("/src/components/LiveTimerIndicator.tsx")).default
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
