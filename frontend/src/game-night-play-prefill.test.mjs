import assert from "node:assert/strict"
import { after, before, test } from "node:test"
import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { createServer } from "vite"

let server
let GameNightPlayLog
let selectedPlayerNamesInOrder

before(async () => {
  server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: "custom" })
  GameNightPlayLog = (
    await server.ssrLoadModule("/src/components/GameNightView.tsx")
  ).GameNightPlayLog
  selectedPlayerNamesInOrder = (
    await server.ssrLoadModule("/src/player-selection.ts")
  ).selectedPlayerNamesInOrder
})

after(async () => { await server?.close() })

const game = {
  bgg_id: 13,
  name: "Cascadia",
  year_published: 2021,
  min_players: 1,
  max_players: 4,
  min_play_time: 30,
  max_play_time: 45,
  min_age: 10,
  complexity: 1.9,
  rating: 8.0,
  owned: true,
  is_expansion: false,
  image_url: null,
  thumbnail_url: null,
  categories: [],
  mechanics: [],
}

function renderPlayLog(selectedPlayerIds, selectedPlayerNames) {
  return renderToStaticMarkup(React.createElement(GameNightPlayLog, {
    game,
    selectedPlayerIds,
    selectedPlayerNames,
    presentation: "dedicated",
  }))
}

test("Game Night play logging prepopulates exact named participants in selection order", () => {
  const players = [
    { id: 1, name: "Alex", avatar_key: "forest" },
    { id: 2, name: "Morgan", avatar_key: "gold" },
  ]
  const playerIds = [2, 1]
  const playerNames = selectedPlayerNamesInOrder(players, playerIds)
  const markup = renderPlayLog(playerIds, playerNames)

  assert.deepEqual(playerNames, ["Morgan", "Alex"])
  assert.ok(markup.indexOf('value="Morgan"') < markup.indexOf('value="Alex"'))
  assert.equal((markup.match(/placeholder="Player name"/g) ?? []).length, 2)
})

test("count-only Game Night play logging creates the correct number of editable blank rows", () => {
  const markup = renderPlayLog([10, 11, 12], [])

  assert.equal((markup.match(/placeholder="Player name"/g) ?? []).length, 3)
  assert.equal((markup.match(/value=""/g) ?? []).length >= 3, true)
  assert.match(markup, /\+ Add player/)
})

test("changed and repeated Game Night entry does not retain stale participants", () => {
  const firstEntry = renderPlayLog([1, 2], ["Alex", "Morgan"])
  const changedEntry = renderPlayLog([3], ["Sam"])

  assert.match(firstEntry, /value="Alex"/)
  assert.match(firstEntry, /value="Morgan"/)
  assert.match(changedEntry, /value="Sam"/)
  assert.doesNotMatch(changedEntry, /value="Alex"|value="Morgan"/)
  assert.equal((changedEntry.match(/placeholder="Player name"/g) ?? []).length, 1)
})

test("incomplete Game Night selections remain editable without duplicating names", () => {
  const markup = renderPlayLog([1, 2], ["Alex"])

  assert.equal((markup.match(/value="Alex"/g) ?? []).length, 1)
  assert.equal((markup.match(/placeholder="Player name"/g) ?? []).length, 2)
})
