import { expect, test, type Page } from "@playwright/test"

import { LOCAL_PASSWORD, authForm } from "./support"

// SP-STORE-R01: optional usage analytics are off until the person says yes. Real local backend for the
// sign-in; every PostHog request is intercepted (and counted) so nothing leaves the machine.
test.use({ storageState: { cookies: [], origins: [] }, viewport: { width: 390, height: 844 } })

const KEY = "shelfpick.analytics.enabled"

async function watchPostHog(page: Page) {
  const sent: string[] = []
  await page.route(/posthog\.com/, async (route) => {
    sent.push(route.request().url())
    await route.fulfill({ status: 200, json: { status: 1 } })
  })
  return sent
}

test.beforeEach((_fixtures, testInfo) => { test.skip(testInfo.project.name !== "iPhone 15", "one phone-size project is enough") })

test("a fresh install asks once, collects nothing before the answer, and Not now stays off", async ({ page }) => {
  const sent = await watchPostHog(page)
  await page.goto("/login")
  const choice = page.getByRole("dialog", { name: "Help improve ShelfPick?" })
  await expect(choice).toBeVisible()
  await page.waitForTimeout(4000)
  expect(sent).toHaveLength(0)
  expect(await page.evaluate(() => Object.keys(localStorage).filter((key) => key.startsWith("ph_") || key.includes("posthog")))).toEqual([])

  await choice.getByRole("button", { name: "Not now" }).click()
  await expect(choice).toHaveCount(0)
  expect(await page.evaluate((key) => localStorage.getItem(key), KEY)).toBe("off")

  await page.reload()
  await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible()
  await expect(page.getByRole("dialog", { name: "Help improve ShelfPick?" })).toHaveCount(0)
  await page.waitForTimeout(4000)
  expect(sent).toHaveLength(0)
})

// Playwright's headless browser looks like a bot, so PostHog drops events itself. What the browser can show is
// whether the SDK started (its storage appears) and whether withdrawal is recorded in it.
const sdkKeys = (page: Page) => page.evaluate(() => Object.keys(localStorage).filter((key) => key.startsWith("ph_")))
const optedOut = (page: Page) => page.evaluate(() => Object.entries(localStorage).find(([key]) => key.startsWith("__ph_opt_in_out_"))?.[1] ?? null)

test("accepting starts the SDK and Settings withdraws it", async ({ page }) => {
  await watchPostHog(page)
  await page.goto("/login")
  expect(await sdkKeys(page)).toEqual([])
  await page.getByRole("dialog", { name: "Help improve ShelfPick?" }).getByRole("button", { name: "Share usage data" }).click()
  expect(await page.evaluate((key) => localStorage.getItem(key), KEY)).toBe("on")
  await expect.poll(() => sdkKeys(page), { timeout: 15_000 }).not.toEqual([])

  await authForm(page).getByLabel("Email").fill("local-free@shelfpick.app")
  await authForm(page).getByLabel("Password", { exact: true }).fill(LOCAL_PASSWORD)
  await authForm(page).getByRole("button", { name: "Log in" }).click()
  await expect(page).not.toHaveURL(/\/login/)
  await page.goto("/settings/help")
  const toggle = page.getByLabel("Share anonymous usage analytics")
  await expect(toggle).toBeChecked()

  await toggle.uncheck()
  expect(await page.evaluate((key) => localStorage.getItem(key), KEY)).toBe("off")
  await expect.poll(() => optedOut(page)).toBe("0")

  await page.reload()
  await expect(page.getByLabel("Share anonymous usage analytics")).not.toBeChecked()
  expect(await optedOut(page)).toBe("0")
})
