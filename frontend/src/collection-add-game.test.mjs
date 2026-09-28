import assert from "node:assert/strict"
import { after, before, test } from "node:test"
import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { MemoryRouter } from "react-router-dom"
import { createServer } from "vite"

import { mergeGameIntoCollection } from "./collection-state.ts"

let server
let CollectionGameList
let AddGameSearch

const game = { bgg_id: 1, name: "Cascadia", owned: true, categories: [], mechanics: [] }

before(async () => {
  server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: "custom" })
  CollectionGameList = (await server.ssrLoadModule("/src/components/collection/CollectionGameList.tsx")).default
  AddGameSearch = (await server.ssrLoadModule("/src/components/collection/AddGameSearch.tsx")).default
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
