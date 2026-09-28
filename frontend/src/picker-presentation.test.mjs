import assert from "node:assert/strict"
import { after, before, test } from "node:test"
import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { createServer } from "vite"

let server
let PickerResult

before(async () => {
  server = await createServer({ server: { middlewareMode: true }, appType: "custom" })
  PickerResult = (await server.ssrLoadModule("/src/components/picker/PickerResult.tsx")).default
})

after(async () => { await server?.close() })

const game = {
  bgg_id: 13,
  name: "A Deliberately Long Game Title for the Shelf",
  year_published: 2026,
  min_players: 2,
  max_players: 4,
  min_play_time: 30,
  max_play_time: 45,
  min_age: 10,
  complexity: 2.4,
  rating: 7.5,
  owned: true,
  is_expansion: false,
  image_url: null,
  thumbnail_url: null,
  categories: [],
  mechanics: [],
}

function renderResult() {
  return renderToStaticMarkup(React.createElement(PickerResult, {
    match: {
      game,
      score: 87.4,
      reasons: ["Fits the selected time", "Works well at 2 players"],
      ai_used: false,
      ai_explanation: null,
    },
    matchIndex: 0,
    totalMatches: 3,
    mode: "best_match",
    playerCount: 2,
    hasMoreMatches: true,
    onTryAnother: () => {},
    onViewGame: () => {},
    onStartOver: () => {},
    onLogPlay: () => {},
  }))
}

test("Picker result keeps the match value unchanged and outside the artwork", () => {
  const markup = renderResult()

  assert.match(
    markup,
    /picker-cover-wrap[\s\S]*Cover art<\/div><\/div><div class="picker-result-status">/,
  )
  assert.match(markup, /aria-label="Match score 87"/)
  assert.match(markup, /<strong>87<\/strong><span>match<\/span>/)
})

test("Picker result exposes the intended scan and action hierarchy", () => {
  const markup = renderResult()

  assert.match(markup, /A Deliberately Long Game Title for the Shelf/)
  assert.match(markup, /Why it fits/)
  assert.match(markup, /Fits the selected time/)
  assert.match(markup, />Log a play<\/button>/)
  assert.match(markup, />Try another<\/button>/)
  assert.match(markup, /picker-cover-placeholder/)
})
