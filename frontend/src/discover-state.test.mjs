import assert from "node:assert/strict"
import test from "node:test"

import { discoverEmptyCopy, discoverPersonalisationCopy } from "./discover-state.ts"


test("Discover empty copy distinguishes personalised no-match results", () => {
  assert.deepEqual(discoverEmptyCopy("for_you"), {
    title: "No personalised matches yet",
    body: "No unowned games match the signals available right now. Hot may have more ideas.",
    actionLabel: "Browse Hot",
    actionMode: "hot",
  })

  assert.match(
    discoverEmptyCopy("hot").body,
    /unowned Hot games/,
  )
  assert.match(
    discoverEmptyCopy("top100").body,
    /unowned Top 100 games/,
  )
})

test("Discover distinguishes dismissed cards from source emptiness", () => {
  assert.deepEqual(discoverEmptyCopy("hot", true), {
    title: "You've cleared this list",
    body: "Reload the list to bring those games back.",
    actionLabel: "Reload list",
    actionMode: "hot",
  })
})

test("For You distinguishes truthful personalised and popular fallback copy", () => {
  assert.deepEqual(
    discoverPersonalisationCopy("personalised", ["collection", "preferences"]),
    {
      title: "Picked for how you play",
      body: "These matches use games on your Owned shelf and your saved play preferences.",
      actionLabel: null,
    },
  )
  assert.deepEqual(
    discoverPersonalisationCopy("personalised", ["rankings"]),
    {
      title: "Picked for how you play",
      body: "These matches use your personal ShelfPick rankings.",
      actionLabel: null,
    },
  )
  assert.deepEqual(
    discoverPersonalisationCopy("popular_fallback", []),
    {
      title: "Popular picks to get you started",
      body: "ShelfPick doesn’t have a matching shelf, play or preference signal yet, so these games come from BoardGameGeek Hot and ranked lists.",
      actionLabel: "Set play preferences",
    },
  )
  assert.equal(discoverPersonalisationCopy("unknown", []), null)
})
