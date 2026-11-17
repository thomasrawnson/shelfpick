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

test("guest link opens the live voting page and no longer claims voting is unavailable", () => {
  globalThis.localStorage = { getItem: () => null }
  const markup = renderToStaticMarkup(React.createElement(GameNightGuestVotingView, {
    joinToken: "session-token",
  }))

  assert.match(markup, /ShelfPick Game Night/)
  assert.match(markup, /Vote for tonight’s game/)
  assert.doesNotMatch(markup, /Phone voting isn’t available/)
  assert.doesNotMatch(markup, /host.*collection|account details|play history/i)
  delete globalThis.localStorage
})

test("the Get ShelfPick link is a plain App Store URL with no tracking", async () => {
  const { APP_STORE_URL } = await server.ssrLoadModule("/src/app-store.ts")
  const url = new URL(APP_STORE_URL)
  assert.equal(url.origin, "https://apps.apple.com")
  assert.match(url.pathname, /^\/app\/id\d+$/)
  assert.equal(url.search, "")
  assert.equal(url.hash, "")
})
