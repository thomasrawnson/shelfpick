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

test("guest voting opens without an account and starts with truthful loading copy", () => {
  globalThis.localStorage = { getItem: () => null }
  const markup = renderToStaticMarkup(React.createElement(GameNightGuestVotingView, {
    joinToken: "session-token",
  }))

  assert.match(markup, /ShelfPick Game Night/)
  assert.match(markup, /Vote for tonight’s game/)
  assert.match(markup, /Loading voting session/)
  assert.doesNotMatch(markup, /host.*collection|account details|play history/i)
  delete globalThis.localStorage
})
