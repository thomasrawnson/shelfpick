import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { after, before, test } from "node:test"
import { createServer } from "vite"

let server
let renderMonthlyRecapCard
let monthlyRecapAltText
let monthlyRecapFileName
let monthInTimezone
let shiftMonth

before(async () => {
  server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: "custom" })
  const renderer = await server.ssrLoadModule("/src/monthly-recap-card.ts")
  const monthHelpers = await server.ssrLoadModule("/src/monthly-recap-month.ts")
  renderMonthlyRecapCard = renderer.renderMonthlyRecapCard
  monthlyRecapAltText = renderer.monthlyRecapAltText
  monthlyRecapFileName = renderer.monthlyRecapFileName
  monthInTimezone = monthHelpers.monthInTimezone
  shiftMonth = monthHelpers.shiftMonth
})

after(async () => { await server?.close() })

const recap = {
  month: "2026-10",
  month_label: "October 2026",
  total_plays: 6,
  unique_games: 4,
  total_duration_minutes: 275,
  duration_plays: 4,
  most_played: { bgg_id: 1, name: "A Very Long Game Name That Must Stay Inside Its Editorial Tile", play_count: 3, image_url: null },
  collage_games: [
    { bgg_id: 1, name: "Portrait", play_count: 3, image_url: "/portrait.svg" },
    { bgg_id: 2, name: "Landscape", play_count: 1, image_url: "/landscape.svg" },
    { bgg_id: 3, name: "Square", play_count: 1, image_url: "/square.svg" },
    { bgg_id: 4, name: "Missing", play_count: 1, image_url: "https://invalid.example/missing.jpg" },
  ],
}

test("month selection uses the local calendar and never drifts at UTC boundaries", () => {
  const instant = new Date("2026-11-01T00:30:00Z")
  assert.equal(monthInTimezone(instant, "America/Los_Angeles"), "2026-10")
  assert.equal(monthInTimezone(instant, "Europe/London"), "2026-11")
  assert.equal(shiftMonth("2026-01", -1), "2025-12")
  assert.equal(shiftMonth("2026-12", 1), "2027-01")
})

test("recap copy distinguishes partial and missing duration without private data", () => {
  assert.match(monthlyRecapAltText(recap), /4h 35m recorded/)
  assert.match(monthlyRecapAltText(recap), /Most played:/)
  assert.equal(monthlyRecapAltText({ ...recap, total_duration_minutes: null }), "October 2026 ShelfPick recap: 6 plays, 4 games, recorded play time unavailable. Most played: A Very Long Game Name That Must Stay Inside Its Editorial Tile, 3 plays.")
  assert.equal(monthlyRecapFileName("2026-10"), "shelfpick-2026-10-recap.png")
  assert.equal(JSON.stringify(recap).includes("participant"), false)
  assert.equal(JSON.stringify(recap).includes("location"), false)
})

test("one-game, missing-artwork and long-title recaps render a 1200x1500 PNG", async () => {
  const originalDocument = globalThis.document
  const originalImage = globalThis.Image
  const originalWindow = globalThis.window
  const drawn = []
  const context = {
    beginPath() {}, drawImage() {}, fill() {}, fillRect() {}, roundRect() {},
    fillText(value, x, y) { drawn.push({ value, x, y }) },
    measureText(value) { return { width: value.length * 18 } },
    set fillStyle(_value) {}, set font(_value) {}, set textAlign(_value) {},
  }
  const canvas = {
    width: 0,
    height: 0,
    getContext() { return context },
    toBlob(callback) { callback(new Blob([`${this.width}x${this.height}`], { type: "image/png" })) },
  }
  class MockImage {
    width = 400
    height = 700
    set src(value) { queueMicrotask(() => value.startsWith("http") ? this.onerror?.() : this.onload?.()) }
  }
  globalThis.document = { createElement: () => canvas }
  globalThis.Image = MockImage
  globalThis.window = { setTimeout, clearTimeout }
  try {
    const blob = await renderMonthlyRecapCard({
      ...recap,
      total_plays: 1,
      unique_games: 1,
      total_duration_minutes: null,
      duration_plays: 0,
      collage_games: [recap.collage_games[3]],
    })
    assert.equal(await blob.text(), "1200x1500")
    assert.ok(drawn.some(item => item.value === "Cover not available"))
    assert.ok(drawn.some(item => item.value.endsWith("…")))
    assert.ok(drawn.every(item => item.y < 1500))
  } finally {
    globalThis.document = originalDocument
    globalThis.Image = originalImage
    globalThis.window = originalWindow
  }
})

test("Recaps UI preserves retry, empty state, sharing and native-share fallback behavior", async () => {
  const panel = await readFile(new URL("./components/insights/MonthlyRecapPanel.tsx", import.meta.url), "utf8")
  const dialog = await readFile(new URL("./components/insights/MonthlyRecapShareDialog.tsx", import.meta.url), "utf8")
  assert.match(panel, /Couldn't load this monthly recap/)
  assert.match(panel, /Only saved play history appears here/)
  assert.match(panel, /Share this month/)
  assert.match(panel, /disabled=\{month >= currentMonth\}/)
  assert.match(dialog, /navigator\.canShare/)
  assert.match(dialog, /Download image/)
  assert.match(dialog, /Sharing cancelled/)
  assert.match(dialog, /Player names, scores and locations are never included/)
})
