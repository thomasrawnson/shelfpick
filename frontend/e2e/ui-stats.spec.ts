import { expect, test, type Page } from "@playwright/test"

import { logIn } from "./support"

// SP-UI-02: Stats tab sections and the Year in Review story at 390x844, light and dark.
// Every Stats request is mocked so the screens are deterministic.
const SHOTS = "../docs/screenshots/sp-ui-02/after"
const AUTH_STATE = "test-results/.ui-stats-auth.json"
test.use({ storageState: AUTH_STATE, viewport: { width: 390, height: 844 } })

test.beforeAll(async ({ browser }, testInfo) => {
  if (testInfo.project.name !== "iPhone 15") return
  const context = await browser.newContext({ storageState: undefined })
  const page = await context.newPage()
  await logIn(page, "local-free@shelfpick.app")
  await expect(page).toHaveURL(/\/tonight/)
  await context.storageState({ path: AUTH_STATE })
  await context.close()
})

test.beforeEach(({ browserName }, testInfo) => { test.skip(browserName !== "webkit" || testInfo.project.name !== "iPhone 15") })

const INSIGHTS = {
  total_games: 64, total_plays: 839, played_games_count: 41, historical_played_games_count: 58,
  collection_played_percentage: 64, total_duration_minutes: 41_220, duration_plays: 612, average_duration_minutes: 67,
  most_played: { bgg_id: 1, name: "Clockwork Market", play_count: 61 },
  last_played: { bgg_id: 2, name: "Lantern Grove", played_at: "2026-11-14T19:00:00Z" },
  never_played_count: 23,
  frequent_players: [
    { id: 1, name: "Tom", play_count: 802, win_count: 301 },
    { id: 2, name: "Wales", play_count: 512, win_count: 190 },
    { id: 3, name: "Sister", play_count: 140, win_count: 0 },
  ],
  monthly_activity: { plays: 12, unique_games: 7, new_games: 1, repeat_plays: 5, recent_plays: [] },
  neglected_games: [
    { bgg_id: 7, name: "Ember Vale", play_count: 0, last_played_at: null },
    { bgg_id: 8, name: "Quiet Archive", play_count: 0, last_played_at: null },
  ],
  top_games_by_player: [
    { player_id: 1, player_name: "Tom", bgg_id: 1, game_name: "Clockwork Market", play_count: 58 },
    { player_id: 2, player_name: "Wales", bgg_id: 2, game_name: "Lantern Grove", play_count: 31 },
  ],
  common_groups: [
    { player_ids: [1, 2], player_names: ["Tom", "Wales"], play_count: 402 },
    { player_ids: [1, 2, 3], player_names: ["Tom", "Wales", "Sister"], play_count: 96 },
  ],
}

const EMPTY_SUMMARY = { games_count: 64, designers: [], publishers: [], mechanics: [], categories: [] }

const MONTH = {
  month: "2026-11", month_label: "November 2026", total_plays: 3, unique_games: 3,
  total_duration_minutes: 150, duration_plays: 2,
  most_played: { bgg_id: 1, name: "Clockwork Market", play_count: 1, image_url: null },
  collage_games: [],
}

const YEAR = {
  year: 2026, total_plays: 87, unique_games: 23, total_duration_minutes: 4310, duration_plays: 87,
  top_games: [
    { bgg_id: 1, name: "Clockwork Market", play_count: 14 },
    { bgg_id: 2, name: "Lantern Grove", play_count: 11 },
    { bgg_id: 3, name: "Harbour Council", play_count: 9 },
  ],
  new_games_count: 9, new_games: [{ bgg_id: 4, name: "Tiny Orchard", play_count: 7 }],
  plays_by_month: [4, 5, 6, 7, 9, 8, 6, 5, 12, 11, 8, 6], busiest_month: 9,
  plays_by_weekday: [3, 4, 5, 6, 12, 40, 17], busiest_weekday: 6,
  longest_play: { bgg_id: 1, name: "Clockwork Market", duration_minutes: 195, played_on: "2026-03-14" },
  co_players: [{ name: "Ann", play_count: 41 }],
}

async function mockStats(page: Page) {
  await page.route(/\/insights(\?.*)?$/, route => route.fulfill({ json: INSIGHTS }))
  await page.route(/\/rankings\?/, route => route.fulfill({ json: { rankings: [], unplayed: [], summary: EMPTY_SUMMARY } }))
  await page.route("**/insights/monthly-recap**", route => route.fulfill({ json: MONTH }))
  await page.route("**/insights/year-recap**", route => route.fulfill({ json: YEAR }))
}

async function openSection(page: Page, name: string) {
  const tab = page.getByRole("group", { name: "Stats sections" }).getByRole("button", { name, exact: true })
  await tab.click()
  await expect(tab).toHaveAttribute("aria-pressed", "true")
  await page.waitForLoadState("networkidle")
}

for (const scheme of ["light", "dark"] as const) {
  test(`${scheme}: Stats sections`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: "reduce" })
    await mockStats(page)
    await page.goto("/stats")
    await expect(page.getByRole("heading", { level: 1, name: "Stats" })).toBeVisible()

    await page.waitForLoadState("networkidle")
    await expect(page.getByRole("link", { name: /Sync collection/ })).toBeVisible()
    await expect(page.getByText("Shelf leaders")).toHaveCount(0)
    await page.screenshot({ path: `${SHOTS}/stats-collection-390-${scheme}.png`, fullPage: true })

    await openSection(page, "Play")
    await expect(page.getByText("All time")).toBeVisible()
    await expect(page.getByText("Timed on 612 of 839 plays")).toBeVisible()
    await page.screenshot({ path: `${SHOTS}/stats-play-390-${scheme}.png`, fullPage: true })

    await openSection(page, "Players")
    await expect(page.getByRole("columnheader", { name: "Win rate" })).toBeVisible()
    await expect(page.getByRole("row", { name: /Tom/ }).getByText("38%")).toBeVisible()
    await expect(page.getByRole("row", { name: /Sister/ }).getByText("0%")).toBeVisible()
    await expect(page.getByText("marked winner")).toHaveCount(0)
    await expect(page.getByRole("heading", { name: "Favourite game" })).toBeVisible()
    await page.screenshot({ path: `${SHOTS}/stats-players-390-${scheme}.png`, fullPage: true })

    await openSection(page, "Recaps")
    await expect(page.getByText("3 different games")).toBeVisible()
    for (const name of ["Previous month", "Next month"]) {
      const box = await page.getByRole("button", { name }).boundingBox()
      expect(box!.width).toBeGreaterThanOrEqual(44)
      expect(box!.height).toBeGreaterThanOrEqual(44)
    }
    await page.screenshot({ path: `${SHOTS}/stats-recaps-390-${scheme}.png`, fullPage: true })

    await page.getByRole("button", { name: "View my year" }).click()
    const story = page.getByRole("dialog", { name: /Year in Review$/ })
    await expect(story).toBeVisible()
    const slides = Number((await story.getByText(/^Slide 1 of \d+$/).textContent())!.match(/of (\d+)/)![1])
    await expect(story.locator(".year-story-progress > span")).toHaveCount(slides)
    // Every play is timed, so the coverage note is hidden.
    await expect(story.getByText(/Timed on/)).toHaveCount(0)
    const previous = await story.getByRole("button", { name: "Previous", exact: true }).boundingBox()
    const next = await story.getByRole("button", { name: "Next", exact: true }).boundingBox()
    expect(previous!.height).toBe(next!.height)
    await page.screenshot({ path: `${SHOTS}/stats-year-story-390-${scheme}.png` })
  })
}
