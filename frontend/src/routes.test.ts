import assert from "node:assert/strict"
import test from "node:test"

import {
  APP_PATHS,
  appViewForPath,
  collectionGamePath,
  collectionPath,
  gameNightJoinToken,
  safeReturnPath,
  wishlistGamePath,
} from "./routes.ts"


test("collection routes represent section and game selection", () => {
  assert.equal(collectionPath("ranking"), "/collection/ranking")
  assert.equal(appViewForPath("/collection/ranking"), "collection")
  assert.equal(
    collectionPath("owned"),
    "/collection/owned",
  )
  assert.equal(
    collectionPath("wishlist"),
    "/collection/want-to-play",
  )
  assert.equal(
    collectionGamePath(42),
    "/collection/owned/42",
  )
  assert.equal(
    wishlistGamePath(42),
    "/collection/want-to-play/42",
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


test("collection detail routes keep Collection navigation active", () => {
  assert.equal(
    appViewForPath(
      "/collection/owned/42",
    ),
    "collection",
  )
  assert.equal(
    appViewForPath(
      "/collection/want-to-play/42",
    ),
    "collection",
  )
  assert.equal(
    appViewForPath(APP_PATHS.discover),
    "discover",
  )
  assert.equal(
    appViewForPath(APP_PATHS.gameNight),
    "gameNight",
  )
  assert.equal(
    appViewForPath(APP_PATHS.rankings),
    "collection",
  )
})


test("return routes accept app deep links but reject unsafe paths", () => {
  assert.equal(
    safeReturnPath(
      "/collection/want-to-play?from=login",
    ),
    "/collection/want-to-play?from=login",
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
  assert.equal(
    safeReturnPath("/game-night"),
    "/game-night",
  )
  assert.equal(
    safeReturnPath("/rankings"),
    "/rankings",
  )
  assert.equal(safeReturnPath("/settings/profile"), "/settings/profile")
  assert.equal(appViewForPath(APP_PATHS.settings), "setup")
  assert.equal(appViewForPath(APP_PATHS.settingsPro), "setup")
  assert.equal(safeReturnPath(APP_PATHS.settingsPro), APP_PATHS.settingsPro)
  assert.equal(appViewForPath(APP_PATHS.settingsPreferences), "setup")
  assert.equal(safeReturnPath(APP_PATHS.settingsCollectionData), APP_PATHS.settingsCollectionData)
  assert.equal(safeReturnPath(APP_PATHS.pickerPlay), APP_PATHS.pickerPlay)
  assert.equal(appViewForPath(APP_PATHS.pickerPlay), "picker")
})
