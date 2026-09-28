import assert from "node:assert/strict"
import { after, before, test } from "node:test"
import { createServer } from "vite"

let server
let buildShareCardContent
let renderPlayShareCard
let isShareCancellation
let defaults

before(async () => {
  server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: "custom" })
  const module = await server.ssrLoadModule("/src/share-card.ts")
  buildShareCardContent = module.buildShareCardContent
  renderPlayShareCard = module.renderPlayShareCard
  isShareCancellation = module.isShareCancellation
  defaults = module.DEFAULT_SHARE_PRIVACY
})

after(async () => { await server?.close() })

const game = {
  name: "A Very Long Game Title That Still Belongs on the Card",
  mechanics: [],
}
const play = {
  played_at: "2026-09-28T12:00:00.000Z",
  duration_minutes: 75,
  location: "The Dice Cup",
  participants: [
    { name: "Alex", score: 42, is_winner: true },
    { name: "Morgan", score: null, is_winner: false },
  ],
}

test("privacy defaults hide names, scores and location", () => {
  const content = buildShareCardContent(game, play, defaults)
  assert.deepEqual(content.participants, [
    { label: "Player 1", score: null },
    { label: "Player 2", score: null },
  ])
  assert.equal(content.location, null)
  assert.equal(content.result, "Winner recorded")
})

test("explicit privacy choices produce the exact preview content without inventing scores", () => {
  const content = buildShareCardContent(game, play, {
    includePlayerNames: true,
    includeScores: true,
    includeLocation: true,
  })
  assert.deepEqual(content.participants, [
    { label: "Alex", score: "42" },
    { label: "Morgan", score: null },
  ])
  assert.equal(content.location, "The Dice Cup")
  assert.equal(content.result, "Winner: Alex")
})

test("email-like participant names are excluded even when names are selected", () => {
  const content = buildShareCardContent(game, {
    ...play,
    participants: [
      { name: "alex@example.com", score: 42, is_winner: true },
      { name: "Morgan", score: null, is_winner: false },
    ],
  }, { ...defaults, includePlayerNames: true })
  assert.equal(content.participants[0].label, "Player 1")
  assert.equal(content.result, "Winner: Player 1")
})

test("cooperative and tied results are distinguished without guessing a loser", () => {
  const cooperative = buildShareCardContent(game, {
    ...play,
    participants: play.participants.map(player => ({ ...player, is_winner: true })),
  }, { ...defaults, includePlayerNames: true })
  const tied = buildShareCardContent(game, {
    ...play,
    participants: [
      { name: "Alex", score: 10, is_winner: true },
      { name: "Morgan", score: 10, is_winner: true },
      { name: "Sam", score: 8, is_winner: false },
    ],
  }, { ...defaults, includePlayerNames: true })
  const cooperativeContent = buildShareCardContent(
    { ...game, mechanics: ["Cooperative Game"] },
    { ...play, participants: play.participants.map(player => ({ ...player, is_winner: true })) },
    { ...defaults, includePlayerNames: true },
  )
  assert.equal(cooperative.result, "Shared win: Alex, Morgan")
  assert.equal(cooperativeContent.result, "Cooperative win")
  assert.equal(tied.result, "Tie: Alex, Morgan")
})

test("artwork loading failure renders the branded fallback PNG", async () => {
  const originalDocument = globalThis.document
  const originalImage = globalThis.Image
  const originalWindow = globalThis.window
  const drawnText = []
  const context = {
    beginPath() {},
    clip() {},
    drawImage() {},
    fill() {},
    fillRect() {},
    fillText(value) { drawnText.push(value) },
    measureText(value) { return { width: value.length * 18 } },
    restore() {},
    roundRect() {},
    save() {},
    set fillStyle(_value) {},
    set font(_value) {},
    set textAlign(_value) {},
  }
  const canvas = {
    getContext() { return context },
    toBlob(callback) { callback(new Blob(["png"], { type: "image/png" })) },
  }
  class MockImage {
    width = 390
    height = 112
    set src(value) {
      queueMicrotask(() => {
        if (value.startsWith("http")) this.onerror?.()
        else this.onload?.()
      })
    }
  }
  globalThis.document = { createElement: () => canvas }
  globalThis.Image = MockImage
  globalThis.window = { setTimeout, clearTimeout }
  try {
    const blob = await renderPlayShareCard(
      { ...game, image_url: "https://example.invalid/blocked.jpg" },
      play,
      defaults,
    )
    assert.equal(blob.type, "image/png")
    assert.ok(drawnText.includes("Artwork unavailable"))
  } finally {
    globalThis.document = originalDocument
    globalThis.Image = originalImage
    globalThis.window = originalWindow
  }
})

test("PNG generation failure is surfaced to the caller", async () => {
  const originalDocument = globalThis.document
  globalThis.document = { createElement: () => ({ getContext: () => null }) }
  try {
    await assert.rejects(
      renderPlayShareCard(game, play, defaults),
      /Image generation is unavailable/,
    )
  } finally {
    globalThis.document = originalDocument
  }
})

test("closing the native share sheet is treated as cancellation", () => {
  assert.equal(isShareCancellation(new DOMException("cancelled", "AbortError")), true)
  assert.equal(isShareCancellation(new Error("share failed")), false)
})
