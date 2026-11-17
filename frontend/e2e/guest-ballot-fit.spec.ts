import { expect, test } from "@playwright/test"

import { LOCAL_PASSWORD, logIn } from "./support"

// SP-POLISH-04. Real local backend with phone voting on
// (E2E_PHONE_VOTING_ENABLED=true). The guest ballot should fit one phone
// screen without scrolling, show a facts line per game and keep Submit in view.
const ENABLED = process.env.E2E_PHONE_VOTING_ENABLED === "true"
const SHOTS = "../docs/screenshots/sp-polish-04"
// A phone browser with its toolbars leaves roughly this much room.
const GUEST_VIEWPORT = { width: 390, height: 664 }

for (const scheme of ["light", "dark"] as const) {
  test(`guest ballot fits one screen (${scheme})`, async ({ page, browser }, testInfo) => {
    test.skip(!ENABLED, "needs E2E_PHONE_VOTING_ENABLED=true")
    test.skip(testInfo.project.name !== "iPhone 15", "one phone-size project is enough")
    await page.emulateMedia({ colorScheme: scheme })
    await logIn(page, "local-free@shelfpick.app", LOCAL_PASSWORD)
    await expect(page).not.toHaveURL(/\/login/)
    await page.goto("/game-night")
    await page.getByRole("button", { name: /Choose players/ }).click()
    const screen = page.locator(".picker-selection-screen")
    await screen.getByRole("button", { name: /Free Host/ }).click()
    await screen.getByRole("button", { name: /Guest Tester/ }).click()
    await screen.getByRole("button", { name: /Back/ }).click()
    await page.getByRole("button", { name: /^Continue with/ }).click()
    await page.getByRole("button", { name: /All night/ }).click()
    await page.getByRole("button", { name: "Find games" }).click()
    await page.getByRole("button", { name: "Open phone voting" }).click()
    const joinUrl = await page.getByLabel("Join link").inputValue()

    const context = await browser.newContext({ viewport: GUEST_VIEWPORT, colorScheme: scheme })
    const guest = await context.newPage()
    await guest.goto(joinUrl)
    await guest.getByLabel(/Nickname/).first().fill("Fit Check")
    await guest.getByRole("button", { name: "Join voting" }).click()
    const submit = guest.getByRole("button", { name: /Submit vote/ })
    await expect(submit).toBeVisible()

    // Every option and the Submit button are inside the first screen.
    const radios = guest.getByRole("radio")
    const count = await radios.count()
    expect(count).toBeGreaterThanOrEqual(4) // 3+ games and Abstain
    const lastBox = await radios.last().locator("xpath=ancestor::label").boundingBox()
    const submitBox = await submit.boundingBox()
    expect(lastBox!.y + lastBox!.height).toBeLessThanOrEqual(GUEST_VIEWPORT.height)
    expect(submitBox!.y + submitBox!.height).toBeLessThanOrEqual(GUEST_VIEWPORT.height)
    expect(await guest.evaluate(() => document.documentElement.scrollHeight - window.innerHeight)).toBeLessThanOrEqual(
      // the privacy card sits below the ballot, so a little scroll is fine once voted; before voting none
      0,
    )

    // A facts line is shown under the games that have the data.
    await expect(guest.locator(".game-night-ballot-facts").first()).toContainText(/players|min/)
    await guest.screenshot({ path: `${SHOTS}/guest-ballot-${scheme}.png` })
    await context.close()
  })
}

// Worst case: five games with cover art and long names.
test("five games with cover art still fit one screen", async ({ page, browser }, testInfo) => {
  test.skip(!ENABLED, "needs E2E_PHONE_VOTING_ENABLED=true")
  test.skip(testInfo.project.name !== "iPhone 15", "one phone-size project is enough")
  await logIn(page, "local-free@shelfpick.app", LOCAL_PASSWORD)
  await expect(page).not.toHaveURL(/\/login/)
  await page.goto("/game-night")
  await page.getByRole("button", { name: /Choose players/ }).click()
  const screen = page.locator(".picker-selection-screen")
  await screen.getByRole("button", { name: /Free Host/ }).click()
  await screen.getByRole("button", { name: /Guest Tester/ }).click()
  await screen.getByRole("button", { name: /Back/ }).click()
  await page.getByRole("button", { name: /^Continue with/ }).click()
  await page.getByRole("button", { name: /All night/ }).click()
  await page.getByRole("button", { name: "Find games" }).click()
  await page.getByRole("button", { name: "Open phone voting" }).click()
  const joinUrl = await page.getByLabel("Join link").inputValue()

  const context = await browser.newContext({ viewport: GUEST_VIEWPORT })
  const guest = await context.newPage()
  const art = "data:image/svg+xml;utf8," + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="80" height="96"><rect width="80" height="96" fill="#7a5c3a"/></svg>',
  )
  const names = [
    "7 Wonders Duel", "A Feast for Odin", "A Gest of Robin Hood: Legends of Sherwood",
    "Agent Avenue", "Ankh: Gods of Egypt",
  ]
  await guest.route("**/game-night/voting/*", async (route) => {
    const response = await route.fetch()
    if (route.request().method() !== "GET" || !response.ok()) return route.fulfill({ response })
    const body = await response.json()
    if (!body.candidates) return route.fulfill({ response })
    body.candidates = names.map((name, index) => ({
      bgg_id: 9000 + index, name, thumbnail_url: art,
      min_players: 2, max_players: 4, min_play_time: 30, max_play_time: 90, complexity: 2.8,
    }))
    return route.fulfill({ response, json: body })
  })
  await guest.goto(joinUrl)
  await guest.getByLabel(/Nickname/).first().fill("Five Games")
  await guest.getByRole("button", { name: "Join voting" }).click()
  const submit = guest.getByRole("button", { name: /Submit vote/ })
  await expect(submit).toBeVisible()
  await expect(guest.getByRole("radio")).toHaveCount(6)
  const lastBox = await guest.getByRole("radio").last().locator("xpath=ancestor::label").boundingBox()
  const submitBox = await submit.boundingBox()
  expect(lastBox!.y + lastBox!.height).toBeLessThanOrEqual(GUEST_VIEWPORT.height)
  expect(submitBox!.y + submitBox!.height).toBeLessThanOrEqual(GUEST_VIEWPORT.height)
  await guest.screenshot({ path: `${SHOTS}/guest-ballot-five-games.png` })
  await context.close()
})

