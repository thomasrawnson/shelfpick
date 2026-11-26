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

  assert.deepEqual(discoverEmptyCopy("hot"), {
    title: "No new games to show right now",
    body: "No unowned Hot games are available right now. Check again later for new ideas.",
    actionLabel: "Reload list",
    actionMode: "hot",
  })
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
      title: "Picked for you",
      body: "Based on your shelf and your play preferences.",
      detail: [
        "Themes and mechanics of the games on your shelf",
        "Your usual player count and session length",
      ],
      actionLabel: null,
    },
  )
  assert.deepEqual(
    discoverPersonalisationCopy("personalised", ["collection", "play_history", "rankings"]),
    {
      title: "Picked for you",
      body: "Based on your shelf, the games you’ve played, and your rankings.",
      detail: [
        "Themes and mechanics of the games on your shelf, counting the ones you play most more",
        "Games like the ones you rank highest",
      ],
      actionLabel: null,
    },
  )
  assert.deepEqual(
    discoverPersonalisationCopy("personalised", ["rankings"]),
    {
      title: "Picked for you",
      body: "Based on your rankings.",
      detail: ["Games like the ones you rank highest"],
      actionLabel: null,
    },
  )
  assert.deepEqual(
    discoverPersonalisationCopy("popular_fallback", []),
    {
      title: "Popular picks to get you started",
      body: "Log a few plays or set your preferences and these will start to fit you. Until then, they’re popular on BoardGameGeek.",
      detail: [],
      actionLabel: "Set play preferences",
    },
  )
  assert.equal(discoverPersonalisationCopy("unknown", []), null)
})
