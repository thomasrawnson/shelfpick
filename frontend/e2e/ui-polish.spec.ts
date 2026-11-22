import { expect, test, type Locator, type Page } from "@playwright/test"

import { logIn, ANALYTICS_ANSWERED } from "./support"
import { GAMES, avatarCollisions, mockShelf } from "./ui-fixtures"

// SP-UI-02: compact Log play sheet and Tonight's pick at 390x844, light and dark.
const SHOTS = "../docs/screenshots/sp-ui-02"
const AUTH_STATE = "test-results/.ui-polish-auth.json"
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

const GAME = GAMES[0]
const PEOPLE = [
  { id: 1, name: "Tom", avatar_key: "forest" },
  { id: 2, name: "Wales", avatar_key: "gold" },
  { id: 3, name: "Sister", avatar_key: "forest" },
  { id: 4, name: "Ann", avatar_key: "gold" },
  { id: 5, name: "Bob", avatar_key: "forest" },
]

function scoredPlay(id: number, rows: Array<[string, number, boolean]>) {
  return {
    id, played_at: `2026-10-${String(id).padStart(2, "0")}T18:00:00Z`, player_count: rows.length,
    duration_minutes: 60, location: "Sheepfold Home", source: "app", outcome_type: "competitive", coop_result: null,
    participants: rows.map(([name, score, is_winner], index) => ({
      id: index + 1, name, score, is_winner, outcome: is_winner ? "win" : "loss", team: null, rank: null, role: null,
    })),
  }
}

const HISTORY = [
  scoredPlay(1, [["Tom", 77, true], ["Wales", 60, false], ["Sister", 52, false]]),
  scoredPlay(2, [["Tom", 41, false], ["Wales", 75, true], ["Sister", 36, false]]),
  scoredPlay(3, [["Tom", 47, false], ["Wales", 45, false], ["Sister", 77, true]]),
]

async function mockLogging(page: Page) {
  await mockShelf(page)
  await page.route(/\/players$/, (route) => route.fulfill({ json: PEOPLE }))
  await page.route(/\/games\/\d+\/plays/, (route) => route.fulfill({
    json: { bgg_id: GAME.bgg_id, play_count: HISTORY.length, last_played_at: HISTORY[0].played_at, average_players: 3, average_duration_minutes: 60, recent_plays: HISTORY },
  }))
  await page.route(/\/plays\?limit=1&/, (route) => route.fulfill({ json: { total: 1, plays: [{ ...HISTORY[0], bgg_id: GAME.bgg_id }] } }))
}

async function openLogPlay(page: Page) {
  await page.goto("/plays")
  await page.getByRole("button", { name: "Log play" }).click()
  await page.getByRole("button", { name: GAME.name }).click()
  const sheet = page.getByRole("dialog", { name: GAME.name })
  await expect(sheet).toBeVisible()
  return sheet
}

// Fully on screen and clear of the floating tab bar, when it is shown.
function inViewport(page: Page, locator: Locator) {
  return locator.evaluate((element) => {
    const box = element.getBoundingClientRect()
    const nav = document.querySelector<HTMLElement>(".app-nav")
    const navTop = nav && getComputedStyle(nav).display !== "none" ? nav.getBoundingClientRect().top : window.innerHeight
    return box.top >= 0 && box.left >= 0 && box.bottom <= Math.min(window.innerHeight, navTop) && box.right <= window.innerWidth
  })
}

// Every text control fits: no element's content is wider than its box.
async function overflowingControls(sheet: Locator) {
  return sheet.evaluate((root) => Array.from(root.querySelectorAll<HTMLElement>("button, input, select, label, .play-summary-text, h2"))
    .filter((element) => element.offsetParent !== null && !element.classList.contains("play-summary-text") && element.scrollWidth > element.clientWidth + 1)
    .map((element) => element.outerHTML.slice(0, 80)))
}

for (const scheme of ["light", "dark"] as const) {
  test(`Log play: three players fit with Save visible (${scheme})`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: "reduce" })
    await mockLogging(page)
    const sheet = await openLogPlay(page)

    // No tab bar behind the sheet, Cancel and Save in the header.
    await expect(page.getByRole("navigation", { name: "Primary" })).toBeHidden()
    await expect(sheet.getByRole("button", { name: "Cancel" })).toBeVisible()

    // Recent-player chips add rows; no empty name boxes by default.
    await expect(sheet.getByPlaceholder("Player name")).toHaveCount(0)
    for (const name of ["Tom", "Wales", "Sister"]) await sheet.getByRole("button", { name: `Add ${name}` }).click()
    await expect(sheet.locator(".play-row")).toHaveCount(3)

    // Last used location fills the summary line; records show per player and in the footer.
    await expect(sheet.locator(".play-summary-text")).toContainText("Sheepfold Home")
    await expect(sheet.getByText("best 77").first()).toBeVisible()
    await expect(sheet.locator(".play-records")).toContainText("Best 3p: 77")

    // Scores decide the winner.
    await sheet.getByLabel("Score for Tom").fill("70")
    await sheet.getByLabel("Score for Wales").fill("75")
    await sheet.getByLabel("Score for Sister").fill("61")
    await expect(sheet.getByRole("button", { name: "Wales won" })).toHaveAttribute("aria-pressed", "true")
    await expect(sheet.getByRole("button", { name: "Tom won" })).toHaveAttribute("aria-pressed", "false")

    const save = sheet.getByRole("button", { name: "Save play" })
    await page.locator(":focus").blur()
    expect(await inViewport(page, save)).toBe(true)
    for (let index = 0; index < 3; index += 1) expect(await inViewport(page, sheet.locator(".play-row").nth(index))).toBe(true)
    expect(await overflowingControls(sheet)).toEqual([])
    await page.screenshot({ path: `${SHOTS}/checkpoint/log-play-3p-390-${scheme}.png` })

    await sheet.getByLabel("Score for Sister").focus()
    await page.screenshot({ path: `${SHOTS}/checkpoint/log-play-3p-score-focused-390-${scheme}.png` })

    // Manual override replaces the score-based winner.
    await sheet.getByRole("button", { name: "Tom won" }).click()
    await expect(sheet.getByRole("button", { name: "Tom won" })).toHaveAttribute("aria-pressed", "true")
    await expect(sheet.getByText("Winner chosen by hand.")).toBeVisible()

    // Details open from the summary line without overflowing the sheet.
    await sheet.locator(".play-summary-button").click()
    await expect(sheet.getByRole("textbox", { name: "Date" })).toBeVisible()
    expect(await overflowingControls(sheet)).toEqual([])
    const overflow = await sheet.evaluate((root) => root.scrollWidth - root.clientWidth)
    expect(overflow).toBeLessThanOrEqual(0)

    await sheet.getByRole("button", { name: "Cancel" }).click()
    await expect(sheet).toBeHidden()
    await expect(page.getByRole("navigation", { name: "Primary" })).toBeVisible()
  })
}

test("Log play: score boxes line up with and without a record; date and minutes align", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" })
  await mockLogging(page)
  const sheet = await openLogPlay(page)
  // Tom has a record for this game; Ann has none.
  for (const name of ["Tom", "Ann", "Wales"]) await sheet.getByRole("button", { name: `Add ${name}` }).click()
  const lefts = await sheet.locator(".play-row-score").evaluateAll((inputs) => inputs.map((input) => Math.round(input.getBoundingClientRect().left)))
  expect(new Set(lefts).size, `score boxes start at ${lefts.join(", ")}`).toBe(1)
  await sheet.locator(".play-summary-button").click()
  const date = await sheet.getByRole("textbox", { name: "Date" }).boundingBox()
  const minutes = await sheet.getByRole("spinbutton", { name: "Minutes" }).boundingBox()
  expect(Math.abs(date!.y - minutes!.y)).toBeLessThanOrEqual(1)
  expect(Math.abs(date!.height - minutes!.height)).toBeLessThanOrEqual(1)
  await page.screenshot({ path: `${SHOTS}/after/log-play-aligned-390-dark.png` })
})

test("Tonight Fine-tune content is inset like its header", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await mockPicker(page)
  await page.goto("/tonight")
  await page.getByText("Fine-tune").click()
  const panel = await page.locator(".advanced-filters").boundingBox()
  const label = await page.getByText("Pick style").boundingBox()
  expect(label!.x - panel!.x).toBeGreaterThanOrEqual(12)
  await page.getByText("Pick style").scrollIntoViewIfNeeded()
  await page.screenshot({ path: `${SHOTS}/after/tonight-fine-tune-390-light.png` })
})

test("Log play: saving sends places from the scores", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await mockLogging(page)
  let body: { participants: Array<{ name: string; rank: number | null; is_winner: boolean }> } | null = null
  await page.route(/\/plays$/, async (route) => {
    if (route.request().method() !== "POST") return route.fallback()
    body = route.request().postDataJSON()
    return route.fulfill({ json: { id: 999, bgg_id: GAME.bgg_id, player_count: 3, played_at: new Date().toISOString() } })
  })
  const sheet = await openLogPlay(page)
  for (const name of ["Tom", "Wales"]) await sheet.getByRole("button", { name: `Add ${name}` }).click()
  await sheet.getByLabel("Add player").fill("Guest")
  await sheet.getByLabel("Add player").press("Enter")
  await sheet.getByLabel("Score for Tom").fill("70")
  await sheet.getByLabel("Score for Wales").fill("70")
  await sheet.getByLabel("Score for Guest").fill("50")
  await sheet.getByRole("button", { name: "Save play" }).click()
  await expect(sheet.getByText("Play saved")).toBeVisible()
  expect(body!.participants.map((p) => [p.name, p.rank, p.is_winner])).toEqual([
    ["Tom", 1, true], ["Wales", 1, true], ["Guest", 3, false],
  ])
})

const MATCHES = GAMES.slice(0, 3).map((game, index) => ({
  game,
  score: [92, 71, 48][index],
  reasons: ["Supports 3 players", "Fits in your time", "Medium weight you enjoy", "Not played for a while"],
  ai_used: false,
  ai_explanation: null,
}))

async function mockPicker(page: Page) {
  await mockShelf(page)
  await page.route(/\/picker\/options/, (route) => route.fulfill({ json: { categories: [], mechanics: [] } }))
  await page.route(/\/picker\?/, (route) => route.fulfill({ json: { matches: MATCHES, guidance: null, session_id: "s1" } }))
  await page.route(/\/picker\/events/, (route) => route.fulfill({ json: {} }))
  // No saved group size, so Tonight starts with nothing chosen.
  await page.route(/\/auth\/me$/, async (route) => {
    const response = await route.fetch()
    return route.fulfill({ response, json: { ...(await response.json()), preferred_player_count: null } })
  })
}

const STAGE = process.env.SP_UI_02_STAGE ?? "after"

for (const scheme of ["light", "dark"] as const) {
  test(`Tonight: no player-count hint, Time step and pick fit without scrolling (${scheme})`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: "reduce" })
    await mockPicker(page)
    await page.goto("/tonight")
    const find = page.getByRole("button", { name: "Find a game" })
    await expect(find).toBeDisabled()
    await page.screenshot({ path: `${SHOTS}/${STAGE}/tonight-players-390-${scheme}.png` })
    if (STAGE === "after") await expect(page.getByText("Choose your player count")).toHaveCount(0)
    await page.getByRole("button", { name: "3 players" }).click()
    await find.click()

    // Time step: primary action visible without scrolling.
    await expect(page.getByRole("heading", { name: /How much time/ })).toBeVisible()
    await page.getByRole("button", { name: /Standard/ }).click()
    const timeAction = page.getByRole("button", { name: "Find a game" })
    expect(await inViewport(page, timeAction)).toBe(true)
    if (STAGE === "after") expect(await avatarCollisions(page)).toEqual([])
    await page.screenshot({ path: `${SHOTS}/${STAGE}/tonight-time-390-${scheme}.png` })
    await timeAction.click()

    // Tonight's pick: title, details and primary action together.
    const title = page.getByRole("heading", { name: GAMES[0].name })
    await expect(title).toBeVisible()
    await page.waitForTimeout(300)
    const action = page.getByRole("button", { name: "Log a play" })
    if (STAGE === "after") {
      expect(await inViewport(page, action)).toBe(true)
      expect(await inViewport(page, title)).toBe(true)
      await expect(page.locator(".picker-result-score")).toHaveText("Great fit")
      expect(await avatarCollisions(page)).toEqual([])
    }
    await page.screenshot({ path: `${SHOTS}/${STAGE === "after" ? "checkpoint" : STAGE}/tonight-pick-390-${scheme}.png` })
  })
}
