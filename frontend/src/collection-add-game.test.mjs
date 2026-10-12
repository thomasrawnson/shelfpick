import assert from "node:assert/strict"
import { after, before, test } from "node:test"
import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { MemoryRouter } from "react-router-dom"
import { createServer } from "vite"

import { mergeGameIntoCollection } from "./collection-state.ts"
import {
  beginAddGameAction as beginAction,
  markSearchResultMembership as markMembership,
} from "./add-game-state.ts"

let server
let CollectionGameList
let AddGameSearch
let AddGameResult
const beginAddGameAction = beginAction
const markSearchResultMembership = markMembership

const game = { bgg_id: 1, name: "Cascadia", owned: true, categories: [], mechanics: [] }

before(async () => {
  server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: "custom" })
  CollectionGameList = (await server.ssrLoadModule("/src/components/collection/CollectionGameList.tsx")).default
  const addGameModule = await server.ssrLoadModule("/src/components/collection/AddGameSearch.tsx")
  AddGameSearch = addGameModule.default
  AddGameResult = addGameModule.AddGameResult
})

after(async () => { await server?.close() })

function render(view, props) {
  return renderToStaticMarkup(React.createElement(MemoryRouter, null, React.createElement(view, props)))
}

test("adding a game appends it once without replacing collection state", () => {
  const existing = [game]
  assert.equal(mergeGameIntoCollection(existing, game), existing)
  const added = mergeGameIntoCollection(existing, { ...game, bgg_id: 2, name: "Heat" })
  assert.deepEqual(added.map(item => item.bgg_id), [1, 2])
})

test("empty and filtered collections keep distinct recovery actions", () => {
  const shared = { games: [], statsByGame: new Map(), onOpenGame: () => {}, onAddGame: () => {}, onClearFilters: () => {} }
  const empty = render(CollectionGameList, { ...shared, totalGames: 0 })
  assert.match(empty, />Add game<\/button>/)
  assert.match(empty, /href="\/settings\/collection-data"[^>]*>Import from BGG/)
  assert.doesNotMatch(empty, />Clear filters</)

  const filtered = render(CollectionGameList, { ...shared, totalGames: 3 })
  assert.match(filtered, /No games match these filters/)
  assert.match(filtered, />Clear filters<\/button>/)
  assert.doesNotMatch(filtered, /Import from BGG/)
})

test("existing add flow exposes labelled search, cancel and BGG import routes", () => {
  const markup = render(AddGameSearch, { onGameAdded: () => {}, onClose: () => {} })
  assert.match(markup, /<label[^>]*for="add-game-query"[^>]*>Game title/)
  assert.match(markup, /type="submit"[^>]*disabled=""[^>]*>Search/)
  assert.match(markup, />Close<\/button>/)
  assert.match(markup, /href="\/settings\/collection-data"[^>]*>Import from BoardGameGeek/)
})

function renderResult(overrides = {}, pendingAction = "") {
  return render(AddGameResult, {
    result: {
      bgg_id: 2,
      name: "Heat",
      year_published: 2022,
      owned: false,
      wishlisted: false,
      ...overrides,
    },
    pendingAction,
    onAdd: () => {},
  })
}

test("search results expose independent Owned and Want to Play actions", () => {
  const markup = renderResult()
  assert.match(markup, /role="group" aria-label="Add Heat"/)
  assert.match(markup, />Add to Owned<\/button>/)
  assert.match(markup, />Add to Want to Play<\/button>/)
})

test("search results accurately show either or both memberships", () => {
  const owned = renderResult({ owned: true })
  assert.match(owned, /disabled=""[^>]*>Already Owned<\/button>/)
  assert.match(owned, />Add to Want to Play<\/button>/)

  const wishlisted = renderResult({ wishlisted: true })
  assert.match(wishlisted, />Add to Owned<\/button>/)
  assert.match(wishlisted, /disabled=""[^>]*>Already Want to Play<\/button>/)

  const both = renderResult({ owned: true, wishlisted: true })
  assert.match(both, />Already Owned<\/button>/)
  assert.match(both, />Already Want to Play<\/button>/)
  assert.equal((both.match(/disabled=""/g) ?? []).length, 2)
})

test("a pending mutation disables both destinations and identifies its progress", () => {
  const owned = renderResult({}, "owned:2")
  assert.match(owned, />Adding to Owned\.\.\.<\/button>/)
  assert.equal((owned.match(/disabled=""/g) ?? []).length, 2)

  const wishlist = renderResult({}, "wishlist:2")
  assert.match(wishlist, />Adding to Want to Play\.\.\.<\/button>/)
  assert.equal((wishlist.match(/disabled=""/g) ?? []).length, 2)
})

test("duplicate or competing clicks are synchronously rejected", () => {
  const pending = new Set()
  assert.equal(beginAddGameAction(pending, "owned:2"), true)
  assert.equal(beginAddGameAction(pending, "owned:2"), false)
  assert.equal(beginAddGameAction(pending, "wishlist:2"), false)
  assert.deepEqual([...pending], ["owned:2"])

  pending.delete("owned:2")
  assert.equal(beginAddGameAction(pending, "wishlist:2"), true)
})

test("membership updates preserve the search result set and other destination", () => {
  const results = [
    { bgg_id: 2, name: "Heat", year_published: 2022, owned: false, wishlisted: true },
    { bgg_id: 3, name: "Sky Team", year_published: 2023, owned: false, wishlisted: false },
  ]

  const owned = markSearchResultMembership(results, 2, "owned")
  assert.equal(owned.length, 2)
  assert.deepEqual(owned[0], { ...results[0], owned: true })
  assert.equal(owned[1], results[1])

  const wishlisted = markSearchResultMembership(results, 3, "wishlist")
  assert.equal(wishlisted.length, 2)
  assert.deepEqual(wishlisted[1], { ...results[1], wishlisted: true })
  assert.equal(wishlisted[0], results[0])
})
