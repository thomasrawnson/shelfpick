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

// Settings reads the device theme through window.shelfPickTheme.
const settingsWindow = { shelfPickTheme: { getPreference: () => "dark", setPreference: () => {} } }

before(async () => {
  globalThis.window = settingsWindow
  server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: "custom" })
  SettingsView = (await server.ssrLoadModule("/src/components/SettingsView.tsx")).default
  SettingsSectionView = (await server.ssrLoadModule("/src/components/SettingsSectionView.tsx")).default
  AppNavigation = (await server.ssrLoadModule("/src/components/AppNavigation.tsx")).default
})

after(async () => { delete globalThis.window; await server?.close() })

function render(view, props, path = "/settings") {
  return renderToStaticMarkup(React.createElement(MemoryRouter, { initialEntries: [path] }, React.createElement(view, props)))
}

test("Settings root lists the groups in the agreed order with no avatar header", () => {
  const markup = render(SettingsView, { user, purchases: null })
  for (const path of ["profile", "pro", "preferences", "collection-data", "import", "whats-new", "help"]) {
    assert.match(markup, new RegExp(`href="/settings/${path}"`))
  }
  assert.deepEqual(
    [...markup.matchAll(/<h2 id="[^"]+">([^<]+)<\/h2>/g)].map((match) => match[1]),
    ["Appearance", "Players and picking", "Collection", "Data and backup", "Support ShelfPick", "Feedback", "Follow ShelfPick", "About"],
  )
  assert.match(markup, /Account, plan and log out/)
  assert.match(markup, /aria-label="Plan: Free. Compare plans"[^>]*>FREE</)
  assert.match(markup, /4 players · 60 min/)
  assert.match(markup, /Import plays<\/span><span class="settings-row-value">BG Stats</)
  assert.match(markup, /ShelfPick 1\.1 \(11\) · Pluto Night Labs/)
  assert.match(markup, /alt="Powered by BoardGameGeek"/)
  assert.doesNotMatch(markup, /Log out<|Play history|settings\/appearance/)
})

test("Theme is an inline menu with an accessible name and the current value", () => {
  const markup = render(SettingsView, { user, purchases: null })
  const labelId = /<span class="settings-row-label" id="([^"]+)">Theme</.exec(markup)?.[1]
  assert.ok(labelId, "Theme label has an id")
  assert.match(markup, new RegExp(`<select class="settings-row-select" aria-labelledby="${labelId}">`))
  assert.deepEqual(
    [...markup.matchAll(/<option value="([a-z]+)"/g)].map((match) => match[1]),
    ["dark", "light", "system", "black"],
  )
  assert.match(markup, /<option value="dark" selected="">/)
})

test("Free users see the Pro upsell card; Pro users see a plan row, not the upsell or the FREE pill", () => {
  const free = render(SettingsView, { user, purchases: null })
  assert.match(free, /class="settings-upsell" href="\/settings\/pro"[^>]*>.*Unlock ShelfPick Pro/)
  const pro = render(SettingsView, { user: { ...user, tier: "PRO" }, purchases: null })
  assert.match(pro, /aria-label="Plan: ShelfPick Pro">PRO</)
  assert.doesNotMatch(pro, /Unlock ShelfPick Pro|settings-upsell|Compare plans/)
  // The only way to Restore purchases and Manage subscription once Pro is active.
  assert.match(pro, /href="\/settings\/pro"[^>]*>.*Your Pro plan.*Restore, manage/)
})

test("External rows come from SOCIAL_LINKS and say they open outside the app", async () => {
  const { SOCIAL_LINKS, REVIEW_URL, CONTACT_URL } = await server.ssrLoadModule("/src/app-links.ts")
  assert.equal(SOCIAL_LINKS.website.url, "https://plutonightlabs.com")
  assert.equal(SOCIAL_LINKS.youtube.url, "https://www.youtube.com/@shelfpick")
  const markup = render(SettingsView, { user, purchases: null })
  for (const link of [SOCIAL_LINKS.website, SOCIAL_LINKS.youtube]) {
    const escaped = link.url.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")
    assert.match(markup, new RegExp(`href="${escaped}" target="_blank" rel="noopener noreferrer" aria-label="[^"]+, ${link.label.replace(".", "\\.")} \\(opens outside ShelfPick\\)"`))
  }
  assert.equal(REVIEW_URL, "https://apps.apple.com/app/id6833957995?action=write-review")
  assert.match(markup, /href="https:\/\/apps\.apple\.com\/app\/id6833957995\?action=write-review" target="_blank"[^>]*aria-label="Leave a review \(opens the App Store\)"/)
  assert.match(markup, new RegExp(`href="${CONTACT_URL}" target="_blank"[^>]*aria-label="Contact, Email us \\(opens your email app\\)"`))
  // Every new-window link in the root says where it goes.
  const external = [...markup.matchAll(/<a [^>]*target="_blank"[^>]*>/g)].map((match) => match[0])
  for (const tag of external) assert.match(tag, /aria-label="[^"]*\(opens [^)]+\)"|class="bgg-attribution"/)
})

test("Every Settings row and control has an accessible name", () => {
  const markup = render(SettingsView, { user, purchases: { loadProducts: async () => [], purchase: async () => ({ status: "cancelled" }) } })
  const rows = [...markup.matchAll(/<(a|button)[^>]*class="settings-row"[^>]*>(.*?)<\/\1>/g)]
  assert.ok(rows.length >= 11)
  for (const [, , inner] of rows) assert.match(inner, /settings-row-label">[^<]/)
  assert.match(markup, /<button type="button" class="settings-row" data-settings-entry="tips">/)
  assert.match(markup, />Request a feature</)
  assert.match(markup, />Report a problem</)
})

test("Profile shows the plan and ends with Log out", () => {
  const markup = render(SettingsSectionView, {
    section: "profile", user, onUserChange: () => {}, onLogout: async () => {},
  }, "/settings/profile")
  assert.match(markup, /ShelfPick Free/)
  assert.match(markup, /href="\/settings\/pro"[^>]*>Compare plans/)
  assert.ok(markup.lastIndexOf(">Log out<") > markup.indexOf("Delete my account"), "Log out sits below account deletion")
  const pro = render(SettingsSectionView, { section: "profile", user: { ...user, tier: "PRO" }, onUserChange: () => {}, onLogout: async () => {} }, "/settings/profile")
  assert.match(pro, /ShelfPick Pro/)
  assert.doesNotMatch(pro, /Compare plans/)
})

test("BoardGameGeek sync times read as short relative values", async () => {
  const { relativeSyncTime } = await server.ssrLoadModule("/src/bgg-sync-time.ts")
  const now = new Date("2026-11-18T12:00:00Z")
  assert.equal(relativeSyncTime(new Date("2026-11-18T11:59:40Z"), now), "Just now")
  assert.equal(relativeSyncTime(new Date("2026-11-18T11:15:00Z"), now), "45m ago")
  assert.equal(relativeSyncTime(new Date("2026-11-18T09:00:00Z"), now), "3h ago")
  assert.equal(relativeSyncTime(new Date("2026-11-15T12:00:00Z"), now), "3d ago")
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

test("BoardGameGeek sync and import have their own screens without account controls", () => {
  const imports = render(SettingsSectionView, { section: "import", user, onUserChange: () => {} }, "/settings/import")
  assert.match(imports, /Import BG Stats history/)
  assert.doesNotMatch(imports, /Sync BoardGameGeek|Log out/)

  const markup = render(SettingsSectionView, { section: "collection-data", user, onUserChange: () => {} }, "/settings/collection-data")
  assert.match(markup, /Sync BoardGameGeek/)
  assert.doesNotMatch(markup, /Import BG Stats history/)
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

test("Help links to Pluto Night Labs with an accessible new-tab indication", () => {
  const markup = render(SettingsSectionView, { section: "help", user, onUserChange: () => {} }, "/settings/help")

  assert.match(markup, /href="https:\/\/plutonightlabs\.com"/)
  assert.match(markup, /Version 1\.1/)
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

test("primary navigation keeps all five named buttons in order", () => {
  const markup = render(AppNavigation, { view: "discover", onChangeView: () => {} })
  assert.match(markup, /<nav class="app-nav" aria-label="Primary">/)
  assert.deepEqual(
    [...markup.matchAll(/<span class="nav-label">([^<]+)<\/span>/g)].map((match) => match[1]),
    ["Tonight", "Shelf", "Plays", "Discover", "Stats"],
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
