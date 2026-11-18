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

test("Settings plan pill opens the comparison route for Free users", () => {
  globalThis.window = { shelfPickTheme: { getPreference: () => "system" } }
  const markup = render(SettingsView, { user })
  assert.match(markup, /href="\/settings\/pro"[^>]*>FREE</)
  delete globalThis.window
})

test("Free plan leads with available Pro benefits and accurate boundaries", () => {
  const markup = render(ProComparisonView, { user })
  assert.match(markup, /Free covers the essentials/)
  assert.match(markup, /Deeper stats/)
  assert.match(markup, /Help my H-index/)
  assert.match(markup, /Custom scoresheets/)
  assert.match(markup, /More personal recommendations/)
  assert.match(markup, /Live play timing/)
  assert.match(markup, /Five benefits available with Pro access/)
  assert.match(markup, /count-based sessions, not named-player groups/)
  assert.match(markup, /Lock-screen timers and notifications are not included/)
  assert.match(markup, /Phone voting.*Host a vote from guests’ phones/s)
  assert.doesNotMatch(markup, /Not offered in this release/)
  assert.doesNotMatch(markup, /Game Night voting from players’ phones/)
  assert.match(markup, /You’re on Free/)
  assert.match(markup, /Free<\/h2><span class="pro-plan-state">Your plan/)
  assert.match(markup, /Get ShelfPick Pro/)
  assert.doesNotMatch(markup, /Purchases are not available yet/)
  assert.doesNotMatch(markup, /One-off unlock|photo upload/i)
})

test("Pro plan is current and shows the plan, not a purchase prompt", () => {
  const markup = render(ProComparisonView, {
    user: { ...user, tier: "PRO", entitlements: ["game_night_basic", "personalized_discover"] },
  })
  assert.match(markup, /Pro<\/h2><span class="pro-plan-state">Your plan/)
  assert.match(markup, /Pro is active/)
  assert.match(markup, /Your Pro access is active/)
  assert.doesNotMatch(markup, /Unlock ShelfPick Pro|Get ShelfPick Pro/)
})

test("comparison groups activities and retains confirmed Free capabilities", () => {
  const markup = render(ProComparisonView, { user })
  const row = name => markup.match(new RegExp(`<tr><th scope="row"><span>${name}<\\/span>.*?<\\/th>(.*?)<\\/tr>`))?.[1]
  assert.match(row("Collection"), /Included.*Included/)
  assert.match(row("Personal rankings"), /Included.*Included/)
  assert.match(row("Core Picker"), /Included.*Included/)
  assert.match(row("Manual play logging"), /Included.*Included/)
  assert.match(row("Branded play sharing"), /Included.*Included/)
  assert.match(row("Basic Game Night"), /Included.*Included/)
  assert.match(markup, /Build your shelf/)
  assert.match(markup, /Choose a game/)
  assert.match(markup, /Record and share a play/)
  assert.match(markup, /Plan together/)
  assert.match(markup, /ShelfPick Free and Pro feature comparison/)
})

test("comparison distinguishes Pro gates and free phone voting", () => {
  const markup = render(ProComparisonView, { user })
  const row = name => markup.match(new RegExp(`<tr><th scope="row"><span>${name}<\\/span>.*?<\\/th>(.*?)<\\/tr>`))?.[1]
  assert.match(row("Picker ranking influence"), /Not included.*Included/)
  assert.match(row("Discover For You"), /Not included.*Included/)
  assert.match(row("Live play timer"), /Not included.*Included/)
  assert.match(row("Help my H-index"), /Not included.*Included/)
  assert.match(row("Trends and H-index"), /Included.*Included/)
  assert.match(row("Records and head-to-head"), /Not included.*Included/)
  assert.match(row("Stats filters"), /Not included.*Included/)
  assert.match(row("Built-in scoresheets"), /Included.*Included/)
  assert.match(row("Custom scoresheets"), /Not included.*Included/)
  assert.match(row("Phone voting"), /Included.*Included/)
  assert.match(row("Join a hosted vote"), /No account needed.*No account needed/)
  assert.equal(row("Discover Top 100"), undefined)
  assert.doesNotMatch(markup, /Free by policy; ranked source is currently blocked/)
})

test("V1 Discover and plan comparison omit Top 100 without changing Hot or For You", () => {
  const discover = renderToStaticMarkup(React.createElement(DiscoverView, {
    personalized: false, onViewWishlist: () => {}, onUnlockPro: () => {}, onPersonalize: () => {},
  }))
  const comparison = render(ProComparisonView, { user })
  assert.doesNotMatch(discover, /role="tab"[^>]*>Top 100<\/button>/)
  assert.match(discover, /role="tab"[^>]*>Hot<\/button>/)
  assert.match(discover, /role="tab"[^>]*>For You/)
  assert.doesNotMatch(comparison, /Discover Top 100/)
})

test("locked feature presentations use the comparison-screen language", () => {
  const gameNight = render(GameNightView, {
    enabled: false, onBack: () => {}, onViewGame: () => {}, onUnlockPro: () => {},
  })
  assert.match(gameNight, /Game Night isn’t included/)
  assert.match(gameNight, />Compare Free and Pro<\/button>/)
})
