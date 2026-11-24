import { expect, test, type Page } from "@playwright/test"

import { ANALYTICS_ANSWERED, API_ORIGIN, logIn } from "./support"
import { mockDiscover, mockGameDetail, mockShelf, mockStatsFeed } from "./ui-fixtures"

// App Store product-page screenshots (iPhone 6.3" slot, 1206x2622). Run on demand:
//   APP_STORE_SHOTS=1 npx playwright test e2e/app-store-screenshots.spec.ts --project="iPhone 15"
// Browser captures of the web build against the real local backend sign-in, with mocked synthetic data
// (generated SVG covers, fictional games; no BoardGameGeek artwork). They are NOT Simulator or device captures.
const OUT = process.env.APP_STORE_SHOTS_DIR ?? "../docs/screenshots/app-store-1.2.1"
const AUTH_STATE = "test-results/.app-store-auth.json"
test.use({ storageState: AUTH_STATE, viewport: { width: 402, height: 874 }, deviceScaleFactor: 3 })

test.beforeAll(async ({ browser }, testInfo) => {
  if (testInfo.project.name !== "iPhone 15") return
  const context = await browser.newContext({ storageState: ANALYTICS_ANSWERED })
  const page = await context.newPage()
  await logIn(page, "local-pro@shelfpick.app")
  await expect(page).toHaveURL(/\/tonight/)
  await context.storageState({ path: AUTH_STATE })
  await context.close()
})

test.beforeEach(({ browserName }, testInfo) => {
  test.skip(process.env.APP_STORE_SHOTS !== "1", "On-demand capture: set APP_STORE_SHOTS=1")
  test.skip(browserName !== "webkit" || testInfo.project.name !== "iPhone 15")
})

async function settle(page: Page) {
  await page.waitForLoadState("networkidle")
  await page.waitForFunction(() => !document.querySelector('[aria-busy="true"]'))
  await page.waitForTimeout(400)
}

async function mockAccount(page: Page) {
  await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" })
  await mockShelf(page)
  await mockDiscover(page)
  await mockStatsFeed(page, API_ORIGIN)
  await page.route(/\/picker\/options/, (route) => route.fulfill({ json: { categories: [], mechanics: [] } }))
  await page.route(/\/auth\/me$/, async (route) => {
    const response = await route.fetch()
    return route.fulfill({ response, json: { ...(await response.json()), preferred_player_count: null, avatar_key: "forest", player_name: "Tom Wales" } })
  })
}

test("01 Tonight", async ({ page }) => {
  await mockAccount(page)
  await page.goto("/tonight")
  await expect(page.getByRole("heading", { name: "What should we play?" })).toBeVisible()
  await page.getByRole("button", { name: "3 players" }).click()
  await page.getByRole("button", { name: "Medium" }).click()
  await settle(page)
  await page.screenshot({ path: `${OUT}/01-tonight.png` })
})

test("02 Shelf", async ({ page }) => {
  await mockAccount(page)
  await page.goto("/shelf")
  await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible()
  await settle(page)
  await page.screenshot({ path: `${OUT}/02-shelf.png` })
})

test("03 Game detail", async ({ page }) => {
  await mockAccount(page)
  await mockGameDetail(page)
  await page.goto("/shelf")
  await page.getByRole("button", { name: /^Clockwork Market/ }).click()
  await expect(page.getByRole("heading", { level: 1, name: "Clockwork Market" })).toBeVisible()
  await settle(page)
  await page.screenshot({ path: `${OUT}/03-game-detail.png` })
})

test("04 Plays", async ({ page }) => {
  await mockAccount(page)
  await page.goto("/plays")
  await expect(page.locator(".plays-card").first()).toBeVisible()
  await settle(page)
  await page.screenshot({ path: `${OUT}/04-plays.png` })
})

test("05 Stats", async ({ page }) => {
  await mockAccount(page)
  await page.goto("/stats")
  await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible()
  await settle(page)
  await page.screenshot({ path: `${OUT}/05-stats.png` })
})

test("06 Discover", async ({ page }) => {
  await mockAccount(page)
  await page.goto("/discover")
  await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible()
  await settle(page)
  await page.screenshot({ path: `${OUT}/06-discover.png` })
})
