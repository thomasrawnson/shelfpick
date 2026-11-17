import { expect, test, type Page } from "@playwright/test"
import fs from "node:fs"

import { logIn } from "./support"

// SP-YIR-01: Year in Review story, entry points and 1080x1920 share image.
// The API response is mocked so every slide has deterministic content; the
// real endpoint is covered by the backend tests.
const SHOTS = "../docs/screenshots/sp-yir-01"
const FREE_EMAIL = "local-free@shelfpick.app"

const FULL = {
  year: 2026, total_plays: 87, unique_games: 23, total_duration_minutes: 4310, duration_plays: 61,
  top_games: [
    { bgg_id: 1, name: "Clockwork Market", play_count: 14 },
    { bgg_id: 2, name: "Lantern Grove", play_count: 11 },
    { bgg_id: 3, name: "Harbour Council", play_count: 9 },
    { bgg_id: 4, name: "Tiny Orchard", play_count: 7 },
    { bgg_id: 5, name: "Night Courier", play_count: 5 },
  ],
  new_games_count: 9,
  new_games: [
    { bgg_id: 4, name: "Tiny Orchard", play_count: 7 },
    { bgg_id: 5, name: "Night Courier", play_count: 5 },
    { bgg_id: 6, name: "Salt and Sail", play_count: 3 },
  ],
  plays_by_month: [4, 5, 6, 7, 9, 8, 6, 5, 12, 11, 8, 6], busiest_month: 9,
  plays_by_weekday: [3, 4, 5, 6, 12, 40, 17], busiest_weekday: 6,
  longest_play: { bgg_id: 1, name: "Clockwork Market", duration_minutes: 195, played_on: "2026-03-14" },
  co_players: [
    { name: "Ann", play_count: 41 },
    { name: "Bob", play_count: 33 },
    { name: "Cleo", play_count: 12 },
  ],
}
const EMPTY = {
  ...FULL, total_plays: 0, unique_games: 0, total_duration_minutes: null, duration_plays: 0,
  top_games: [], new_games_count: 0, new_games: [], plays_by_month: Array(12).fill(0),
  busiest_month: null, plays_by_weekday: Array(7).fill(0), busiest_weekday: null,
  longest_play: null, co_players: [],
}

async function mockRecap(page: Page, body: unknown) {
  await page.route("**/insights/year-recap**", route => route.fulfill({ json: body }))
}

async function openStory(page: Page) {
  await logIn(page, FREE_EMAIL)
  await expect(page).toHaveURL(/\/picker/)
  await page.goto("/insights")
  await page.getByRole("tab", { name: "Recaps" }).or(page.getByRole("button", { name: "Recaps" })).first().click()
  await page.getByRole("button", { name: "View my year" }).click()
  await expect(page.getByRole("dialog", { name: "2026 Year in Review" })).toBeVisible()
}

const storyDialog = (page: Page) => page.getByRole("dialog", { name: /Year in Review$/ })
const nextButton = (page: Page) => storyDialog(page).getByRole("button", { name: "Next", exact: true })
const slide = (page: Page) => page.getByRole("group", { name: /^Slide \d+ of \d+/ })

test.use({ viewport: { width: 390, height: 844 } })
test.beforeEach(({ browserName }, testInfo) => { test.skip(browserName !== "webkit" || testInfo.project.name !== "iPhone 15") })

for (const scheme of ["light", "dark"] as const) {
  test(`${scheme}: step through every slide with Next and Previous`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: "reduce" })
    await mockRecap(page, FULL)
    await openStory(page)
    const titles = ["Your 2026 in games", "Your top games", "New to you", "Busiest month",
      "Busiest day", "Longest play", "Your play partners", "That's your year"]
    for (const [index, title] of titles.entries()) {
      await expect(slide(page)).toHaveAttribute("aria-label", new RegExp(`^Slide ${index + 1} of 8: ${title}\\.`))
      await page.screenshot({ path: `${SHOTS}/story-${scheme}-${index + 1}.png` })
      if (index < titles.length - 1) await nextButton(page).click()
    }
    await expect(page.getByRole("button", { name: "Share my year" })).toBeVisible()
    await storyDialog(page).getByRole("button", { name: "Previous", exact: true }).click()
    await expect(slide(page)).toHaveAttribute("aria-label", /^Slide 7 of 8/)
  })
}

test("swipe and tap move between slides", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" })
  await mockRecap(page, FULL)
  await openStory(page)
  const stage = page.locator(".year-story-stage")
  const box = (await stage.boundingBox())!
  const y = box.y + box.height / 2
  const drag = async (from: number, to: number) => {
    await page.mouse.move(from, y)
    await page.mouse.down()
    await page.mouse.move(to, y, { steps: 4 })
    await page.mouse.up()
  }
  await drag(box.x + 300, box.x + 100) // swipe left → next
  await expect(slide(page)).toHaveAttribute("aria-label", /^Slide 2 of 8/)
  await page.mouse.click(box.x + box.width - 30, y) // tap right → next
  await expect(slide(page)).toHaveAttribute("aria-label", /^Slide 3 of 8/)
  await page.mouse.click(box.x + 20, y) // tap left third → previous
  await expect(slide(page)).toHaveAttribute("aria-label", /^Slide 2 of 8/)
  await drag(box.x + 100, box.x + 300) // swipe right → previous
  await expect(slide(page)).toHaveAttribute("aria-label", /^Slide 1 of 8/)
})

test("slides auto-advance with motion allowed and Pause stops them", async ({ page }) => {
  await page.clock.install()
  await mockRecap(page, FULL)
  await openStory(page)
  await page.clock.fastForward(8500)
  await expect(slide(page)).toHaveAttribute("aria-label", /^Slide 2 of 8/)
  await page.getByRole("button", { name: "Pause" }).click()
  await page.clock.fastForward(30_000)
  await expect(slide(page)).toHaveAttribute("aria-label", /^Slide 2 of 8/)
})

test("reduced motion: no auto-advance, no Pause button, no animation", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" })
  await page.clock.install()
  await mockRecap(page, FULL)
  await openStory(page)
  await page.clock.fastForward(60_000)
  await expect(slide(page)).toHaveAttribute("aria-label", /^Slide 1 of 8/)
  await expect(page.getByRole("button", { name: "Pause" })).toHaveCount(0)
  const animations = await page.evaluate(() => ({
    slide: getComputedStyle(document.querySelector(".year-story-slide")!).animationName,
    fill: document.querySelectorAll(".year-story-progress i").length,
  }))
  expect(animations).toEqual({ slide: "none", fill: 0 })
})

test("empty year shows an explanation and no story", async ({ page }) => {
  await mockRecap(page, EMPTY)
  await logIn(page, FREE_EMAIL)
  await expect(page).toHaveURL(/\/picker/)
  await page.goto("/insights")
  await page.getByRole("tab", { name: "Recaps" }).or(page.getByRole("button", { name: "Recaps" })).first().click()
  await expect(page.getByText(/No plays recorded in 2026 yet/)).toBeVisible()
  await expect(page.getByRole("button", { name: "View my year" })).toHaveCount(0)
  await page.screenshot({ path: `${SHOTS}/entry-empty.png` })
})

test("share preview offers names off by default and a 9:16 image", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" })
  await mockRecap(page, FULL)
  await openStory(page)
  for (let step = 0; step < 7; step += 1) await nextButton(page).click()
  await page.getByRole("button", { name: "Share my year" }).click()
  const dialog = page.getByRole("dialog", { name: "Share 2026" })
  await expect(dialog).toBeVisible()
  const image = dialog.getByRole("img")
  await expect(image).toBeVisible()
  await expect(dialog.getByLabel("Player names")).not.toBeChecked()
  await expect(image).not.toHaveAttribute("alt", /Ann/)
  const size = await image.evaluate((element: HTMLImageElement) => [element.naturalWidth, element.naturalHeight])
  expect(size).toEqual([1080, 1920])
  await page.screenshot({ path: `${SHOTS}/share-preview.png` })
  await dialog.getByLabel("Player names").check()
  await expect(image).toHaveAttribute("alt", /Ann/)
})

test("Pick banner shows in December, opens the story and can be dismissed", async ({ page }) => {
  await page.clock.install({ time: new Date("2026-12-05T12:00:00Z") })
  await mockRecap(page, FULL)
  await logIn(page, FREE_EMAIL)
  await expect(page).toHaveURL(/\/picker/)
  const banner = page.getByRole("complementary", { name: "2026 Year in Review" })
  await expect(banner).toBeVisible()
  await page.screenshot({ path: `${SHOTS}/pick-banner.png` })
  await banner.getByRole("button", { name: "View" }).click()
  await expect(page.getByRole("dialog", { name: "2026 Year in Review" })).toBeVisible()
  await page.getByRole("button", { name: "Close" }).click()
  await page.goto("/picker")
  await page.getByRole("complementary", { name: "2026 Year in Review" }).getByRole("button", { name: "Dismiss" }).click()
  await page.reload()
  await expect(page.getByRole("complementary", { name: "2026 Year in Review" })).toHaveCount(0)
  await page.evaluate(() => localStorage.removeItem("shelfpick-year-recap-banner-dismissed-2026"))
})

test("Pick banner is hidden outside 1 December to 31 January", async ({ page }) => {
  await page.clock.install({ time: new Date("2026-06-05T12:00:00Z") })
  await mockRecap(page, FULL)
  await logIn(page, FREE_EMAIL)
  await expect(page).toHaveURL(/\/picker/)
  await expect(page.getByRole("complementary", { name: "2026 Year in Review" })).toHaveCount(0)
})

test("share PNG is 1080x1920, keeps the BGG logo unmodified, has no covers and omits names by default", async ({ page }) => {
  await page.goto("/login")
  const imageRequests: string[] = []
  page.on("request", request => { if (request.resourceType() === "image" && !request.url().startsWith("blob:")) imageRequests.push(new URL(request.url()).pathname) })
  const result = await page.evaluate(async recap => {
    const texts: string[] = []
    const original = CanvasRenderingContext2D.prototype.fillText
    CanvasRenderingContext2D.prototype.fillText = function (text: string, ...rest: [number, number]) {
      texts.push(text)
      return original.call(this, text, ...rest)
    }
    const card = await import(/* @vite-ignore */ "/src/year-recap-card.ts")
    const withoutNames = await card.renderYearRecapCard(recap, false)
    const hiddenTexts = texts.splice(0)
    const withNames = await card.renderYearRecapCard(recap, true)
    const shownTexts = texts.splice(0)
    CanvasRenderingContext2D.prototype.fillText = original

    const load = (src: string) => new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image(); img.onload = () => resolve(img); img.onerror = reject; img.src = src
    })
    const image = await load(URL.createObjectURL(withoutNames))
    const logo = await load("/branding/powered-by-bgg-rgb.svg")
    const width = 230, height = width / (342 / 76), right = 1008, top = 1764
    const x = right - width
    const actual = document.createElement("canvas"); actual.width = 1080; actual.height = 1920
    const actualCtx = actual.getContext("2d")!; actualCtx.drawImage(image, 0, 0)
    const bg = actualCtx.getImageData(x - 6, top + 2, 1, 1).data
    const expected = document.createElement("canvas"); expected.width = 1080; expected.height = 1920
    const expectedCtx = expected.getContext("2d")!
    expectedCtx.fillStyle = `rgb(${bg[0]},${bg[1]},${bg[2]})`; expectedCtx.fillRect(0, 0, 1080, 1920)
    expectedCtx.drawImage(logo, x, top, width, height)
    const w = Math.round(width), h = Math.round(height)
    const a = actualCtx.getImageData(x, top, w, h).data
    const e = expectedCtx.getImageData(x, top, w, h).data
    let diff = 0
    for (let i = 0; i < a.length; i += 1) diff += Math.abs(a[i] - e[i])
    const dataUrl = (blob: Blob) => new Promise<string>(resolve => {
      const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.readAsDataURL(blob)
    })
    return {
      size: [image.width, image.height], meanDiff: diff / a.length,
      hiddenTexts, shownTexts, png: await dataUrl(withoutNames), pngNames: await dataUrl(withNames),
    }
  }, FULL)
  expect(result.size).toEqual([1080, 1920])
  expect(result.meanDiff).toBeLessThan(2)
  expect(result.hiddenTexts.join("|")).not.toMatch(/Ann|Bob|Cleo/)
  expect(result.shownTexts.join("|")).toMatch(/Ann/)
  expect(result.hiddenTexts).toContain("boardgamegeek.com")
  // Only brand assets are ever drawn: no game cover or photo requests.
  expect(imageRequests.filter(path => !path.startsWith("/branding/"))).toEqual([])
  fs.writeFileSync(`${SHOTS}/export-year-recap.png`, Buffer.from(result.png.split(",")[1], "base64"))
  fs.writeFileSync(`${SHOTS}/export-year-recap-with-names.png`, Buffer.from(result.pngNames.split(",")[1], "base64"))
})
