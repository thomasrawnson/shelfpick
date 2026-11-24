import assert from "node:assert/strict"
import { after, before, test } from "node:test"
import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { createServer } from "vite"

let server
let PickerPlayEntry
let PlaySyncProvider

before(async () => {
  server = await createServer({ server: { middlewareMode: true }, appType: "custom" })
  PickerPlayEntry = (await server.ssrLoadModule("/src/components/picker/PickerPlayEntry.tsx")).default
  PlaySyncProvider = (await server.ssrLoadModule("/src/offline/PlaySyncProvider.tsx")).PlaySyncProvider
})

after(async () => { await server?.close() })

const game = {
  bgg_id: 13,
  name: "Cascadia",
  year_published: 2021,
  min_players: 1,
  max_players: 4,
  min_play_time: 30,
  max_play_time: 45,
  min_age: 10,
  complexity: 1.9,
  rating: 8.0,
  owned: true,
  is_expansion: false,
  image_url: null,
  thumbnail_url: null,
  categories: [],
  mechanics: [],
}

function renderEntry(playerNames = []) {
  return renderToStaticMarkup(React.createElement(PlaySyncProvider, { userId: 1 }, React.createElement(PickerPlayEntry, {
    match: {
      game,
      score: 92,
      reasons: ["Fits tonight"],
      ai_used: false,
      ai_explanation: null,
    },
    playerCount: 2,
    playerNames,
    pickerSessionId: "picker-session",
    onCancel: () => {},
    onSaved: async () => {},
  })))
}

test("Picker play entry is a sheet with Cancel and one Save, prefilled with tonight's players", () => {
  const markup = renderEntry(["Alex", "Morgan"])

  assert.match(markup, /role="dialog"/)
  assert.match(markup, /<h2[^>]*>Cascadia<\/h2>/)
  assert.match(markup, /value="Alex"/)
  assert.match(markup, /value="Morgan"/)
  assert.equal((markup.match(/aria-label="Save play"/g) ?? []).length, 1)
  assert.match(markup, />Cancel<\/button>/)
})

test("count-only Picker entry asks for the players instead of blank rows", () => {
  const markup = renderEntry()

  assert.match(markup, /add 2 more players/)
  assert.equal((markup.match(/placeholder="Player name"/g) ?? []).length, 0)
})
