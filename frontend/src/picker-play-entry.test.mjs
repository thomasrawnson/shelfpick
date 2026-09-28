import assert from "node:assert/strict"
import { after, before, test } from "node:test"
import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { createServer } from "vite"

let server
let PickerPlayEntry

before(async () => {
  server = await createServer({ server: { middlewareMode: true }, appType: "custom" })
  PickerPlayEntry = (await server.ssrLoadModule("/src/components/picker/PickerPlayEntry.tsx")).default
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
  return renderToStaticMarkup(React.createElement(PickerPlayEntry, {
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
  }))
}

test("dedicated play entry presents one primary save and proportionate navigation", () => {
  const markup = renderEntry(["Alex", "Morgan"])

  assert.match(markup, /<h1[^>]*>Log a play<\/h1>/)
  assert.match(markup, /<h2>Cascadia<\/h2>/)
  assert.match(markup, /Alex, Morgan/)
  assert.match(markup, /value="Alex"/)
  assert.match(markup, /value="Morgan"/)
  assert.equal((markup.match(/>Save play<\/button>/g) ?? []).length, 1)
  assert.match(markup, />Cancel<\/button>/)
})

test("count-only Picker entry keeps distinct blank participant rows", () => {
  const markup = renderEntry()

  assert.match(markup, />2 players<\/p>/)
  assert.equal((markup.match(/placeholder="Player name"/g) ?? []).length, 2)
})
