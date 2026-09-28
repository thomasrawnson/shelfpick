import assert from "node:assert/strict"
import { after, before, test } from "node:test"
import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { MemoryRouter } from "react-router-dom"
import { createServer } from "vite"

let server
let PickerView

before(async () => {
  server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: "custom" })
  PickerView = (await server.ssrLoadModule("/src/components/picker/PickerView.tsx")).default
})

after(async () => { await server?.close() })

function renderPicker(props = {}) {
  return renderToStaticMarkup(React.createElement(
    MemoryRouter,
    { initialEntries: ["/picker"] },
    React.createElement(PickerView, {
      onViewGame: () => {},
      onViewCollection: () => {},
      ...props,
    }),
  ))
}

test("fresh Picker applies saved count and play-style defaults", () => {
  const markup = renderPicker({
    defaultPlayers: 4,
    defaultTime: 90,
    defaultPlayStyle: "cooperative",
  })

  assert.match(markup, /aria-label="4 players" aria-pressed="true"/)
  assert.match(markup, /aria-pressed="true"[^>]*>Cooperative</)
})

test("missing and legacy play-style values use the neutral fallback", () => {
  const missing = renderPicker({ defaultPlayers: null, defaultTime: null })
  const legacy = renderPicker({ defaultPlayStyle: "legacy-team-mode" })

  assert.match(missing, /aria-pressed="true"[^>]*>Either</)
  assert.match(legacy, /aria-pressed="true"[^>]*>Either</)
  assert.doesNotMatch(missing, /class="player-chip selected"/)
})
