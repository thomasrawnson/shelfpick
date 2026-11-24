import { expect, test, type Page } from "@playwright/test"

import { logIn, ANALYTICS_ANSWERED } from "./support"
import { avatarCollisions, mockDiscover, mockShelf } from "./ui-fixtures"

// SP-UI-02 shared layout: the avatar never meets a control, and each tab's
// last item scrolls fully above the floating tab bar. 390x844, light and dark.
const SHOTS = "../docs/screenshots/sp-ui-02/after"
const AUTH_STATE = "test-results/.ui-layout-auth.json"
test.use({ storageState: AUTH_STATE })

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

const TABS = [
  { name: "Tonight", path: "/tonight", last: ".tonight-recent li:last-child" },
  { name: "Shelf", path: "/shelf", last: ".collection-tile, .collection-list > *" },
  { name: "Plays", path: "/plays", last: ".plays-card:last-of-type" },
  { name: "Discover", path: "/discover", last: ".discover-card:last-of-type, .discover-list > *:last-child" },
  { name: "Stats", path: "/stats", last: ".screen > *:last-child" },
] as const

async function settle(page: Page) {
  await page.waitForLoadState("networkidle")
  await page.waitForFunction(() => !document.querySelector('[aria-busy="true"]'))
  await page.waitForTimeout(250)
}

for (const scheme of ["light", "dark"] as const) {
  test(`avatar clears every control and the last item clears the tab bar (${scheme})`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: "reduce" })
    await mockShelf(page)
    await mockDiscover(page)
    await page.goto("/tonight")
    const nav = page.getByRole("navigation", { name: "Primary" })
    const navBox = await nav.boundingBox()
    // A compact bar: at most 76px tall including the home-indicator area.
    expect(navBox!.height).toBeLessThanOrEqual(76)

    for (const tab of TABS) {
      await nav.getByRole("button", { name: tab.name, exact: true }).click()
      await expect(page).toHaveURL(new RegExp(tab.path))
      await settle(page)
      expect.soft(await avatarCollisions(page), `${tab.name}: avatar overlaps`).toEqual([])
      if (tab.name === "Discover") {
        // Compact rows: cover, title, facts, one save button and the overflow menu.
        const heights = await page.locator(".discover-card").evaluateAll((cards) => cards.slice(0, 3).map((card) => card.getBoundingClientRect().height))
        for (const height of heights) expect.soft(height, "Discover row height").toBeLessThanOrEqual(150)
        // Everything beyond the save button sits behind the overflow menu.
        expect.soft(await page.locator(".discover-card").first().getByRole("button").count(), "Discover card actions").toBe(2)
        await page.screenshot({ path: `${SHOTS}/discover-top-390-${scheme}.png` })
      }

      // Scroll to the end; the last item must sit fully above the bar.
      const last = page.locator(tab.last).last()
      if (await last.count() === 0) continue
      await page.locator(".app-phone").evaluate((element) => element.scrollTo(0, element.scrollHeight))
      await page.waitForTimeout(150)
      const box = await last.boundingBox()
      expect(box, `${tab.name}: last item`).not.toBeNull()
      expect.soft(box!.y + box!.height, `${tab.name}: last item clears the tab bar`).toBeLessThanOrEqual(navBox!.y)
      await page.screenshot({ path: `${SHOTS}/${tab.name.toLowerCase()}-end-390-${scheme}.png` })
    }
  })
}
