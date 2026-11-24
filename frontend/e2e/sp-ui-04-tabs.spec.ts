import { expect, test, type Page } from "@playwright/test"

import { ANALYTICS_ANSWERED, API_ORIGIN, logIn } from "./support"
import { mockDiscover, mockShelf, mockStatsFeed } from "./ui-fixtures"

// SP-UI-04: every tab at 390x844, light and dark, with mocked data. SP_UI_04_STAGE picks the folder
// (before | checkpoint | after). Fixtures are mocked requests; the account and sign-in are real.
const STAGE = process.env.SP_UI_04_STAGE ?? "after"
const SHOTS = `../docs/screenshots/sp-ui-04/${STAGE}`
const AUTH_STATE = "test-results/.sp-ui-04-auth.json"
test.use({ storageState: AUTH_STATE, viewport: { width: 390, height: 844 } })

test.beforeAll(async ({ browser }, testInfo) => {
  if (testInfo.project.name !== "iPhone 15") return
  const context = await browser.newContext({ storageState: ANALYTICS_ANSWERED })
  const page = await context.newPage()
  await logIn(page, "local-free@shelfpick.app")
  await expect(page).toHaveURL(/\/tonight/)
  await context.storageState({ path: AUTH_STATE })
  await context.close()
})

test.beforeEach(({ browserName }, testInfo) => { test.skip(browserName !== "webkit" || testInfo.project.name !== "iPhone 15") })

async function settle(page: Page) {
  await page.waitForLoadState("networkidle")
  await page.waitForFunction(() => !document.querySelector('[aria-busy="true"]'))
  await page.waitForTimeout(350)
}

for (const scheme of ["light", "dark"] as const) {
  test(`Screenshots: all five tabs ${STAGE} (${scheme})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: "reduce" })
    await mockShelf(page)
    await mockDiscover(page)
    await mockStatsFeed(page, API_ORIGIN)
    await page.route(/\/auth\/me$/, async (route) => {
      const response = await route.fetch()
      return route.fulfill({ response, json: { ...(await response.json()), preferred_player_count: null, avatar_key: "gold", player_name: "Tom Wales" } })
    })
    await page.route(/\/picker\/options/, (route) => route.fulfill({ json: { categories: [], mechanics: [] } }))
    for (const tab of ["tonight", "shelf", "plays", "discover", "stats"]) {
      await page.goto(`/${tab}`)
      await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible()
      await settle(page)
      await page.screenshot({ path: `${SHOTS}/${tab}-${scheme}.png` })
    }
  })
}

for (const scheme of ["light", "dark"] as const) {
  test(`Screenshots: Discover overflow menu and undo ${STAGE} (${scheme})`, async ({ page }) => {
    test.skip(STAGE === "before", "The before build has no overflow menu.")
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: "reduce" })
    await mockShelf(page)
    await mockDiscover(page)
    await page.goto("/discover")
    await page.getByRole("button", { name: "More options for Clockwork Market" }).click()
    await expect(page.getByRole("menuitem", { name: "Hide" })).toBeVisible()
    await page.screenshot({ path: `${SHOTS}/discover-menu-${scheme}.png` })
    await page.getByRole("menuitem", { name: "Hide" }).click()
    await expect(page.getByRole("status").filter({ hasText: "Hidden Clockwork Market" })).toBeVisible()
    await page.screenshot({ path: `${SHOTS}/discover-undo-${scheme}.png` })
  })
}
