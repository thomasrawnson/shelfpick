import { execFileSync } from "node:child_process"
import path from "node:path"

import { expect, test, type Locator, type Page } from "@playwright/test"

import { BACKEND_DIR, LOCAL_PASSWORD, backendEnv, backendPython, logIn } from "./support"

// SP-SCORE-01: scoresheets in the Log play sheet. Real local backend with the
// built-in sheets seeded (python -m scripts.seed_scoresheets). Free account for
// built-in sheets, Pro account for building a custom sheet.
const FREE_EMAIL = "local-free@shelfpick.app"
const PRO_EMAIL = "local-pro@shelfpick.app"
const SHOTS = "../docs/screenshots/sp-score-01"

test.use({ viewport: { width: 390, height: 844 } })

test.beforeAll(() => {
  execFileSync(backendPython(), [path.join(BACKEND_DIR, "../frontend/e2e/scoresheet_games.py")], {
    cwd: BACKEND_DIR,
    env: { ...backendEnv(), PYTHONPATH: BACKEND_DIR },
    encoding: "utf8",
  })
})

const sheet = (page: Page) => page.getByRole("dialog")
const keypad = (page: Page) => sheet(page).locator(".math-keyboard")

async function openGame(page: Page, name: string) {
  await expect(page).not.toHaveURL(/\/login/)
  await page.goto("/collection")
  await page.getByText(name).first().click()
  await expect(page.getByRole("button", { name: "Log a play" })).toBeVisible()
}

async function addPlayers(page: Page, names: string[]) {
  for (const name of names) {
    await sheet(page).getByLabel("Add player").fill(name)
    await sheet(page).getByLabel("Add player").press("Enter")
  }
}

const KEY_NAMES: Record<string, string> = { "+": "plus", "-": "minus", "*": "times", ".": "decimal point" }

async function type(page: Page, expression: string) {
  for (const char of expression) {
    await keypad(page).getByRole("button", { name: KEY_NAMES[char] ?? char, exact: true }).click()
  }
}

// Opens the cell for one category and player, types the sum and closes.
async function enter(page: Page, row: string, player: string, expression: string, finish: "Done" | "Next" = "Done") {
  await sheet(page).getByRole("button", { name: new RegExp(`^${escape(row)}, ${escape(player)}:`) }).click()
  await expect(keypad(page)).toContainText(`${row} for ${player}`)
  await keypad(page).getByRole("button", { name: "Clear", exact: true }).click()
  await type(page, expression)
  await keypad(page).getByRole("button", { name: finish, exact: true }).click()
}

function escape(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function total(form: Locator, player: string) {
  return form.locator(".scoresheet-total-value").and(form.getByLabel(new RegExp(`^${escape(player)} total`)))
}

function playWith(page: Page, name: string) {
  return page.locator(".recent-play-detail", { hasText: name })
}

async function deletePlayWith(page: Page, name: string) {
  const play = playWith(page, name)
  await play.getByRole("button", { name: "Delete play" }).click()
  await play.getByRole("button", { name: "Delete play" }).last().click()
  await expect(page.getByText("Delete this play?")).toHaveCount(0)
}

for (const scheme of ["light", "dark"] as const) {
  test.describe(`Scoresheets (${scheme})`, () => {
    test.beforeEach(async ({ page }, testInfo) => {
      test.skip(testInfo.project.name !== "iPhone 15", "one phone-size project is enough")
      await page.emulateMedia({ colorScheme: scheme })
    })

    test("log a Wingspan play with the built-in sheet and maths keyboard, then edit the breakdown", async ({ page }) => {
      await logIn(page, FREE_EMAIL, LOCAL_PASSWORD)
      await expect(page).not.toHaveURL(/\/login/)
      const stamp = Date.now().toString(36)
      const ana = `Ana ${stamp}`
      const ben = `Ben ${stamp}`

      await openGame(page, "Wingspan")
      await page.getByRole("button", { name: "Log a play" }).click()
      const form = sheet(page)
      await addPlayers(page, [ana, ben])
      // Free accounts do not see the custom builder.
      await expect(form.getByRole("button", { name: "Build a scoresheet" })).toHaveCount(0)
      await form.getByRole("button", { name: "Use scoresheet" }).click()
      await expect(form.getByRole("table")).toBeVisible()
      await expect(form.getByLabel("Result type")).toHaveCount(0)

      // "40+12" shows its running result, and Next moves down the column.
      await form.getByRole("button", { name: new RegExp(`^Birds, ${ana}:`) }).click()
      await type(page, "40+12")
      await expect(keypad(page).locator(".math-result")).toHaveText("= 52")
      await keypad(page).getByRole("button", { name: "Next", exact: true }).click()
      await expect(keypad(page)).toContainText(`Bonus cards for ${ana}`)
      await keypad(page).getByRole("button", { name: "Done", exact: true }).click()
      await expect(keypad(page)).toHaveCount(0)

      await enter(page, "Birds", ben, "48")
      await enter(page, "Eggs", ben, "9*3")
      await expect(total(form, ana)).toHaveText("52")
      await expect(total(form, ben)).toHaveText("75")
      await expect(form.getByText(`Calculated: ${ben} wins.`)).toBeVisible()
      await page.screenshot({ path: `${SHOTS}/wingspan-grid-${scheme}.png` })

      // Override the calculated winner, then go back to it.
      await form.getByRole("button", { name: `${ana} won` }).click()
      await expect(form.getByText("Winner chosen by hand.")).toBeVisible()
      await form.getByRole("button", { name: "Use calculated result" }).click()
      await expect(form.getByText(`Calculated: ${ben} wins.`)).toBeVisible()

      await form.getByRole("button", { name: "Save play" }).click()
      await expect(form.getByText("Play saved")).toBeVisible()
      await expect(form.getByRole("link", { name: "Send to BG Stats" })).toBeVisible()
      const bgStats = await form.getByRole("link", { name: "Send to BG Stats" }).getAttribute("href")
      expect(decodeURIComponent(bgStats ?? "")).toContain("\"score\":75")
      expect(decodeURIComponent(bgStats ?? "")).not.toContain("birds")
      await form.getByRole("button", { name: "Done" }).click()

      let saved = playWith(page, ana)
      await expect(saved.locator(".history-player", { hasText: ben })).toContainText("Won")
      await expect(saved.locator(".history-player", { hasText: ana })).toContainText("Lost")

      // Edit the breakdown: the grid comes back filled and the result follows.
      await saved.getByRole("button", { name: "Edit" }).click()
      const edit = sheet(page)
      await expect(edit.getByText("Edit play")).toBeVisible()
      await expect(edit.getByRole("button", { name: new RegExp(`^Birds, ${ana}: 52$`) })).toBeVisible()
      await enter(page, "Birds", ana, "90")
      await expect(total(edit, ana)).toHaveText("90")
      await page.screenshot({ path: `${SHOTS}/wingspan-edit-${scheme}.png` })
      await edit.getByRole("button", { name: "Save changes" }).click()
      await expect(edit).toBeHidden()
      saved = playWith(page, ana)
      await expect(saved.locator(".history-player", { hasText: ana })).toContainText("Won")
      await expect(saved.locator(".history-player", { hasText: ana })).toContainText("90")
      await deletePlayWith(page, ana)
    })

    test("log a lowest-wins Skyjo play with open-ended rounds", async ({ page }) => {
      await logIn(page, FREE_EMAIL, LOCAL_PASSWORD)
      const stamp = Date.now().toString(36)
      const ana = `Ana ${stamp}`
      const ben = `Ben ${stamp}`
      await openGame(page, "Skyjo")
      await page.getByRole("button", { name: "Log a play" }).click()
      const form = sheet(page)
      await addPlayers(page, [ana, ben])
      await form.getByRole("button", { name: "Use scoresheet" }).click()
      await enter(page, "Round score · round 1", ana, "12")
      await enter(page, "Round score · round 1", ben, "30")
      await form.getByRole("button", { name: "Add round" }).click()
      await enter(page, "Round score · round 2", ana, "-5")
      await enter(page, "Round score · round 2", ben, "3")
      await expect(total(form, ana)).toHaveText("7")
      await expect(total(form, ben)).toHaveText("33")
      await expect(form.getByText(`Calculated: ${ana} wins.`)).toBeVisible()
      await page.screenshot({ path: `${SHOTS}/skyjo-${scheme}.png` })
      await form.getByRole("button", { name: "Save play" }).click()
      await expect(form.getByText("Play saved")).toBeVisible()
      await form.getByRole("button", { name: "Done" }).click()
      const saved = playWith(page, ana)
      await expect(saved.locator(".history-player", { hasText: ana })).toContainText("Won")
      await deletePlayWith(page, ana)
    })

    test("log a co-op Hanabi play with one team score", async ({ page }) => {
      await logIn(page, FREE_EMAIL, LOCAL_PASSWORD)
      const stamp = Date.now().toString(36)
      await openGame(page, "Hanabi")
      await page.getByRole("button", { name: "Log a play" }).click()
      const form = sheet(page)
      const ana = `Ana ${stamp}`
      await addPlayers(page, [ana, `Ben ${stamp}`])
      await form.getByRole("button", { name: "Use scoresheet" }).click()
      await expect(form.getByRole("columnheader", { name: "Team" })).toBeVisible()
      await enter(page, "Red fireworks", "Team", "5")
      await enter(page, "Yellow fireworks", "Team", "5")
      await enter(page, "Green fireworks", "Team", "4")
      await expect(form.getByText("Team score 14 · Respectable")).toBeVisible()
      await form.getByRole("button", { name: "Save play" }).click()
      await expect(form.getByRole("alert")).toContainText("Choose whether the group won.")
      await form.getByLabel("Won", { exact: true }).check({ force: true })
      await page.screenshot({ path: `${SHOTS}/hanabi-${scheme}.png` })
      await form.getByRole("button", { name: "Save play" }).click()
      await expect(form.getByText("Play saved")).toBeVisible()
      await form.getByRole("button", { name: "Done" }).click()
      const saved = playWith(page, ana)
      await expect(saved.locator(".history-player", { hasText: ana })).toContainText("Won")
      await deletePlayWith(page, ana)
    })

    test("build a custom sheet as Pro, use it, then delete it", async ({ page }) => {
      await logIn(page, PRO_EMAIL, LOCAL_PASSWORD)
      const stamp = Date.now().toString(36)
      const ana = `Ana ${stamp}`
      const ben = `Ben ${stamp}`
      const sheetName = `Gem rush ${scheme} ${stamp}`
      await openGame(page, "Lantern Grove")
      await page.getByRole("button", { name: "Log a play" }).click()
      const form = sheet(page)
      await form.getByRole("button", { name: "Build a scoresheet" }).click()

      await expect(form.getByRole("heading", { name: "New scoresheet" })).toBeVisible()
      await form.getByLabel("Name", { exact: true }).fill(sheetName)
      const categories = form.locator(".builder-category")
      await categories.nth(0).getByLabel("Category name").fill("Gems")
      await categories.nth(0).getByLabel("Type").selectOption("count")
      await categories.nth(0).getByLabel("Points each").fill("3")
      await form.getByRole("button", { name: "Add category" }).click()
      await categories.nth(1).getByLabel("Category name").fill("Penalty")
      await categories.nth(1).getByLabel("Points each").fill("-1")
      await form.getByLabel("Most Gems breaks a tie").check()
      // Live preview scores a sample player.
      await enter(page, "Gems", "Player A", "4")
      await expect(total(form, "Player A")).toHaveText("12")
      await page.screenshot({ path: `${SHOTS}/builder-${scheme}.png`, fullPage: true })
      await form.getByRole("button", { name: "Save scoresheet" }).click()

      await expect(form.getByText("Log play", { exact: true })).toBeVisible()
      await expect(form.locator(".scoresheet-head")).toContainText(sheetName)
      await addPlayers(page, [ana, ben])
      await enter(page, "Gems", ana, "4")
      await enter(page, "Gems", ben, "5")
      await enter(page, "Penalty", ben, "4")
      await expect(total(form, ana)).toHaveText("12")
      await expect(total(form, ben)).toHaveText("11")
      await expect(form.getByText(`Calculated: ${ana} wins.`)).toBeVisible()
      await form.getByRole("button", { name: "Save play" }).click()
      await expect(form.getByText("Play saved")).toBeVisible()
      await form.getByRole("button", { name: "Done" }).click()
      const saved = playWith(page, ana)
      await expect(saved.locator(".history-player", { hasText: ana })).toContainText("Won")
      await deletePlayWith(page, ana)

      // Delete the sheet from the builder; the log sheet goes back to plain scores.
      await page.getByRole("button", { name: "Log a play" }).click()
      const picker = form.getByLabel("Scoresheet", { exact: true })
      if (await picker.count()) await picker.selectOption({ label: `${sheetName} (yours)` })
      await form.getByRole("button", { name: "Use scoresheet" }).click()
      await form.getByRole("button", { name: "Edit sheet" }).click()
      await form.getByRole("button", { name: "Delete scoresheet…" }).click()
      await form.getByRole("button", { name: "Delete scoresheet", exact: true }).click()
      await expect(form.getByText("Log play", { exact: true })).toBeVisible()
      await expect(form.getByRole("table")).toHaveCount(0)
      await form.getByRole("button", { name: "Cancel" }).click()
    })
  })
}
