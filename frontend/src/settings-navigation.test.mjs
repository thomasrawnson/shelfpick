import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { after, before, test } from "node:test"
import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { MemoryRouter } from "react-router-dom"
import { createServer } from "vite"

let server
let SettingsView
let SettingsSectionView
let AppNavigation

const user = {
  id: 1, email: "morgan@example.com", display_name: "Morgan Account", bgg_username: "morganbgg",
  email_verified: true, onboarding_completed: true, preferred_player_count: 4,
  preferred_play_time: 60, preferred_play_style: "cooperative",
  profile_player_id: 1, player_name: "Morgan Player",
  avatar_key: "forest", tier: "FREE", entitlements: ["game_night_basic"],
}

before(async () => {
  server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: "custom" })
  SettingsView = (await server.ssrLoadModule("/src/components/SettingsView.tsx")).default
  SettingsSectionView = (await server.ssrLoadModule("/src/components/SettingsSectionView.tsx")).default
  AppNavigation = (await server.ssrLoadModule("/src/components/AppNavigation.tsx")).default
})

after(async () => { await server?.close() })

function render(view, props, path = "/settings") {
  return renderToStaticMarkup(React.createElement(MemoryRouter, { initialEntries: [path] }, React.createElement(view, props)))
}

test("settings overview links to each focused settings section", () => {
  const markup = render(SettingsView, { user, onLogout: () => {} })
  for (const path of ["profile", "preferences", "appearance", "collection-data", "plays", "pro", "help", "about"]) {
    assert.match(markup, new RegExp(`href="/settings/${path}"`))
  }
  assert.match(markup, /Your account/)
  assert.match(markup, /Your ShelfPick/)
  assert.match(markup, /Support/)
})

test("profile and preferences render only their selected controls", () => {
  const profile = render(SettingsSectionView, { section: "profile", user, onUserChange: () => {} }, "/settings/profile")
  assert.match(profile, /Player name/)
  assert.match(profile, /Avatar/)
  assert.doesNotMatch(profile, /Usual player count/)

  const preferences = render(SettingsSectionView, { section: "preferences", user, onUserChange: () => {} }, "/settings/preferences")
  assert.match(preferences, /Usual player count/)
  assert.match(preferences, /Usual play time/)
  assert.match(preferences, /Preferred play style/)
  assert.match(preferences, /Cooperative/)
  assert.match(preferences, /Used when a new Picker session starts/)
  assert.doesNotMatch(preferences, /Player name/)
})

test("legacy preferences without play style use the neutral option", () => {
  const preferences = render(SettingsSectionView, {
    section: "preferences",
    user: { ...user, preferred_play_style: undefined },
    onUserChange: () => {},
  }, "/settings/preferences")

  assert.match(preferences, /aria-pressed="true">No preference</)
})

test("Collection and Data keeps import controls separate from profile and account controls", () => {
  const markup = render(SettingsSectionView, { section: "collection-data", user, onUserChange: () => {} }, "/settings/collection-data")
  assert.match(markup, /Sync BoardGameGeek/)
  assert.match(markup, /Import BG Stats history/)
  assert.match(markup, /BoardGameGeek is not affiliated with ShelfPick/)
  assert.match(markup, /src="\/branding\/powered-by-bgg-rgb\.svg"/)
  assert.match(markup, /href="https:\/\/boardgamegeek\.com\/"/)
  assert.doesNotMatch(markup, /Player name|Avatar|Signed in as|Log out/)
})

test("Profile requires password and explicit acknowledgement before account deletion", () => {
  const markup = render(SettingsSectionView, {
    section: "profile",
    user,
    onUserChange: () => {},
    onAccountDeleted: () => {},
  }, "/settings/profile")

  assert.match(markup, /Delete account/)
  assert.match(markup, /type="password"/)
  assert.match(markup, /I understand this cannot be undone/)
  assert.match(markup, /type="submit"[^>]*disabled="">Delete my account/)
})

test("focused settings sections provide a route back to the overview", () => {
  const markup = render(SettingsSectionView, { section: "help", user, onUserChange: () => {} }, "/settings/help")
  assert.match(markup, /href="\/settings"[^>]*>Back to Settings/)
  assert.doesNotMatch(markup, /Sync BoardGameGeek|Usual player count/)
})

test("About links to Pluto Night Labs with an accessible new-tab indication", () => {
  const markup = render(SettingsSectionView, { section: "about", user, onUserChange: () => {} }, "/settings/about")

  assert.match(markup, /href="https:\/\/plutonightlabs\.com\/"/)
  assert.match(markup, /target="_blank"/)
  assert.match(markup, /rel="noopener noreferrer"/)
  assert.match(markup, /Pluto Night Labs<span class="sr-only"> \(opens in a new tab\)<\/span>/)
  assert.match(markup, /src="\/branding\/powered-by-bgg-rgb\.svg"/)
  assert.match(markup, /href="https:\/\/boardgamegeek\.com\/"/)
  assert.match(markup, /alt="Powered by BoardGameGeek"/)
  assert.doesNotMatch(markup, /shelfpick\/privacy|shelfpick\/terms|Privacy Policy draft/)
})

test("Help exposes support contact without publishing legal drafts", () => {
  const markup = render(SettingsSectionView, { section: "help", user, onUserChange: () => {} }, "/settings/help")
  assert.match(markup, /href="mailto:hello@plutonightlabs\.com\?subject=ShelfPick%20support"/)
  assert.match(markup, /Contact support/)
})

test("Appearance offers the experimental Black theme without a plan gate", () => {
  globalThis.window = {
    shelfPickTheme: {
      getPreference: () => "black",
      setPreference: () => {},
    },
  }
  const markup = render(
    SettingsSectionView,
    { section: "appearance", user, onUserChange: () => {} },
    "/settings/appearance",
  )

  assert.match(markup, /Black \(experimental\)/)
  assert.match(markup, /checked="" value="black"/)
  assert.match(markup, /Use device setting/)
  assert.match(markup, />Light</)
  assert.match(markup, />Dark</)
  assert.doesNotMatch(markup, /Pro|upgrade|unlock/i)
  delete globalThis.window
})

test("primary navigation keeps all five named buttons in order", () => {
  const markup = render(AppNavigation, { view: "discover", onChangeView: () => {} })
  assert.match(markup, /<nav class="app-nav" aria-label="Primary">/)
  assert.deepEqual(
    [...markup.matchAll(/<span class="nav-label">([^<]+)<\/span>/g)].map((match) => match[1]),
    ["Pick", "Collection", "Game Night", "Discover", "Insights"],
  )
  assert.equal((markup.match(/<button /g) ?? []).length, 5)
  assert.equal((markup.match(/aria-current="page"/g) ?? []).length, 1)
})

test("native navigation wraps complete destinations without horizontal scrolling", async () => {
  const native = await readFile(new URL("./styles/native-dynamic-type.css", import.meta.url), "utf8")
  assert.match(native, /:root\[data-native-ios\]\s+\.app-nav\s*\{[^}]*flex-wrap:\s*wrap;[^}]*overflow-x:\s*hidden;/s)
  assert.match(native, /:root\[data-native-ios\]\s+\.nav-button\s*\{[^}]*flex:\s*1 0 max-content;[^}]*max-width:\s*100%;/s)
  assert.match(native, /:root\[data-native-ios\]\s+\.nav-label\s*\{[^}]*overflow-wrap:\s*anywhere;/s)
  assert.match(native, /:root\[data-native-ios\]\s+\.app-phone\s*\{[^}]*padding-bottom:\s*calc\(max\(128px, 8rem\)/s)
  assert.doesNotMatch(native, /overflow-x:\s*auto;/)
})
