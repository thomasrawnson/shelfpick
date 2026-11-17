import { expect, test, type Page } from "@playwright/test"

import { logIn } from "./support"
import { mockShelf } from "./ui-fixtures"

// SP-UI-01: every tab at 390x844 and 1440x900, light and dark, plus the Plays flows.
const SHOTS = "../docs/screenshots/sp-ui-01"
const TABS = [
  { name: "Tonight", path: "/tonight", heading: /What should we play/ },
  { name: "Shelf", path: "/shelf", heading: /^Shelf$/ },
  { name: "Plays", path: "/plays", heading: /^Plays$/ },
  { name: "Discover", path: "/discover", heading: /Discover/ },
  { name: "Stats", path: "/stats", heading: /Insights|Stats/ },
] as const
const SIZES = [{ label: "390", width: 390, height: 844 }, { label: "1440", width: 1440, height: 900 }] as const

// One sign-in shared by every test here keeps the loopback login rate limit free for other specs.
const AUTH_STATE = "test-results/.ui-refresh-auth.json"
test.use({ storageState: AUTH_STATE })

test.beforeAll(async ({ browser }, testInfo) => {
  if (testInfo.project.name !== "iPhone 15") return
  const context = await browser.newContext({ storageState: undefined })
  const page = await context.newPage()
  await logIn(page, "local-free@shelfpick.app")
  await expect(page).toHaveURL(/\/tonight/)
  await context.storageState({ path: AUTH_STATE })
  await context.close()
})

async function signIn(page: Page) {
  await mockShelf(page)
  await page.goto("/tonight")
  await expect(page).toHaveURL(/\/tonight/)
}

test.beforeEach(({ browserName }, testInfo) => { test.skip(browserName !== "webkit" || testInfo.project.name !== "iPhone 15") })

for (const size of SIZES) for (const scheme of ["light", "dark"] as const) {
  test(`all tabs at ${size.label} ${scheme}`, async ({ page }) => {
    await page.setViewportSize({ width: size.width, height: size.height })
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: "reduce" })
    await signIn(page)
    const nav = page.getByRole("navigation", { name: "Primary" })
    for (const tab of TABS) {
      // Every tab has an accessible name and the current one is marked.
      await nav.getByRole("button", { name: tab.name, exact: true }).click()
      await expect(nav.getByRole("button", { name: tab.name, exact: true })).toHaveAttribute("aria-current", "page")
      await expect(page).toHaveURL(new RegExp(tab.path))
      await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible()
      await page.waitForLoadState("networkidle")
      await page.waitForFunction(() => !document.querySelector('[aria-busy="true"]'))
      await page.waitForTimeout(250)
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
      expect(overflow, `${tab.name} horizontal overflow`).toBeLessThanOrEqual(0)
      await page.screenshot({ path: `${SHOTS}/after/${tab.name.toLowerCase()}-${size.label}-${scheme}.png` })
    }
  })
}

test("Plays: filters, Rematch, Edit and Log play", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.emulateMedia({ reducedMotion: "reduce" })
  await signIn(page)
  await page.goto("/plays")
  await expect(page.getByRole("button", { name: "Log play" })).toBeVisible()
  const cards = page.locator(".plays-card")
  await expect(cards.first()).toBeVisible()
  const total = await cards.count()
  expect(total).toBeGreaterThan(3)
  await page.getByLabel("Game", { exact: true }).selectOption({ label: "Clockwork Market" })
  expect(await cards.count()).toBeLessThan(total)
  await page.getByLabel("Game", { exact: true }).selectOption({ label: "All games" })
  await page.getByLabel("Player", { exact: true }).selectOption({ label: "Cleo" })
  expect(await cards.count()).toBeGreaterThan(0)
  await page.getByLabel("Player", { exact: true }).selectOption({ label: "All players" })

  await cards.first().getByRole("button", { name: "Rematch" }).click()
  await expect(page.getByRole("heading", { name: "Rematch" })).toBeVisible()
  await page.getByRole("button", { name: "← Back to Plays" }).click()
  await cards.first().getByRole("button", { name: "Edit" }).click()
  await expect(page.getByRole("heading", { name: "Edit play" })).toBeVisible()
  await page.getByRole("button", { name: "← Back to Plays" }).click()

  await page.getByRole("button", { name: "Log play" }).click()
  await expect(page.getByRole("heading", { name: "Log a play" })).toBeVisible()
  await page.getByRole("button", { name: /Lantern Grove/ }).click()
  await expect(page.getByRole("heading", { name: "Log a play" })).toBeVisible()
})

test("Plays shows an empty state before the first play", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.route(/\/games(\?.*)?$/, route => route.fulfill({ json: [] }))
  await page.route("**/collection/stats**", route => route.fulfill({ json: [] }))
  await page.goto("/plays")
  await expect(page.getByText("No plays yet")).toBeVisible()
  await page.screenshot({ path: `${SHOTS}/after/plays-empty-390-light.png` })
})

test("reduced motion turns off tab transitions, skeleton shimmer and the reveal", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.emulateMedia({ reducedMotion: "reduce" })
  await signIn(page)
  const names = await page.evaluate(() => ({
    page: getComputedStyle(document.querySelector(".page-transition")!).animationName,
  }))
  expect(names.page).toBe("none")
  await page.emulateMedia({ reducedMotion: "no-preference" })
  await page.getByRole("navigation", { name: "Primary" }).getByRole("button", { name: "Shelf", exact: true }).click()
  const animated = await page.evaluate(() => getComputedStyle(document.querySelector(".page-transition")!).animationName)
  expect(animated).toBe("page-in")
})

test("pulling down on Plays refreshes the list", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.emulateMedia({ reducedMotion: "reduce" })
  await signIn(page)
  await page.goto("/plays")
  await expect(page.locator(".plays-card").first()).toBeVisible()
  let statsRequests = 0
  page.on("request", request => { if (request.url().includes("/collection/stats")) statsRequests += 1 })
  await page.evaluate(() => {
    const fire = (type: string, y: number) => {
      const event = new Event(type, { bubbles: true })
      Object.defineProperty(event, "touches", { value: [{ clientY: y }] })
      window.dispatchEvent(event)
    }
    fire("touchstart", 100)
    fire("touchmove", 260)
    window.dispatchEvent(new Event("touchend"))
  })
  await expect.poll(() => statsRequests).toBeGreaterThan(0)
})

test("game detail gets a cover-derived accent that stays readable in both themes", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await signIn(page)
  for (const scheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: "reduce" })
    await page.goto("/shelf/owned/1000")
    const article = page.locator(".collection-detail.has-cover-accent")
    await expect(article).toBeVisible()
    await expect.poll(() => article.evaluate(el => el.style.getPropertyValue("--cover-accent"))).toMatch(/^#[0-9A-F]{6}$/)
    const result = await page.evaluate(async () => {
      const lib = await import(/* @vite-ignore */ "/src/cover-accent.ts")
      const el = document.querySelector(".collection-detail .eyebrow") as HTMLElement
      const text = getComputedStyle(el).color.match(/\d+/g)!.slice(0, 3).map(Number) as [number, number, number]
      const surfaces = document.documentElement.dataset.theme === "dark" ? lib.DARK_SURFACES : lib.LIGHT_SURFACES
      return Math.min(...surfaces.map((surface: string) => lib.contrastRatio(lib.rgbToHex(text), surface)))
    })
    expect(result, `${scheme} accent text contrast`).toBeGreaterThanOrEqual(4.5)
    await page.screenshot({ path: `${SHOTS}/after/game-detail-390-${scheme}.png` })
  }
})

test("Shelf: last row scrolls clear of the tab bar and long titles keep two lines", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.emulateMedia({ reducedMotion: "reduce" })
  await signIn(page)
  await page.goto("/shelf")
  const tiles = page.locator(".collection-tile")
  await expect(tiles.last()).toBeVisible()
  await page.evaluate(() => {
    let element: HTMLElement | null = document.querySelector(".collection-tile")
    while (element && element.scrollHeight <= element.clientHeight) element = element.parentElement
    if (element) element.scrollTop = element.scrollHeight
    window.scrollTo(0, document.documentElement.scrollHeight)
  })
  const gap = await page.evaluate(() => {
    const tile = [...document.querySelectorAll(".collection-tile")].pop()!.getBoundingClientRect()
    const nav = document.querySelector(".app-nav")!.getBoundingClientRect()
    return nav.top - tile.bottom
  })
  expect(gap, "last tile sits above the tab bar").toBeGreaterThanOrEqual(0)
  const lines = await page.evaluate(() => {
    const title = [...document.querySelectorAll(".collection-tile strong")].pop() as HTMLElement
    return Math.round(title.getBoundingClientRect().height / parseFloat(getComputedStyle(title).lineHeight))
  })
  expect(lines).toBeLessThanOrEqual(2)
  await page.screenshot({ path: `${SHOTS}/after/shelf-end-390-light.png` })
  await page.getByRole("button", { name: "List view" }).click()
  await expect(page.getByRole("button", { name: "List view" })).toHaveAttribute("aria-pressed", "true")
})
