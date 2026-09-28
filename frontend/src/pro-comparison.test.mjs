import assert from "node:assert/strict"
import { after, before, test } from "node:test"
import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { MemoryRouter } from "react-router-dom"
import { createServer } from "vite"

let server
let ProComparisonView
let SettingsView
let DiscoverView
let GameNightView

const user = {
  id: 1, email: "morgan@example.com", display_name: "Morgan", bgg_username: null,
  email_verified: true, onboarding_completed: true, preferred_player_count: null,
  preferred_play_time: null, profile_player_id: 1, player_name: "Morgan",
  avatar_key: "forest", tier: "FREE", entitlements: ["game_night_basic"],
}

before(async () => {
  server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: "custom" })
  ProComparisonView = (await server.ssrLoadModule("/src/components/ProComparisonView.tsx")).default
  SettingsView = (await server.ssrLoadModule("/src/components/SettingsView.tsx")).default
  DiscoverView = (await server.ssrLoadModule("/src/components/DiscoverView.tsx")).default
  GameNightView = (await server.ssrLoadModule("/src/components/GameNightView.tsx")).default
})

after(async () => { await server?.close() })

function render(view, props) {
  return renderToStaticMarkup(React.createElement(MemoryRouter, null, React.createElement(view, props)))
}

test("Settings Pro entry opens the comparison route", () => {
  globalThis.window = { shelfPickTheme: { getPreference: () => "system" } }
  const markup = render(SettingsView, { user, onLogout: () => {} })
  assert.match(markup, /href="\/settings\/pro"[^>]*>.*?ShelfPick Pro/s)
  delete globalThis.window
})

test("Free plan explains the useful free product and an unavailable one-off action", () => {
  const markup = render(ProComparisonView, { user })
  assert.match(markup, /Free gives you the full shelf/)
  assert.match(markup, /ShelfPick is free to use/)
  assert.match(markup, /Free<\/h2><span class="pro-plan-state">Your plan/)
  assert.match(markup, /basic group picker/i)
  assert.match(markup, /Discover Hot and Top 100/)
  assert.match(markup, /For You/)
  assert.match(markup, /One-off unlock/)
  assert.match(markup, /one-off price will be shown before you pay/i)
  assert.match(markup, /disabled=""[^>]*>Unlock ShelfPick Pro/)
  assert.match(markup, /Purchases are not available yet/)
  assert.doesNotMatch(markup, /monthly|subscription/i)
  assert.doesNotMatch(markup, /Advanced recommendations|Richer statistics|Enhanced Game Night/)
})

test("Pro plan is current without a purchase action", () => {
  const markup = render(ProComparisonView, {
    user: { ...user, tier: "PRO", entitlements: ["game_night_basic", "personalized_discover"] },
  })
  assert.match(markup, /Pro<\/h2><span class="pro-plan-state">Your plan/)
  assert.match(markup, /Pro is active on your account/)
  assert.doesNotMatch(markup, /Unlock ShelfPick Pro/)
})

test("comparison lists only available features with accessible inclusion labels", () => {
  const markup = render(ProComparisonView, { user })
  const row = name => markup.match(new RegExp(`<tr><th scope="row"><span>${name}<\\/span>.*?<\\/th>(.*?)<\\/tr>`))?.[1]
  assert.match(row("Collection"), /Included.*Included/)
  assert.match(row("Game Night"), /Included.*Included/)
  assert.match(row("For You"), /Not included.*Included/)
  assert.match(markup, /ShelfPick Free and Pro feature comparison/)
  assert.match(markup, /Only features already available in ShelfPick are listed here/)
})

test("Discover and the Free comparison use the same Top 100 label", () => {
  const discover = renderToStaticMarkup(React.createElement(DiscoverView, {
    personalized: false, onViewWishlist: () => {}, onUnlockPro: () => {}, onPersonalize: () => {},
  }))
  const comparison = render(ProComparisonView, { user })
  assert.match(discover, /role="tab"[^>]*>Top 100<\/button>/)
  assert.match(comparison, /Discover Hot and Top 100/)
})

test("locked feature presentations use the comparison-screen language", () => {
  const gameNight = render(GameNightView, {
    enabled: false, onBack: () => {}, onViewGame: () => {}, onUnlockPro: () => {},
  })
  assert.match(gameNight, /Game Night isn’t included/)
  assert.match(gameNight, />Compare Free and Pro<\/button>/)
})
