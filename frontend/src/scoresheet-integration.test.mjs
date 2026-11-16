import assert from "node:assert/strict"
import { after, before, test } from "node:test"
import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { createServer } from "vite"

let server
let PlayLogForm

before(async () => {
  server = await createServer({ server: { middlewareMode: true }, appType: "custom" })
  PlayLogForm = (await server.ssrLoadModule("/src/components/collection/PlayLogForm.tsx")).default
})

after(async () => { await server?.close() })

function game(bggId, name) {
  return {
    bgg_id: bggId,
    name,
    year_published: 2020,
    min_players: 1,
    max_players: 5,
    min_play_time: 30,
    max_play_time: 120,
    min_age: 10,
    complexity: 2.5,
    rating: 8,
    owned: true,
    is_expansion: false,
    image_url: null,
    thumbnail_url: null,
    categories: [],
    mechanics: [],
  }
}

function render(gameValue) {
  return renderToStaticMarkup(React.createElement(PlayLogForm, {
    game: gameValue,
    presentation: "dedicated",
    onSaved: async () => {},
  }))
}

test("supported games offer the exact native scoresheet inside Log a Play", () => {
  assert.match(render(game(266192, "Wingspan")), />Use Wingspan scoresheet<\/button>/)
  assert.match(render(game(167791, "Terraforming Mars")), />Use Terraforming Mars scoresheet<\/button>/)
  assert.match(render(game(414317, "Harmonies")), />Use Harmonies scoresheet<\/button>/)
})

test("unsupported games retain manual score and winner controls without a scoresheet option", () => {
  const markup = render(game(13, "Catan"))

  assert.doesNotMatch(markup, /Use .* scoresheet/)
  assert.match(markup, />Score<\/span>/)
  assert.match(markup, />Winner<\/span>/)
  assert.equal((markup.match(/>Save play<\/button>/g) ?? []).length, 1)
})
