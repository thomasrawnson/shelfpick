import AxeBuilder from "@axe-core/playwright"
import { expect, test, type Page } from "@playwright/test"

import { API_ORIGIN, logIn } from "./support"

// SP-STATS-01: the Stats "Trends" tab for a Free and a Pro account at 390x844
// and 1440x900, light and dark. The accounts, sign-in and entitlements are real
// (local Free and Pro test accounts); the /stats data is mocked so each chart is
// deterministic. The real aggregates are covered by backend/tests/test_stats_postgres.py.
const SHOTS = "../docs/screenshots/sp-stats-01"
const SIZES = [{ label: "390", width: 390, height: 844 }, { label: "1440", width: 1440, height: 900 }] as const
const ACCOUNTS = {
  free: { email: "local-free@shelfpick.app", state: "test-results/.stats-free-auth.json" },
  pro: { email: "local-pro@shelfpick.app", state: "test-results/.stats-pro-auth.json" },
} as const

test.beforeAll(async ({ browser }, testInfo) => {
  if (testInfo.project.name !== "iPhone 15") return
  for (const account of Object.values(ACCOUNTS)) {
    const context = await browser.newContext({ storageState: undefined })
    const page = await context.newPage()
    await logIn(page, account.email)
    await expect(page).toHaveURL(/\/tonight/)
    await context.storageState({ path: account.state })
    await context.close()
  }
})

test.beforeEach(({ browserName }, testInfo) => { test.skip(browserName !== "webkit" || testInfo.project.name !== "iPhone 15") })

const INSIGHTS = {
  total_games: 64, total_plays: 839, played_games_count: 41, historical_played_games_count: 58,
  collection_played_percentage: 64, total_duration_minutes: 41_220, duration_plays: 612, average_duration_minutes: 67,
  most_played: { bgg_id: 1, name: "Clockwork Market", play_count: 61 },
  last_played: { bgg_id: 2, name: "Lantern Grove", played_at: "2026-11-14T19:00:00Z" },
  never_played_count: 23, frequent_players: [], monthly_activity: { plays: 12, unique_games: 7, new_games: 1, repeat_plays: 5, recent_plays: [] },
  neglected_games: [], top_games_by_player: [], common_groups: [],
}

const PLAYERS = [
  { id: 1, name: "Ann", avatar_key: "forest" },
  { id: 2, name: "Bob", avatar_key: "forest" },
  { id: 3, name: "Cleo", avatar_key: "forest" },
]

function monthsFor(count: number) {
  const now = new Date()
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(Date.UTC(now.getFullYear(), now.getMonth() - (count - 1 - index), 1))
    return { month: date.toISOString().slice(0, 7), plays: [3, 5, 2, 8, 11, 6, 0, 4, 9, 12, 7, 5][index % 12] }
  })
}

function heatmapFor(year: number) {
  const days = []
  for (let day = 0; day < 365; day += 3) {
    const date = new Date(Date.UTC(year, 0, 1 + day))
    if (date.getUTCFullYear() !== year) break
    days.push({ date: date.toISOString().slice(0, 10), plays: 1 + (day % 4) })
  }
  return {
    year, days, total_plays: days.reduce((sum, day) => sum + day.plays, 0), active_days: days.length, max_plays_in_day: 4,
  }
}

const H_INDEX = {
  h_index: 7, next_target: 8, games_played: 22, total_plays: 190,
  qualifying_games: [], games_needed: 2, reachable: true, plays_needed_total: 3,
  raise_list: [
    { bgg_id: 11, name: "Clockwork Market", plays: 7, plays_needed: 1 },
    { bgg_id: 12, name: "Lantern Grove", plays: 6, plays_needed: 2 },
  ],
}
const STREAK = { current_weeks: 5, best_weeks: 9, played_this_week: false, at_risk: true, this_week_start: "2026-11-16" }
const RECORDS = {
  games: [
    { bgg_id: 11, name: "Clockwork Market", scored_plays: 14, best: 128, average: 94.5, lowest: 61, highest_losing: 117, best_category: { label: "Coins", points: 36 } },
    { bgg_id: 12, name: "Lantern Grove", scored_plays: 9, best: 71, average: 55, lowest: 38, highest_losing: null, best_category: null },
  ],
}
const HEAD_TO_HEAD = {
  player_a: 1, player_b: 2, plays_together: 12, versus_plays: 9, wins_a: 5, wins_b: 3, draws: 1, undecided: 0,
  coop_plays: 2, coop_won: 1, coop_lost: 1, same_team_plays: 1,
  recent: [{ play_id: 9, played_at: "2026-11-10T19:00:00Z", bgg_id: 11, game: "Clockwork Market", kind: "versus", result: "a", coop_result: null }],
}
const OPTIONS = { locations: [{ name: "Home", plays: 40 }, { name: "Cafe", plays: 9 }], player_counts: [2, 3, 4], first_play: "2024-01-05", last_play: "2026-11-10" }

type Seen = { paths: string[]; urls: URL[] }

async function mockStats(page: Page): Promise<Seen> {
  const seen: Seen = { paths: [], urls: [] }
  await page.route(/\/insights(\?.*)?$/, route => route.fulfill({ json: INSIGHTS }))
  await page.route(/\/rankings\?/, route => route.fulfill({ json: { rankings: [], unplayed: [], summary: { games_count: 64, designers: [], publishers: [], mechanics: [], categories: [] } } }))
  await page.route(/\/players(\?.*)?$/, route => route.fulfill({ json: PLAYERS }))
  // Only the API origin: the dev server also serves /src/components/stats/*.
  await page.route(`${API_ORIGIN}/stats/**`, route => {
    const url = new URL(route.request().url())
    const name = url.pathname.split("/").pop()!
    seen.paths.push(name)
    seen.urls.push(url)
    const months = Number(url.searchParams.get("months") ?? 12)
    const json: Record<string, unknown> = {
      "plays-per-month": { months: monthsFor(months), total_plays: monthsFor(months).reduce((sum, month) => sum + month.plays, 0) },
      heatmap: heatmapFor(Number(url.searchParams.get("year"))),
      "h-index": H_INDEX,
      streak: STREAK,
      records: RECORDS,
      "head-to-head": HEAD_TO_HEAD,
      "filter-options": OPTIONS,
    }
    return route.fulfill({ json: json[name] })
  })
  return seen
}

async function openTrends(page: Page) {
  await page.goto("/stats")
  await expect(page.getByRole("heading", { level: 1, name: "Stats" })).toBeVisible()
  await expect(page.getByRole("heading", { level: 2, name: "Trends" })).toBeVisible()
  await expect(page.getByRole("heading", { name: "Play calendar" })).toBeVisible()
  await expect(page.getByRole("img", { name: /^Calendar of plays in \d{4}\./ })).toBeVisible()
  await page.waitForLoadState("networkidle")
}

for (const account of ["free", "pro"] as const) {
  test.describe(`${account} account`, () => {
    test.use({ storageState: ACCOUNTS[account].state })

    for (const size of SIZES) {
      for (const scheme of ["light", "dark"] as const) {
        test(`${size.label} ${scheme}: Trends`, async ({ page }, testInfo) => {
          await page.setViewportSize({ width: size.width, height: size.height })
          await page.emulateMedia({ colorScheme: scheme, reducedMotion: "reduce" })
          const seen = await mockStats(page)
          await openTrends(page)

          // Free for everyone: streak, H-index with its list, chart and calendar.
          await expect(page.getByText("Week streak", { exact: true })).toBeVisible()
          await expect(page.getByText("Play this week to keep it going · Best 9")).toBeVisible()
          await expect(page.locator(".stat-card", { hasText: "H-index" }).getByText("7", { exact: true })).toBeVisible()
          await expect(page.getByRole("heading", { name: "Play these to reach 8" })).toBeVisible()
          await expect(page.getByRole("button", { name: /Clockwork Market.*1 more play/ })).toBeVisible()
          await expect(page.getByRole("img", { name: /^Plays per month\. .*plays in the last 12 months/ })).toBeVisible()

          // Equivalent table for the chart and the calendar.
          const chartTable = page.locator(".stats-chart-table").first()
          await chartTable.locator("summary").click()
          await expect(chartTable.getByRole("table", { name: "Plays per month" })).toBeVisible()
          await expect(chartTable.getByRole("row")).toHaveCount(13)
          await page.getByRole("button", { name: "24 months" }).click()
          await expect(page.getByRole("img", { name: /last 24 months/ })).toBeVisible()
          await chartTable.locator("summary").click() // the chart remounts when the range changes
          await expect(chartTable.getByRole("row")).toHaveCount(25)

          const heatTable = page.locator(".stats-heatmap .stats-chart-table")
          await heatTable.locator("summary").click()
          await expect(heatTable.getByRole("table")).toBeVisible()
          await expect(page.getByRole("region", { name: /^Calendar heatmap for \d{4}$/ })).toBeVisible()

          if (account === "free") {
            await expect(page.getByText("Included with Pro", { exact: true })).toBeVisible()
            await expect(page.getByRole("button", { name: "See what Pro includes" })).toBeVisible()
            await expect(page.getByText("Filters", { exact: true }).first()).toBeVisible() // inside the locked preview copy
            await expect(page.getByRole("group", { name: "Filters" })).toHaveCount(0)
            await expect(page.getByRole("heading", { name: "Score records" })).toHaveCount(0)
            // Free never asks the server for Pro data or sends a filter.
            expect(seen.paths).not.toContain("records")
            expect(seen.paths).not.toContain("head-to-head")
            expect(seen.paths).not.toContain("filter-options")
            for (const url of seen.urls) {
              for (const key of ["date_from", "date_to", "player_id", "location", "player_count"]) expect(url.searchParams.has(key)).toBe(false)
            }
          } else {
            await expect(page.getByText("Included with Pro", { exact: true })).toHaveCount(0)
            await expect(page.getByRole("heading", { name: "Score records" })).toBeVisible()
            await expect(page.getByRole("heading", { name: "Clockwork Market" }).first()).toBeVisible()
            await expect(page.getByText("Coins (36)")).toBeVisible()
            await expect(page.getByRole("heading", { name: "Head-to-head" })).toBeVisible()
            await page.getByLabel("First player").selectOption({ label: "Ann" })
            await page.getByLabel("Second player").selectOption({ label: "Bob" })
            await expect(page.getByText("Ann 5, Bob 3, 1 draw. 2 co-op plays together (1 won, 1 lost). 1 play as teammates.")).toBeAttached()
            await expect(page.getByText("Co-op together: 2 plays (1 won, 1 lost). Not counted above.")).toBeVisible()

            // A filter narrows every Trends request.
            await page.locator(".stats-filters summary").click()
            await page.getByLabel("Location").selectOption("Cafe")
            await expect.poll(() => seen.urls.some(url => url.pathname.endsWith("/streak") && url.searchParams.get("location") === "Cafe")).toBe(true)
            await expect.poll(() => seen.urls.some(url => url.pathname.endsWith("/records") && url.searchParams.get("location") === "Cafe")).toBe(true)
            await expect(page.getByRole("button", { name: "Clear filters" })).toBeVisible()
          }

          // No sideways scrolling of the page; wide content scrolls inside its own region.
          const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
          expect(overflow).toBeLessThanOrEqual(0)

          const violations = (await new AxeBuilder({ page }).include(".trends-panel").withRules(["color-contrast"]).analyze()).violations
          expect(violations.map(violation => `${violation.id}: ${violation.nodes.map(node => node.target.join(" ")).join(", ")}`)).toEqual([])

          await page.screenshot({ path: `${SHOTS}/stats-trends-${account}-${size.label}-${scheme}.png`, fullPage: true })
          testInfo.annotations.push({ type: "evidence", description: "Playwright WebKit, mocked /stats data, real local account" })
        })
      }
    }
  })
}

test.describe("Picker: Help my H-index", () => {
  test.use({ viewport: { width: 390, height: 844 } })

  async function openFineTune(page: Page) {
    await page.goto("/tonight")
    await page.locator("summary", { hasText: "Fine-tune" }).click()
  }

  test("Free account does not see the option", async ({ browser }) => {
    const context = await browser.newContext({ storageState: ACCOUNTS.free.state, viewport: { width: 390, height: 844 } })
    const page = await context.newPage()
    await openFineTune(page)
    await expect(page.getByText("Pick style")).toBeVisible()
    await expect(page.getByRole("button", { name: "Help my H-index" })).toHaveCount(0)
    await context.close()
  })

  test("Pro account can turn it on", async ({ browser }) => {
    const context = await browser.newContext({ storageState: ACCOUNTS.pro.state, viewport: { width: 390, height: 844 } })
    const page = await context.newPage()
    await openFineTune(page)
    const toggle = page.getByRole("button", { name: "Help my H-index" })
    await expect(toggle).toHaveAttribute("aria-pressed", "false")
    await toggle.click()
    await expect(toggle).toHaveAttribute("aria-pressed", "true")
    await expect(page.getByText("1 preference applied").first()).toBeVisible()
    await page.getByRole("button", { name: "Clear" }).click()
    await expect(toggle).toHaveAttribute("aria-pressed", "false")
    await context.close()
  })
})
