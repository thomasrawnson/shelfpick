import assert from "node:assert/strict"
import { after, before, test } from "node:test"
import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { MemoryRouter } from "react-router-dom"
import { createServer } from "vite"

let server
let SettingsView
let SettingsSectionView

const user = {
  id: 1, email: "morgan@example.com", display_name: "Morgan Account", bgg_username: "morganbgg",
  email_verified: true, onboarding_completed: true, preferred_player_count: 4,
  preferred_play_time: 60, profile_player_id: 1, player_name: "Morgan Player",
  avatar_key: "forest", tier: "FREE", entitlements: ["game_night_basic"],
}

before(async () => {
  server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: "custom" })
  SettingsView = (await server.ssrLoadModule("/src/components/SettingsView.tsx")).default
  SettingsSectionView = (await server.ssrLoadModule("/src/components/SettingsSectionView.tsx")).default
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
  assert.doesNotMatch(preferences, /Player name/)
})

test("Collection and Data keeps import controls separate from profile and account controls", () => {
  const markup = render(SettingsSectionView, { section: "collection-data", user, onUserChange: () => {} }, "/settings/collection-data")
  assert.match(markup, /Sync BoardGameGeek/)
  assert.match(markup, /Import BG Stats history/)
  assert.match(markup, /BoardGameGeek is not affiliated with ShelfPick/)
  assert.doesNotMatch(markup, /Player name|Avatar|Signed in as|Log out/)
})

test("focused settings sections provide a route back to the overview", () => {
  const markup = render(SettingsSectionView, { section: "help", user, onUserChange: () => {} }, "/settings/help")
  assert.match(markup, /href="\/settings"[^>]*>Back to Settings/)
  assert.doesNotMatch(markup, /Sync BoardGameGeek|Usual player count/)
})
