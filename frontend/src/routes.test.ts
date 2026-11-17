import assert from "node:assert/strict"
import test from "node:test"

import {
  APP_PATHS,
  appViewForPath,
  shelfGamePath,
  shelfPath,
  gameNightJoinToken,
  isIncompleteOnboardingPath,
  legacyRedirect,
  safeReturnPath,
  wishlistGamePath,
} from "./routes.ts"

test("incomplete onboarding permits only onboarding and account options", () => {
  assert.equal(isIncompleteOnboardingPath(APP_PATHS.onboarding), true)
  assert.equal(isIncompleteOnboardingPath(APP_PATHS.onboardingAccount), true)
  assert.equal(isIncompleteOnboardingPath(APP_PATHS.tonight), false)
  assert.equal(isIncompleteOnboardingPath(APP_PATHS.settingsProfile), false)
})


test("collection routes represent section and game selection", () => {
  assert.equal(shelfPath("ranking"), "/shelf/ranking")
  assert.equal(appViewForPath("/shelf/ranking"), "shelf")
  assert.equal(
    shelfPath("owned"),
    "/shelf/owned",
  )
  assert.equal(
    shelfPath("wishlist"),
    "/shelf/want-to-play",
  )
  assert.equal(
    shelfGamePath(42),
    "/shelf/owned/42",
  )
  assert.equal(
    wishlistGamePath(42),
    "/shelf/want-to-play/42",
  )
})


test("Game Night guest links remain public session-scoped routes", () => {
  assert.equal(
    gameNightJoinToken("/game-night/join/guest-token"),
    "guest-token",
  )
  assert.equal(gameNightJoinToken("/game-night"), null)
  assert.equal(gameNightJoinToken("/game-night/join/"), null)
  assert.equal(
    safeReturnPath("/game-night/join/guest-token"),
    null,
  )
})


test("legal review routes are explicit draft paths and never protected return targets", () => {
  assert.equal(APP_PATHS.privacyDraft, "/legal/privacy-draft")
  assert.equal(APP_PATHS.termsDraft, "/legal/terms-draft")
  assert.equal(safeReturnPath(APP_PATHS.privacyDraft), null)
  assert.equal(safeReturnPath(APP_PATHS.termsDraft), null)
})


test("every tab owns its routes", () => {
  assert.equal(appViewForPath("/shelf/owned/42"), "shelf")
  assert.equal(appViewForPath("/shelf/want-to-play/42"), "shelf")
  assert.equal(appViewForPath(APP_PATHS.shelfRanking), "shelf")
  assert.equal(appViewForPath(APP_PATHS.tonight), "tonight")
  assert.equal(appViewForPath(APP_PATHS.tonightPlay), "tonight")
  assert.equal(appViewForPath(APP_PATHS.plays), "plays")
  assert.equal(appViewForPath(APP_PATHS.discover), "discover")
  assert.equal(appViewForPath(APP_PATHS.stats), "stats")
})


test("every legacy URL and deep link resolves to its new home", () => {
  const cases: Array<[string, string]> = [
    ["/picker", "/tonight"],
    ["/picker/log-play", "/tonight/log-play"],
    ["/collection", "/shelf"],
    ["/collection/owned", "/shelf/owned"],
    ["/collection/owned/42", "/shelf/owned/42"],
    ["/collection/want-to-play", "/shelf/want-to-play"],
    ["/collection/want-to-play/42", "/shelf/want-to-play/42"],
    ["/collection/ranking", "/shelf/ranking"],
    ["/rankings", "/shelf/ranking"],
    ["/game-night", "/tonight?mode=vote"],
    ["/insights", "/stats"],
  ]
  for (const [legacy, expected] of cases) {
    assert.equal(legacyRedirect(legacy), expected, legacy)
    // A logged-out deep link survives login and lands on the new path.
    assert.equal(safeReturnPath(legacy), expected, `return ${legacy}`)
  }
  assert.equal(legacyRedirect("/insights", "?section=recaps"), "/stats?section=recaps")
  assert.equal(legacyRedirect("/picker/log-play", "?game=3"), "/tonight/log-play?game=3")
})


test("new paths and guest voting links are never rewritten", () => {
  for (const path of ["/tonight", "/shelf/owned", "/plays", "/discover", "/stats", "/live-timer", "/settings/pro"]) {
    assert.equal(legacyRedirect(path), null, path)
    assert.equal(safeReturnPath(path), path, path)
  }
  assert.equal(legacyRedirect("/game-night/join/guest-token"), null)
  assert.equal(safeReturnPath("/game-night/join/guest-token"), null)
  assert.equal(gameNightJoinToken("/game-night/join/guest-token"), "guest-token")
})


test("return routes accept app deep links but reject unsafe paths", () => {
  assert.equal(
    safeReturnPath(
      "/shelf/want-to-play?from=login",
    ),
    "/shelf/want-to-play?from=login",
  )
  assert.equal(
    safeReturnPath("https://example.com"),
    null,
  )
  assert.equal(
    safeReturnPath("//example.com/picker"),
    null,
  )
  assert.equal(
    safeReturnPath("/reset-password?token=secret"),
    null,
  )
  assert.equal(safeReturnPath("/game-night"), "/tonight?mode=vote")
  assert.equal(safeReturnPath("/rankings"), "/shelf/ranking")
  assert.equal(safeReturnPath("/settings/profile"), "/settings/profile")
  assert.equal(appViewForPath(APP_PATHS.settings), "setup")
  assert.equal(appViewForPath(APP_PATHS.settingsPro), "setup")
  assert.equal(safeReturnPath(APP_PATHS.settingsPro), APP_PATHS.settingsPro)
  assert.equal(appViewForPath(APP_PATHS.settingsPreferences), "setup")
  assert.equal(safeReturnPath(APP_PATHS.settingsCollectionData), APP_PATHS.settingsCollectionData)
  assert.equal(safeReturnPath(APP_PATHS.tonightPlay), APP_PATHS.tonightPlay)
  assert.equal(appViewForPath(APP_PATHS.tonightPlay), "tonight")
})
