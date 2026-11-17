import { expect, test, type Page } from "@playwright/test"

import { LOCAL_PASSWORD, logIn } from "./support"

// SP-PLAY-01, updated for the SP-UI-02 Log play sheet. Real local backend. Logs co-op and team plays, edits a saved
// play and starts rematches from the confirmation and from history.
const FREE_EMAIL = "local-free@shelfpick.app"
const GAME = "Lantern Grove"
const SHOTS = "../docs/screenshots/sp-ui-02/after"

test.use({ viewport: { width: 390, height: 844 } })

async function openGame(page: Page) {
  await page.goto("/collection")
  await page.getByText(GAME).first().click()
  await expect(page.getByRole("button", { name: "Log a play" })).toBeVisible()
}

const sheet = (page: Page) => page.getByRole("dialog")

async function addPlayers(page: Page, names: string[]) {
  for (const name of names) {
    await sheet(page).getByLabel("Add player").fill(name)
    await sheet(page).getByLabel("Add player").press("Enter")
  }
}

for (const scheme of ["light", "dark"] as const) {
  test(`log co-op and team plays, edit, rematch (${scheme})`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "iPhone 15", "one phone-size project is enough")
    await page.emulateMedia({ colorScheme: scheme })
    await logIn(page, FREE_EMAIL, LOCAL_PASSWORD)
    await expect(page).not.toHaveURL(/\/login/)

    const stamp = Date.now().toString(36)
    const alex = `Alex ${scheme} ${stamp}`
    const sam = `Sam ${scheme} ${stamp}`
    const jo = `Jo ${scheme} ${stamp}`

    await openGame(page)

    // Co-op game, Won.
    await page.getByRole("button", { name: "Log a play" }).click()
    const form = sheet(page)
    await form.getByLabel("Result type").selectOption("cooperative")
    await addPlayers(page, [alex, sam])
    await expect(form.getByText("Did the group win?")).toBeVisible()
    await form.getByRole("button", { name: "Save play" }).click()
    await expect(form.getByRole("alert")).toContainText("Won or Lost")
    await form.getByLabel("Won", { exact: true }).check({ force: true })
    await page.screenshot({ path: `${SHOTS}/coop-form-${scheme}.png` })
    await form.getByRole("button", { name: "Save play" }).click()
    await expect(form.getByText("Play saved")).toBeVisible()

    // Rematch from the confirmation keeps players and type, clears the result.
    await form.getByRole("button", { name: "Rematch" }).click()
    await expect(form.getByLabel("Result type")).toHaveValue("cooperative")
    await expect(form.getByPlaceholder("Player name").first()).toHaveValue(alex)
    await expect(form.getByPlaceholder("Player name").nth(1)).toHaveValue(sam)
    await expect(form.getByLabel("Won", { exact: true })).not.toBeChecked()

    // Team game: two teams, one winner.
    await form.getByLabel("Result type").selectOption("team")
    await addPlayers(page, [jo])
    await form.getByLabel(`Team for ${alex}`).fill("Red")
    await form.getByLabel(`Team for ${sam}`).fill("Blue")
    await form.getByLabel(`Team for ${jo}`).fill("Red")
    await form.getByLabel("Winning team").selectOption("Red")
    await page.screenshot({ path: `${SHOTS}/team-form-${scheme}.png` })
    await form.getByRole("button", { name: "Save play" }).click()
    await expect(form.getByText("Play saved")).toBeVisible()
    await form.getByRole("button", { name: "Done" }).click()
    await expect(form).toBeHidden()

    // The history shows the team result per player.
    const teamPlay = page.locator(".recent-play-detail").first()
    await expect(teamPlay).toContainText("Teams")
    await expect(teamPlay.locator(".history-player", { hasText: alex })).toContainText("Won")
    await expect(teamPlay.locator(".history-player", { hasText: jo })).toContainText("Won")
    await expect(teamPlay.locator(".history-player", { hasText: sam })).toContainText("Lost")

    // Edit the team play: change the location and make Blue the winner.
    await teamPlay.getByRole("button", { name: "Edit" }).click()
    const editForm = sheet(page)
    await expect(editForm.getByText("Edit play")).toBeVisible()
    await expect(editForm.getByLabel("Result type")).toHaveValue("team")
    await editForm.locator(".play-summary-button").click()
    await editForm.getByPlaceholder("e.g. The Dice Cup").fill(`Edited ${stamp}`)
    await editForm.getByLabel("Winning team").selectOption("Blue")
    await page.screenshot({ path: `${SHOTS}/edit-form-${scheme}.png` })
    await editForm.getByRole("button", { name: "Save changes" }).click()
    await expect(editForm).toBeHidden()
    const edited = page.locator(".recent-play-detail").first()
    await expect(edited).toContainText(`Edited ${stamp}`)
    await expect(edited.locator(".history-player", { hasText: sam })).toContainText("Won")
    await expect(edited.locator(".history-player", { hasText: alex })).toContainText("Lost")

    // Rematch from a saved play prefills players, teams and location.
    await edited.getByRole("button", { name: "Rematch" }).click()
    const rematchForm = sheet(page)
    await expect(rematchForm.getByLabel("Result type")).toHaveValue("team")
    await expect(rematchForm.getByPlaceholder("Player name").first()).toHaveValue(alex)
    await expect(rematchForm.getByPlaceholder("Team").first()).toHaveValue("Red")
    await expect(rematchForm.locator(".play-summary-text")).toContainText(`Edited ${stamp}`)
    await page.screenshot({ path: `${SHOTS}/rematch-${scheme}.png` })
    await rematchForm.getByRole("button", { name: "Cancel" }).click()

    // Tidy: delete the two plays this run created.
    for (let index = 0; index < 2; index += 1) {
      const play = page.locator(".recent-play-detail").first()
      await play.getByRole("button", { name: "Delete play" }).click()
      await play.getByRole("button", { name: "Delete play" }).last().click()
      await expect(page.getByText("Delete this play?")).toHaveCount(0)
    }
  })
}
