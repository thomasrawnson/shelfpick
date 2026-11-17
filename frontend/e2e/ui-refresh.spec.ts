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

async function signIn(page: Page) {
  await mockShelf(page)
  await logIn(page, "local-free@shelfpick.app")
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
  await logIn(page, "local-free@shelfpick.app")
  await expect(page).toHaveURL(/\/tonight/)
  await page.goto("/plays")
  await expect(page.getByText("No plays yet")).toBeVisible()
  await page.screenshot({ path: `${SHOTS}/after/plays-empty-390-light.png` })
})
