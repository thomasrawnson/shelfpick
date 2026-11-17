import { expect, test, type Page } from "@playwright/test"

import { LOCAL_PASSWORD, logIn } from "./support"

// SP-UNLOCK-01. Real local backend, no request mocking.
// E2E_PHONE_VOTING_ENABLED=true  -> free host opens a vote, guest votes.
// unset / false                  -> server returns 503 and the UI is truthful.
// Uses the local-free account from docs/local-free-pro-testing.md.
const ENABLED = process.env.E2E_PHONE_VOTING_ENABLED === "true"
const FREE_EMAIL = "local-free@shelfpick.app"
const SHOTS = "../docs/screenshots/sp-unlock-01"

test.use({ viewport: { width: 390, height: 844 } })

async function openShortlist(page: Page) {
  await logIn(page, FREE_EMAIL, LOCAL_PASSWORD)
  await expect(page).not.toHaveURL(/\/login/)
  await page.goto("/game-night")
  await page.getByRole("button", { name: /Choose players/ }).click()
  await page.locator(".picker-selection-screen").getByRole("button", { name: /Free Host/ }).click()
  await page.locator(".picker-selection-screen").getByRole("button", { name: /Guest Tester/ }).click()
  await page.locator(".picker-selection-screen").getByRole("button", { name: /Back/ }).click()
  await page.getByRole("button", { name: /^Continue with/ }).click()
  await page.getByRole("button", { name: /All night/ }).click()
  await page.getByRole("button", { name: "Find games" }).click()
  await expect(page.getByRole("heading", { name: "Your shortlist" })).toBeVisible()
}

for (const scheme of ["light", "dark"] as const) {
  test.describe(`${scheme} scheme`, () => {
    test.use({ colorScheme: scheme })

    test(`free host phone voting is ${ENABLED ? "enabled" : "server-disabled"}`, async ({ page, browser }, testInfo) => {
      test.skip(testInfo.project.name !== "iPhone 15", "one phone-size project is enough")
      await openShortlist(page)
      const open = page.getByRole("button", { name: "Open phone voting" })
      await expect(open).toBeVisible()
      await expect(page.getByText(/requires ShelfPick Pro/i)).toHaveCount(0)
      await open.click()

      if (!ENABLED) {
        const alert = page.getByRole("alert")
        await expect(alert).toContainText("Phone voting is unavailable")
        await expect(page.getByRole("img", { name: /Scan to join/ })).toHaveCount(0)
        await page.screenshot({ path: `${SHOTS}/host-server-disabled-${scheme}.png` })

        // Guest link with the server switch off.
        const guest = await (await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: scheme })).newPage()
        await guest.goto("/game-night/join/not-a-real-token")
        await expect(guest.getByRole("heading", { name: "Phone voting isn’t available" })).toBeVisible()
        await expect(guest.getByRole("button", { name: "Try again" })).toHaveCount(0)
        await expect(guest.getByRole("button", { name: /Join voting|Submit vote/ })).toHaveCount(0)
        await guest.screenshot({ path: `${SHOTS}/guest-server-disabled-${scheme}.png` })
        await guest.context().close()
        return
      }

      // Host: QR code and join link are shown to a Free account.
      await expect(page.getByRole("heading", { name: "Invite the group" })).toBeVisible()
      await expect(page.getByRole("img", { name: /Scan to join ShelfPick Game Night voting/ })).toBeVisible()
      const joinUrl = await page.getByLabel("Join link").inputValue()
      expect(joinUrl).toContain("/game-night/join/")
      await page.screenshot({ path: `${SHOTS}/host-qr-${scheme}.png` })

      // Guest: separate browser context, no account.
      const guestContext = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: scheme })
      const guest = await guestContext.newPage()
      await guest.goto(joinUrl)
      await guest.getByLabel(/Nickname/).first().fill("Guest One")
      await guest.getByRole("button", { name: "Join voting" }).click()
      await guest.getByRole("radio").first().check()
      await guest.getByRole("button", { name: "Submit vote" }).click()
      await expect(guest.getByText("Your ballot is saved")).toBeVisible()
      const cta = guest.getByRole("link", { name: "Get ShelfPick" })
      await expect(cta).toBeVisible()
      const href = await cta.getAttribute("href")
      expect(href).toMatch(/^https:\/\/apps\.apple\.com\/app\/id\d+$/)
      await guest.screenshot({ path: `${SHOTS}/guest-voted-cta-${scheme}.png` })

      // Host closes; guest sees results and the CTA again.
      await page.getByRole("button", { name: /Close voting|Close vote/ }).click()
      await expect(guest.getByRole("heading", { name: /The votes are in|The vote is tied|No votes/ })).toBeVisible({ timeout: 15_000 })
      await expect(guest.getByRole("link", { name: "Get ShelfPick" })).toBeVisible()
      await guest.screenshot({ path: `${SHOTS}/guest-results-cta-${scheme}.png` })
      await guestContext.close()
    })
  })
}
