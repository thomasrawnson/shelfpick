import assert from "node:assert/strict"
import { after, before, test } from "node:test"
import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { createServer } from "vite"

let server
let GameNightGuestVotingView

before(async () => {
  server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: "custom" })
  GameNightGuestVotingView = (
    await server.ssrLoadModule("/src/components/GameNightGuestVotingView.tsx")
  ).default
})

after(async () => { await server?.close() })

test("V1 guest link shows unavailable voting and checks only for earlier rights", () => {
  globalThis.localStorage = { getItem: () => null }
  const markup = renderToStaticMarkup(React.createElement(GameNightGuestVotingView, {
    joinToken: "session-token",
  }))

  assert.match(markup, /ShelfPick Game Night/)
  assert.match(markup, /Phone voting isn’t available/)
  assert.match(markup, /No new phone votes can be joined or cast/)
  assert.match(markup, /Checking this device for an earlier guest entry/)
  assert.doesNotMatch(markup, /Join voting|Submit vote/)
  assert.doesNotMatch(markup, /host.*collection|account details|play history/i)
  delete globalThis.localStorage
})
