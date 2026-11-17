import { expect, test } from "@playwright/test"

import { LOCAL_PASSWORD, logIn } from "./support"

// SP-POLISH-03. Real local backend. Adds a player from the shared selection
// step (Game Night and Picker use the same component) and checks avatars.
const FREE_EMAIL = "local-free@shelfpick.app"
const SHOTS = "../docs/screenshots/sp-polish-03"

test.use({ viewport: { width: 390, height: 844 } })

for (const scheme of ["light", "dark"] as const) {
  test(`add a player in Game Night (${scheme})`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "iPhone 15", "one phone-size project is enough")
    await page.emulateMedia({ colorScheme: scheme })
    await logIn(page, FREE_EMAIL, LOCAL_PASSWORD)
    await expect(page).not.toHaveURL(/\/login/)
    await page.goto("/game-night")
    await page.getByRole("button", { name: /Choose players/ }).click()

    const screen = page.locator(".picker-selection-screen")
    const name = `E2E Friend ${scheme} ${Date.now().toString(36)}`
    await screen.getByRole("button", { name: "+ Add player" }).click()
    await screen.getByPlaceholder("Player's name").fill(name)
    await screen.getByRole("button", { name: "Add and select" }).click()

    // The new player is listed, selected, and counted.
    const row = screen.getByRole("button", { name: new RegExp(name) })
    await expect(row).toHaveAttribute("aria-pressed", "true")
    await expect(screen.getByText(/\b1 player selected/)).toBeVisible()
    // Avatars are initials only: no icon inside them.
    await expect(screen.locator(".player-avatar svg")).toHaveCount(0)
    await page.screenshot({ path: `${SHOTS}/add-player-${scheme}.png` })

    // Adding the same name again does not create a duplicate row.
    await screen.getByRole("button", { name: "+ Add player" }).click()
    await screen.getByPlaceholder("Player's name").fill(name.toUpperCase())
    await screen.getByRole("button", { name: "Add and select" }).click()
    await expect(screen.getByRole("button", { name: new RegExp(name, "i") })).toHaveCount(1)
  })
}
