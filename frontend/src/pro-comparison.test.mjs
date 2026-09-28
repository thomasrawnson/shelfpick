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

test("Free plan leads with the three implemented Pro benefits and accurate boundaries", () => {
  const markup = render(ProComparisonView, { user })
  assert.match(markup, /Free covers the essentials/)
  assert.match(markup, /More personal recommendations/)
  assert.match(markup, /Live play timing/)
  assert.match(markup, /Game Night voting from friends’ phones/)
  assert.match(markup, /count-based sessions, not named-player groups/)
  assert.match(markup, /Lock-screen timers and notifications are not included/)
  assert.match(markup, /Guests join in their browser without an account or Pro/)
  assert.match(markup, /You’re on Free/)
  assert.match(markup, /Free<\/h2><span class="pro-plan-state">Your plan/)
  assert.match(markup, /One-off unlock/)
  assert.match(markup, /Purchases are not available yet/)
  assert.match(markup, /not a subscription/)
  assert.match(markup, /No price or Buy action is shown/)
  assert.doesNotMatch(markup, /<button[^>]*>.*(?:Buy|Unlock ShelfPick Pro)/s)
  assert.doesNotMatch(markup, /£3\.99|photo upload/i)
})

test("Pro plan is current without a purchase action", () => {
  const markup = render(ProComparisonView, {
    user: { ...user, tier: "PRO", entitlements: ["game_night_basic", "personalized_discover"] },
  })
  assert.match(markup, /Pro<\/h2><span class="pro-plan-state">Your plan/)
  assert.match(markup, /Pro is active/)
  assert.match(markup, /Your Pro access is active/)
  assert.doesNotMatch(markup, /Unlock ShelfPick Pro/)
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

test("comparison distinguishes Pro gates, guest access and blocked source availability", () => {
  const markup = render(ProComparisonView, { user })
  const row = name => markup.match(new RegExp(`<tr><th scope="row"><span>${name}<\\/span>.*?<\\/th>(.*?)<\\/tr>`))?.[1]
  assert.match(row("Picker ranking influence"), /Not included.*Included/)
  assert.match(row("Discover For You"), /Not included.*Included/)
  assert.match(row("Live play timer"), /Not included.*Included/)
  assert.match(row("Open phone voting"), /Not included.*Included/)
  assert.match(row("Join a friend’s vote"), /No plan needed.*No plan needed/)
  assert.match(row("Discover Top 100"), /Unavailable.*Unavailable/)
  assert.match(markup, /Free by policy; ranked source is currently blocked/)
})

test("Discover continues to use the Top 100 label while comparison records its limitation", () => {
  const discover = renderToStaticMarkup(React.createElement(DiscoverView, {
    personalized: false, onViewWishlist: () => {}, onUnlockPro: () => {}, onPersonalize: () => {},
  }))
  const comparison = render(ProComparisonView, { user })
  assert.match(discover, /role="tab"[^>]*>Top 100<\/button>/)
  assert.match(comparison, /Discover Top 100/)
  assert.match(comparison, /ranked source is currently blocked/)
})

test("locked feature presentations use the comparison-screen language", () => {
  const gameNight = render(GameNightView, {
    enabled: false, onBack: () => {}, onViewGame: () => {}, onUnlockPro: () => {},
  })
  assert.match(gameNight, /Game Night isn’t included/)
  assert.match(gameNight, />Compare Free and Pro<\/button>/)
})
