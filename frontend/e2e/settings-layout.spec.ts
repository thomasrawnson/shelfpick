import { mkdirSync } from "node:fs"

import { expect, test, type Page } from "@playwright/test"
import { APP_BUILD, APP_VERSION } from "../src/app-links"

import { logIn } from "./support"
import { mockShelf } from "./ui-fixtures"

// SP-SETTINGS-01: compact grouped Settings, tip jar and feedback sheets at
// 390x844 in dark and light. /feedback is stubbed here (the dev database may
// not have the new table); the backend tests cover the real endpoint.
const SHOTS = "../docs/screenshots/sp-settings-01/after"

test.beforeEach(({ browserName }, testInfo) => { test.skip(browserName !== "webkit" || testInfo.project.name !== "iPhone 15") })

async function openSettings(page: Page, scheme: "dark" | "light") {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.emulateMedia({ colorScheme: scheme, reducedMotion: "reduce" })
  await mockShelf(page)
  await logIn(page, "local-free@shelfpick.app")
  await expect(page).toHaveURL(/\/tonight/)
  await page.goto("/settings")
  await expect(page.getByRole("heading", { name: "Settings", level: 1 })).toBeVisible()
  await page.waitForLoadState("networkidle")
}

for (const scheme of ["dark", "light"] as const) {
  test(`Settings, tip jar and feedback at 390x844 ${scheme}`, async ({ page }) => {
    mkdirSync(SHOTS, { recursive: true })
    await openSettings(page, scheme)
    await page.screenshot({ path: `${SHOTS}/settings-top-390x844-${scheme}.png` })

    // Every row is at least 44pt tall.
    const heights = await page.locator(".settings-row, .settings-upsell, .settings-profile-link")
      .evaluateAll((rows) => rows.map((row) => Math.round(row.getBoundingClientRect().height)))
    expect(heights.length).toBeGreaterThanOrEqual(13)
    for (const height of heights) expect.soft(height).toBeGreaterThanOrEqual(44)

    // The last row and the footer scroll fully clear of the tab bar.
    const scroller = page.locator(".app-phone")
    await scroller.evaluate((element) => element.scrollTo(0, element.scrollHeight))
    await page.waitForTimeout(150)
    const navTop = (await page.getByRole("navigation", { name: "Primary" }).boundingBox())!.y
    const lastRow = (await page.locator(".settings-row").last().boundingBox())!
    expect(lastRow.y + lastRow.height, "last row clears the tab bar").toBeLessThanOrEqual(navTop)
    const footer = (await page.locator(".settings-footer").boundingBox())!
    expect(footer.y + footer.height, "footer clears the tab bar").toBeLessThanOrEqual(navTop)
    await page.screenshot({ path: `${SHOTS}/settings-bottom-390x844-${scheme}.png` })

    await page.getByRole("button", { name: "Tip jar" }).click()
    const tipJar = page.getByRole("dialog", { name: "Tip jar" })
    await expect(tipJar.getByRole("button", { name: "Tip Coffee, £1.99" })).toBeVisible()
    await page.screenshot({ path: `${SHOTS}/tip-jar-390x844-${scheme}.png` })
    await tipJar.getByRole("button", { name: "Done" }).click()

    await page.getByRole("button", { name: "Request a feature" }).click()
    const sheet = page.getByRole("dialog", { name: "Send feedback" })
    await sheet.getByLabel("Message").fill("A lending tracker would help our group keep track of borrowed games.")
    await page.screenshot({ path: `${SHOTS}/feedback-390x844-${scheme}.png` })
  })
}

test("Settings root details: upsell, external links and no Log out", async ({ page }) => {
  await openSettings(page, "dark")
  await expect(page.getByRole("link", { name: /^Unlock ShelfPick Pro/ })).toHaveAttribute("href", "/settings/pro")
  for (const heading of ["Appearance", "Players and picking", "Collection", "Data and backup", "Support ShelfPick", "Feedback", "Follow ShelfPick", "About"]) {
    await expect(page.getByRole("heading", { name: heading, exact: true })).toBeAttached()
  }
  await expect(page.getByRole("link", { name: "Website, plutonightlabs.com (opens outside ShelfPick)" })).toHaveAttribute("target", "_blank")
  await expect(page.getByRole("link", { name: "YouTube, @shelfpick (opens outside ShelfPick)" })).toHaveAttribute("href", "https://www.youtube.com/@shelfpick")
  await expect(page.getByRole("link", { name: "Leave a review (opens the App Store)" })).toHaveAttribute("target", "_blank")
  await expect(page.getByRole("combobox", { name: "Theme" })).toHaveValue("system")
  await expect(page.getByRole("button", { name: "Log out" })).toHaveCount(0)
})

test("A tip shows thanks, then the Supporter badge on the profile card", async ({ page }) => {
  await openSettings(page, "dark")
  await page.getByRole("button", { name: "Tip jar" }).click()
  const tipJar = page.getByRole("dialog", { name: "Tip jar" })
  await tipJar.getByRole("button", { name: "Tip Pint, £4.99" }).click()
  await expect(tipJar.getByRole("status")).toContainText("Thank you!")
  await tipJar.getByRole("button", { name: "Done" }).click()
  await expect(page.getByRole("link", { name: /^Account, plan and log out: .+, Supporter$/ })).toBeVisible()
  await expect(page.getByRole("button", { name: "Tip jar" })).toBeFocused()
})

test("Feedback validates, sends and confirms", async ({ page }) => {
  const posts: unknown[] = []
  await page.route("**/feedback", async (route) => {
    posts.push(route.request().postDataJSON())
    await route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ id: 1 }) })
  })
  await openSettings(page, "dark")
  await page.getByRole("button", { name: "Report a problem" }).click()
  const sheet = page.getByRole("dialog", { name: "Send feedback" })
  await sheet.getByLabel("Message").fill("Too short")
  await sheet.getByRole("button", { name: "Send" }).click()
  await expect(sheet.getByRole("alert")).toHaveText("Write at least 10 characters.")
  expect(posts).toHaveLength(0)

  await sheet.getByLabel("Message").fill("Stats froze after logging a co-op play.")
  await sheet.getByRole("switch", { name: "Email me back" }).check()
  await sheet.getByRole("button", { name: "Send" }).click()
  await expect(sheet.getByRole("status")).toContainText("Thanks, we've got it")
  expect(posts).toEqual([expect.objectContaining({
    type: "problem", message: "Stats froze after logging a co-op play.", wants_reply: true, app_version: APP_VERSION, build: APP_BUILD,
  })])
})

test("Feedback written offline is saved, then sent when the connection returns", async ({ page }) => {
  await openSettings(page, "dark")
  await page.route("**/feedback", (route) => route.abort("internetdisconnected"))
  await page.getByRole("button", { name: "Request a feature" }).click()
  const sheet = page.getByRole("dialog", { name: "Send feedback" })
  await sheet.getByLabel("Message").fill("Please add a lending tracker for borrowed games.")
  await sheet.getByRole("button", { name: "Send" }).click()
  await expect(sheet.getByRole("status")).toContainText("Saved to send later")
  await sheet.getByRole("button", { name: "Done" }).click()

  await page.unroute("**/feedback")
  const delivered = page.waitForRequest((request) => request.url().endsWith("/feedback") && request.method() === "POST")
  await page.route("**/feedback", (route) => route.fulfill({ status: 201, contentType: "application/json", body: "{\"id\":2}" }))
  await page.evaluate(() => window.dispatchEvent(new Event("online")))
  expect((await delivered).postDataJSON()).toMatchObject({ type: "feature", message: "Please add a lending tracker for borrowed games." })
  await expect.poll(() => page.evaluate(() => localStorage.getItem("shelfpick-feedback-outbox"))).toBeNull()
})

test("Log out works from the bottom of Profile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" })
  await logIn(page, "local-free@shelfpick.app")
  await expect(page).toHaveURL(/\/tonight/)
  await page.goto("/settings")
  await page.getByRole("link", { name: /^Account, plan and log out/ }).click()
  await expect(page).toHaveURL(/\/settings\/profile/)
  await expect(page.getByText("ShelfPick Free")).toBeVisible()
  await page.getByRole("button", { name: "Log out", exact: true }).click()
  await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible()
})
