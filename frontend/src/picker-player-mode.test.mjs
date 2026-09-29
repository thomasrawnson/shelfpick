import assert from "node:assert/strict"
import { after, before, test } from "node:test"
import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { createServer } from "vite"

let server
let PlayerStep

before(async () => {
  server = await createServer({ server: { middlewareMode: true }, appType: "custom" })
  PlayerStep = (await server.ssrLoadModule("/src/components/picker/PlayerStep.tsx")).PlayerStep
})

after(async () => { await server?.close() })

function renderPlayerStep({
  players = null,
  selectedPlayerIds = [],
  selectedPlayerNames = [],
} = {}) {
  return renderToStaticMarkup(React.createElement(PlayerStep, {
    players,
    selectedPlayerIds,
    selectedPlayerNames,
    complexityBand: null,
    preferredCategories: [],
    preferredMechanics: [],
    youngestPlayerAge: null,
    playStyle: "any",
    mode: "best_match",
    onSelectCount: () => {},
    onComplexityChange: () => {},
    onYoungestPlayerAgeChange: () => {},
    onPlayStyleChange: () => {},
    onModeChange: () => {},
    onChoosePlayers: () => {},
    onOpenTheme: () => {},
    onOpenMechanics: () => {},
    onClearFineTune: () => {},
    onContinue: () => {},
  }))
}

test("named players replace the editable count control with one authoritative summary", () => {
  const markup = renderPlayerStep({
    players: 2,
    selectedPlayerIds: [7, 12],
    selectedPlayerNames: ["Alex", "Morgan"],
  })

  assert.match(markup, />2 named players</)
  assert.match(markup, />Alex, Morgan</)
  assert.match(markup, />Edit players</)
  assert.match(markup, />Use group size instead</)
  assert.doesNotMatch(markup, /class="player-grid"/)
  assert.doesNotMatch(markup, /aria-label="2 players"/)
})

test("count-only mode retains the player-count choices and selected count", () => {
  const markup = renderPlayerStep({ players: 4 })

  assert.match(markup, />What should we play\?</)
  assert.doesNotMatch(markup, /Set the table and any limits/)
  assert.match(markup, />Choose specific players</)
  assert.match(markup, />Complexity</)
  assert.match(markup, />Fine-tune</)
  assert.match(markup, /class="player-grid"/)
  assert.match(markup, /aria-label="4 players" aria-pressed="true"/)
  assert.doesNotMatch(markup, /named players/)
  assert.doesNotMatch(markup, />Use group size instead</)
})
