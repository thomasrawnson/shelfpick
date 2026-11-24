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
  complexityBand = null,
  onGroupVote,
} = {}) {
  return renderToStaticMarkup(React.createElement(PlayerStep, {
    players,
    selectedPlayerIds,
    selectedPlayerNames,
    complexityBand,
    onGroupVote,
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
  assert.doesNotMatch(markup, /class="tonight-count-grid"/)
  assert.doesNotMatch(markup, /aria-label="2 players"/)
})

test("count-only mode retains the player-count choices and selected count", () => {
  const markup = renderPlayerStep({ players: 4 })

  assert.match(markup, />What should we play\?</)
  assert.doesNotMatch(markup, /Set the table and any limits/)
  assert.match(markup, /Choose players by name/)
  assert.match(markup, />Complexity</)
  assert.match(markup, />Fine-tune</)
  assert.match(markup, /class="tonight-count-grid"/)
  assert.match(markup, /aria-label="4 players" aria-pressed="true"/)
  assert.doesNotMatch(markup, /named players/)
  assert.doesNotMatch(markup, />Use group size instead</)
})

test("a disabled Find a game says why, linked with aria-describedby, and the hint goes once a count is chosen", () => {
  const empty = renderPlayerStep({ onGroupVote: () => {} })
  const hint = /<p class="tonight-hint" id="([^"]+)">Choose how many are playing<\/p>/.exec(empty)
  assert.ok(hint, "the hint is shown under the button")
  const button = /<button type="button" class="primary-button"[^>]*>Find a game<\/button>/.exec(empty)[0]
  assert.ok(button.includes(`aria-describedby="${hint[1]}"`), "the button points at the hint")
  assert.ok(button.includes('disabled=""'))
  assert.ok(empty.indexOf("Find a game") < empty.indexOf("Choose how many are playing"))

  const chosen = renderPlayerStep({ players: 3, onGroupVote: () => {} })
  assert.doesNotMatch(chosen, /Choose how many are playing/)
  assert.doesNotMatch(chosen, /aria-describedby/)
  assert.doesNotMatch(chosen, /class="primary-button"[^>]*disabled/)
})

test("one filled primary button; the group vote is a quiet text action, not a secondary or primary button", () => {
  const markup = renderPlayerStep({ players: 2, onGroupVote: () => {} })

  assert.equal((markup.match(/class="primary-button"/g) ?? []).length, 1)
  assert.doesNotMatch(markup, /secondary-button|ghost-button/)
  assert.match(markup, /<button type="button" class="tonight-text-action"><span>Start a group vote<\/span>/)
})

test("the chosen count and the chosen complexity show a check and expose their pressed state", () => {
  const markup = renderPlayerStep({ players: 4, complexityBand: "medium" })
  const chips = [...markup.matchAll(/<button type="button" class="([^"]*tonight-choice[^"]*)"([^>]*)>(.*?)<\/button>/g)]

  const selected = chips.filter(([, cls]) => cls.split(" ").includes("selected"))
  assert.equal(selected.length, 2, "one count and one complexity")
  for (const [, , attrs, inner] of selected) {
    assert.match(attrs, /aria-pressed="true"/)
    assert.match(inner, /<svg class="tonight-check"[^>]*aria-hidden="true"/)
  }
  assert.match(selected[0][2], /aria-label="4 players"/)
  assert.match(selected[1][3], /<strong>Medium<\/strong>/)

  const unselected = chips.filter(([, cls]) => !cls.split(" ").includes("selected"))
  assert.ok(unselected.length >= 8)
  for (const [, , attrs, inner] of unselected) {
    assert.match(attrs, /aria-pressed="false"/)
    assert.doesNotMatch(inner, /tonight-check/)
  }
})

test("the count and complexity controls are labelled groups, and the section labels share one style", () => {
  const markup = renderPlayerStep({ players: 2 })

  assert.match(markup, /role="group" aria-labelledby="([^"]+)-count"/)
  assert.match(markup, /role="group" aria-labelledby="([^"]+)-complexity"/)
  const labels = [...markup.matchAll(/<p class="(tonight-label)"[^>]*>([^<]+)<\/p>/g)].map(([, , text]) => text)
  assert.deepEqual(labels, ["Tonight", "Who is playing?", "Complexity"])
})
