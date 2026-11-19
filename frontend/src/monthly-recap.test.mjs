import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { after, before, test } from "node:test"
import { createServer } from "vite"

let server
let renderMonthlyRecapCard
let collageRects
let monthlyPlayCountLabel
let coverCropRect
let monthlyRecapAltText
let monthlyRecapFileName
let monthlyHighlight
let monthInTimezone
let shiftMonth

before(async () => {
  server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: "custom" })
  const renderer = await server.ssrLoadModule("/src/monthly-recap-card.ts")
  const monthHelpers = await server.ssrLoadModule("/src/monthly-recap-month.ts")
  renderMonthlyRecapCard = renderer.renderMonthlyRecapCard
  collageRects = renderer.collageRects
  monthlyPlayCountLabel = renderer.monthlyPlayCountLabel
  coverCropRect = (await server.ssrLoadModule("/src/share-card.ts")).coverCropRect
  monthlyRecapAltText = renderer.monthlyRecapAltText
  monthlyRecapFileName = renderer.monthlyRecapFileName
  monthlyHighlight = renderer.monthlyHighlight
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

test("a month of single plays shows variety instead of a one-play favourite", () => {
  const once = { ...recap, total_plays: 3, unique_games: 3, most_played: { ...recap.most_played, name: "Clockwork Market", play_count: 1 } }
  assert.deepEqual(monthlyHighlight(once), { label: "Variety", value: "3 different games" })
  assert.doesNotMatch(monthlyRecapAltText(once), /Most played/)
  assert.match(monthlyRecapAltText(once), /3 different games, one play each/)
  assert.deepEqual(monthlyHighlight({ ...once, total_plays: 1, unique_games: 1 }), { label: "Played", value: "Clockwork Market" })
  assert.equal(monthlyHighlight(recap).label, "Most played")
  assert.equal(monthlyHighlight({ ...recap, most_played: null }), null)
})

test("one-game, rights-safe artwork and long-title recaps render a 1200x1500 PNG", async () => {
  const originalDocument = globalThis.document
  const originalImage = globalThis.Image
  const originalWindow = globalThis.window
  const drawn = []
  const context = {
    save() {}, restore() {}, clip() {}, createLinearGradient() { return { addColorStop() {} } },
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
    assert.ok(drawn.some(item => item.value === "1 play"))
    assert.equal(drawn.some(item => item.value === "Cover not available"), false)
    assert.ok(drawn.some(item => item.value.endsWith("…")))
    assert.ok(drawn.every(item => item.y < 1500))
  } finally {
    globalThis.document = originalDocument
    globalThis.Image = originalImage
    globalThis.window = originalWindow
  }
})

test("recap covers are loaded through the API proxy only in explicitly permitted export mode", async () => {
  const originalDocument = globalThis.document
  const originalImage = globalThis.Image
  const originalWindow = globalThis.window
  const originalFetch = globalThis.fetch
  const originalStorage = globalThis.localStorage
  const requested = []
  const fetched = []
  const drawn = []
  const context = {
    save() {}, restore() {}, clip() {}, createLinearGradient() { return { addColorStop() {} } },
    beginPath() {}, drawImage(image) { drawn.push(image.src) }, fill() {}, fillRect() {}, fillText() {}, roundRect() {},
    measureText(value) { return { width: value.length * 18 } },
    set fillStyle(_value) {}, set font(_value) {}, set textAlign(_value) {},
  }
  const canvas = {
    width: 0, height: 0,
    getContext() { return context },
    toBlob(callback) { callback(new Blob([`${this.width}x${this.height}`], { type: "image/png" })) },
  }
  class MockImage {
    width = 400
    height = 700
    set src(value) { this._src = value; requested.push(value); queueMicrotask(() => this.onload?.()) }
    get src() { return this._src }
  }
  globalThis.document = { createElement: () => canvas }
  globalThis.Image = MockImage
  globalThis.window = { setTimeout, clearTimeout }
  globalThis.localStorage = { getItem: () => "token" }
  // The fourth game's cover cannot be served; the others can.
  globalThis.fetch = async url => {
    fetched.push(String(url))
    return String(url).includes("missing")
      ? new Response("{}", { status: 502 })
      : new Response(new Uint8Array([1, 2, 3]), { status: 200, headers: { "content-type": "image/jpeg" } })
  }
  try {
    const fallbackBlob = await renderMonthlyRecapCard(recap)
    assert.equal(await fallbackBlob.text(), "1200x1500")
    assert.deepEqual(fetched, [])

    drawn.length = 0
    await renderMonthlyRecapCard(recap, true)
    assert.equal(fetched.length, 4)
    assert.ok(fetched.every(url => url.includes("/export-cover?url=")))
    assert.ok(fetched.some(url => url.includes(encodeURIComponent("/portrait.svg"))))
    // Remote cover URLs are never given to the canvas image directly.
    assert.equal(requested.some(value => value.includes("portrait.svg")), false)
    assert.equal(drawn.filter(src => src.startsWith("blob:")).length, 3)
  } finally {
    globalThis.document = originalDocument
    globalThis.Image = originalImage
    globalThis.window = originalWindow
    globalThis.fetch = originalFetch
    globalThis.localStorage = originalStorage
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
  assert.match(dialog, /resolveExportCoverArtworkPermission/)
})

test("recap card carries the unmodified Powered by BGG logo", async () => {
  const originalDocument = globalThis.document
  const originalImage = globalThis.Image
  const originalWindow = globalThis.window
  const drawn = []
  const texts = []
  const context = {
    save() {}, restore() {}, clip() {}, createLinearGradient() { return { addColorStop() {} } },
    beginPath() {}, fill() {}, fillRect() {}, roundRect() {},
    drawImage(image, x, y, w, h) { drawn.push({ src: image.src, x, y, w, h }) },
    fillText(value, x, y) { texts.push({ value, x, y }) },
    measureText(value) { return { width: value.length * 18 } },
    set fillStyle(_value) {}, set font(_value) {}, set textAlign(_value) {},
  }
  const canvas = {
    getContext() { return context },
    toBlob(callback) { callback(new Blob(["png"], { type: "image/png" })) },
  }
  class MockImage {
    width = 342
    height = 76
    set src(value) { this._src = value; queueMicrotask(() => this.onload?.()) }
    get src() { return this._src }
  }
  globalThis.document = { createElement: () => canvas }
  globalThis.Image = MockImage
  globalThis.window = { setTimeout, clearTimeout }
  try {
    await renderMonthlyRecapCard(recap)
    const logo = drawn.find(item => item.src === "/branding/powered-by-bgg-rgb.svg")
    assert.ok(logo)
    assert.ok(Math.abs(logo.w / logo.h - 342 / 76) < 0.01)
    assert.ok(texts.some(item => item.value === "boardgamegeek.com" && item.y > logo.y + logo.h))
    assert.equal(texts.some(item => item.value === "Game data from BoardGameGeek"), false)
    assert.ok(drawn.some(item => item.src === "/branding/shelfpick-logo-light.svg"))
  } finally {
    globalThis.document = originalDocument
    globalThis.Image = originalImage
    globalThis.window = originalWindow
  }
})

test("collage tiles touch, fill the collage exactly and never overlap", () => {
  for (const count of [1, 2, 3, 4]) {
    const rects = collageRects(count)
    assert.equal(rects.length, count)
    const left = Math.min(...rects.map(rect => rect.x))
    const top = Math.min(...rects.map(rect => rect.y))
    const right = Math.max(...rects.map(rect => rect.x + rect.width))
    const bottom = Math.max(...rects.map(rect => rect.y + rect.height))
    assert.deepEqual([left, top, right - left, bottom - top], [72, 244, 1056, 690])
    const area = rects.reduce((total, rect) => total + rect.width * rect.height, 0)
    assert.equal(area, 1056 * 690)
    for (const [index, a] of rects.entries()) {
      for (const b of rects.slice(index + 1)) {
        const overlapX = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)
        const overlapY = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y)
        assert.ok(overlapX <= 0 || overlapY <= 0, "tiles must not overlap")
      }
    }
  }
})

test("cover artwork is cropped to fill its tile, centred", () => {
  const tile = { x: 0, y: 0, width: 528, height: 345 }
  const portrait = coverCropRect(400, 800, tile)
  assert.equal(portrait.width, 400)
  assert.ok(Math.abs(portrait.height - 400 * 345 / 528) < 1e-9)
  assert.ok(Math.abs(portrait.y - (800 - portrait.height) / 2) < 1e-9)
  const landscape = coverCropRect(1200, 300, tile)
  assert.equal(landscape.height, 300)
  assert.ok(Math.abs(landscape.width / landscape.height - 528 / 345) < 1e-9)
  assert.ok(Math.abs(landscape.x - (1200 - landscape.width) / 2) < 1e-9)
  for (const crop of [portrait, landscape]) assert.ok(Math.abs(crop.width / crop.height - tile.width / tile.height) < 1e-9)
})

test("every game tile shows its name and monthly play count, with or without artwork", async () => {
  const originalDocument = globalThis.document
  const originalImage = globalThis.Image
  const originalWindow = globalThis.window
  const originalFetch = globalThis.fetch
  const originalStorage = globalThis.localStorage
  const texts = []
  const images = []
  const context = {
    save() {}, restore() {}, clip() {}, createLinearGradient() { return { addColorStop() {} } },
    beginPath() {}, fill() {}, fillRect() {}, roundRect() {},
    drawImage(...args) { images.push(args) },
    fillText(value) { texts.push(value) },
    measureText(value) { return { width: value.length * 12 } },
    set fillStyle(_value) {}, set font(_value) {}, set textAlign(_value) {},
  }
  const canvas = { width: 0, height: 0, getContext() { return context }, toBlob(callback) { callback(new Blob(["png"], { type: "image/png" })) } }
  class MockImage {
    width = 600
    height = 400
    set src(_value) { queueMicrotask(() => this.onload?.()) }
  }
  globalThis.document = { createElement: () => canvas }
  globalThis.Image = MockImage
  globalThis.window = { setTimeout, clearTimeout }
  globalThis.localStorage = { getItem: () => null }
  globalThis.fetch = async () => new Response(new Uint8Array([1]), { status: 200, headers: { "content-type": "image/jpeg" } })
  try {
    const games = [
      { bgg_id: 1, name: "Wingspan", play_count: 2, image_url: "https://cf.geekdo-images.com/a.jpg" },
      { bgg_id: 2, name: "Azul", play_count: 1, image_url: null },
    ]
    const twoGames = { ...recap, collage_games: games }
    await renderMonthlyRecapCard(twoGames, true)
    assert.ok(texts.includes("Wingspan") && texts.includes("2 plays"))
    assert.ok(texts.includes("Azul") && texts.includes("1 play"))
    // Only the game with artwork draws an image into the collage, using a cropped 9-argument drawImage.
    assert.equal(images.filter(args => args.length === 9).length, 1)
    // Initials fill the tile that has no artwork.
    assert.ok(texts.includes("A"))

    texts.length = 0
    images.length = 0
    await renderMonthlyRecapCard(twoGames, false)
    assert.ok(texts.includes("Wingspan") && texts.includes("2 plays"))
    assert.equal(images.filter(args => args.length === 9).length, 0)
    assert.ok(texts.includes("W") && texts.includes("A"))
    // Month stats and the variety/most-played line remain in the stat band; no player data.
    for (const expected of ["6", "4", "PLAYS", "GAMES", "MOST PLAYED"]) assert.ok(texts.includes(expected), expected)
    assert.equal(monthlyPlayCountLabel(1), "1 play")
    assert.equal(monthlyPlayCountLabel(3), "3 plays")
  } finally {
    globalThis.document = originalDocument
    globalThis.Image = originalImage
    globalThis.window = originalWindow
    globalThis.fetch = originalFetch
    globalThis.localStorage = originalStorage
  }
})
