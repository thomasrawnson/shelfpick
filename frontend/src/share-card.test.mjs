import assert from "node:assert/strict"
import { after, before, test } from "node:test"
import { createServer } from "vite"

let server
let buildShareCardContent
let renderPlayShareCard
let isShareCancellation
let containImageRect
let redactEmailAddresses
let defaults

before(async () => {
  server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: "custom" })
  const module = await server.ssrLoadModule("/src/share-card.ts")
  buildShareCardContent = module.buildShareCardContent
  renderPlayShareCard = module.renderPlayShareCard
  isShareCancellation = module.isShareCancellation
  containImageRect = module.containImageRect
  redactEmailAddresses = module.redactEmailAddresses
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

test("location email addresses are redacted before preview or export content is built", () => {
  const locations = [
    ["alex@example.com", "[email hidden]"],
    ["The hall — alex@example.com after six", "The hall — [email hidden] after six"],
    ["alex@example.com and host@example.org", "[email hidden] and [email hidden]"],
    ["Contact Alex.Example@Example.COM", "Contact [email hidden]"],
  ]

  for (const [location, expected] of locations) {
    const content = buildShareCardContent(game, { ...play, location }, {
      ...defaults,
      includeLocation: true,
    })
    assert.equal(content.location, expected)
    assert.equal(redactEmailAddresses(location), expected)
  }
})

test("every privacy combination remains independent and disabled options reveal nothing", () => {
  for (const includePlayerNames of [false, true]) {
    for (const includeScores of [false, true]) {
      for (const includeLocation of [false, true]) {
        const content = buildShareCardContent(game, {
          ...play,
          location: "host@example.com",
        }, { includePlayerNames, includeScores, includeLocation })
        assert.equal(content.participants[0].label, includePlayerNames ? "Alex" : "Player 1")
        assert.equal(content.participants[0].score, includeScores ? "42" : null)
        assert.equal(content.location, includeLocation ? "[email hidden]" : null)
      }
    }
  }
})

test("recorded duration is shown while missing and zero durations remain absent", () => {
  assert.equal(buildShareCardContent(game, play, defaults).duration, "75 min")
  assert.equal(buildShareCardContent(game, { ...play, duration_minutes: null }, defaults).duration, null)
  assert.equal(buildShareCardContent(game, { ...play, duration_minutes: 0 }, defaults).duration, null)
})

test("portrait, landscape and square artwork fit completely inside the cover stage", () => {
  const bounds = { x: 98, y: 92, width: 1004, height: 582 }
  for (const [width, height] of [[600, 900], [1200, 600], [800, 800]]) {
    const target = containImageRect(width, height, bounds)
    assert.ok(target.x >= bounds.x)
    assert.ok(target.y >= bounds.y)
    assert.ok(target.x + target.width <= bounds.x + bounds.width + Number.EPSILON)
    assert.ok(target.y + target.height <= bounds.y + bounds.height + Number.EPSILON)
    assert.ok(Math.abs(target.width / target.height - width / height) < 0.000001)
  }
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
    assert.ok(drawnText.includes("Cover not available"))
  } finally {
    globalThis.document = originalDocument
    globalThis.Image = originalImage
    globalThis.window = originalWindow
  }
})

test("export rendering uses redacted location content and bounds a very long title", async () => {
  const originalDocument = globalThis.document
  const originalImage = globalThis.Image
  const originalWindow = globalThis.window
  const drawnText = []
  const context = {
    beginPath() {},
    drawImage() {},
    fill() {},
    fillRect() {},
    fillText(value, _x, y) { drawnText.push({ value, y }) },
    measureText(value) { return { width: value.length * 22 } },
    roundRect() {},
    set fillStyle(_value) {},
    set font(_value) {},
    set textAlign(_value) {},
  }
  const canvas = {
    getContext() { return context },
    toBlob(callback) { callback(new Blob(["png"], { type: "image/png" })) },
  }
  class MockImage {
    width = 300
    height = 100
    set src(_value) { queueMicrotask(() => this.onload?.()) }
  }
  globalThis.document = { createElement: () => canvas }
  globalThis.Image = MockImage
  globalThis.window = { setTimeout, clearTimeout }
  try {
    await renderPlayShareCard(
      {
        ...game,
        name: "The Extraordinary Expedition Through the Unreasonably Long Kingdom Beyond Every Known Horizon and Then Some",
        image_url: null,
      },
      { ...play, location: "Hall host@example.com" },
      { ...defaults, includeLocation: true, includePlayerNames: true, includeScores: true },
    )
    const values = drawnText.map(item => item.value)
    assert.ok(values.includes("At Hall [email hidden]"))
    assert.equal(values.some(value => value.includes("@")), false)
    assert.ok(values.some(value => value.endsWith("…")))
    assert.ok(drawnText.every(item => item.y === undefined || item.y < 1500))
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
