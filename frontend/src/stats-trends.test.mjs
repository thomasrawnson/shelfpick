import assert from "node:assert/strict"
import { after, before, test } from "node:test"
import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { MemoryRouter } from "react-router-dom"
import { createServer } from "vite"

// SP-STATS-01 markup: chart table alternatives, the locked Pro preview for Free
// accounts, and the Pro-only Picker option. Data loading is covered by Playwright.
let server
let BarChart, Heatmap, TrendsPanel, PlayerStep, EntitlementsProvider

before(async () => {
  server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: "custom" })
  BarChart = (await server.ssrLoadModule("/src/components/stats/BarChart.tsx")).default
  Heatmap = (await server.ssrLoadModule("/src/components/stats/Heatmap.tsx")).default
  TrendsPanel = (await server.ssrLoadModule("/src/components/stats/TrendsPanel.tsx")).default
  PlayerStep = (await server.ssrLoadModule("/src/components/picker/PlayerStep.tsx")).PlayerStep
  EntitlementsProvider = (await server.ssrLoadModule("/src/entitlements.tsx")).EntitlementsProvider
})

after(async () => { await server?.close() })

const html = element => renderToStaticMarkup(React.createElement(MemoryRouter, null, element))
const withEntitlements = (entitlements, element) => React.createElement(EntitlementsProvider, { entitlements }, element)

test("bar chart is described and ships an equivalent table", () => {
  const markup = html(React.createElement(BarChart, {
    title: "Plays per month",
    summary: "7 plays in the last 2 months.",
    unit: "play",
    data: [
      { key: "2026-01", label: "Jan", fullLabel: "Jan 2026", value: 2 },
      { key: "2026-02", label: "Feb", fullLabel: "Feb 2026", value: 5 },
    ],
  }))
  assert.match(markup, /role="img" aria-label="Plays per month\. 7 plays in the last 2 months\."/)
  assert.match(markup, /<table>/)
  assert.match(markup, /<th scope="row">Feb 2026<\/th><td>5<\/td>/)
  assert.match(markup, /2 plays|5 plays/)
})

test("heatmap exposes days with plays as a table", () => {
  const heatmap = {
    year: 2026, total_plays: 3, active_days: 2, max_plays_in_day: 2,
    days: [{ date: "2026-03-09", plays: 2 }, { date: "2026-04-01", plays: 1 }],
  }
  const markup = html(React.createElement(Heatmap, { heatmap, scrollToEnd: false }))
  assert.match(markup, /aria-label="Calendar of plays in 2026\. 3 plays on 2 days in 2026\./)
  assert.match(markup, /<th scope="row">9 Mar 2026<\/th><td>2<\/td>/)
  assert.match(markup, /heat-4/)
  const empty = html(React.createElement(Heatmap, { heatmap: { ...heatmap, days: [], total_plays: 0, active_days: 0, max_plays_in_day: 0 }, scrollToEnd: false }))
  assert.match(empty, /No plays recorded in 2026\./)
})

test("a Free account sees a locked preview and no filters", () => {
  const markup = html(withEntitlements([], React.createElement(TrendsPanel, { onOpenGame: () => {} })))
  assert.match(markup, /Included with Pro/)
  assert.match(markup, /Records, head-to-head and filters/)
  assert.doesNotMatch(markup, /stats-records-title|stats-h2h-title/)
  assert.doesNotMatch(markup, /Date, player, place, group size/)
  assert.match(markup, /Plays per month/)
  assert.match(markup, /Play calendar/)
})

test("a Pro account sees filters, records and head-to-head instead", () => {
  const markup = html(withEntitlements(["advanced_stats"], React.createElement(TrendsPanel, { onOpenGame: () => {} })))
  assert.doesNotMatch(markup, /Included with Pro/)
  assert.match(markup, /id="stats-records-title">Score records/)
  assert.match(markup, /id="stats-h2h-title">Head-to-head/)
  assert.match(markup, /Date, player, place, group size/)
})

const stepProps = {
  players: 3, selectedPlayerIds: [], selectedPlayerNames: [], complexityBand: null,
  preferredCategories: [], preferredMechanics: [], youngestPlayerAge: null, playStyle: "any",
  mode: "best_match", helpHIndex: false, onHelpHIndexChange: () => {}, onSelectCount: () => {},
  onComplexityChange: () => {}, onYoungestPlayerAgeChange: () => {}, onPlayStyleChange: () => {},
  onModeChange: () => {}, onChoosePlayers: () => {}, onOpenTheme: () => {}, onOpenMechanics: () => {},
  onClearFineTune: () => {}, onContinue: () => {},
}

test("Help my H-index is offered to Pro only and counts as a preference", () => {
  const free = html(withEntitlements([], React.createElement(PlayerStep, stepProps)))
  assert.doesNotMatch(free, /Help my H-index/)
  const pro = html(withEntitlements(["advanced_stats"], React.createElement(PlayerStep, stepProps)))
  assert.match(pro, /Help my H-index/)
  assert.match(pro, /aria-pressed="false"[^>]*>Help my H-index/)
  const on = html(withEntitlements(["advanced_stats"], React.createElement(PlayerStep, { ...stepProps, helpHIndex: true })))
  assert.match(on, /1 preference applied/)
  const freeOn = html(withEntitlements([], React.createElement(PlayerStep, { ...stepProps, helpHIndex: true })))
  assert.doesNotMatch(freeOn, /preference applied/)
})
