import { expect, test, type Page } from "@playwright/test"

import { logIn } from "./support"

// SP-UI-01 checkpoint: Tonight and Shelf at 390x844, light and dark.
// Shelf covers are synthetic (generated SVG) so the grid can be judged without
// using third-party artwork; the real app shows BGG covers.
const SHOTS = "../docs/screenshots/sp-ui-01/checkpoint"

const palette = ["#315C48", "#C28B37", "#356A7A", "#B7463C", "#6B4E9B", "#3F7655", "#A66D16", "#2F4858"]
function cover(index: number, label: string): string {
  const color = palette[index % palette.length]
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><rect width="400" height="400" fill="${color}"/><circle cx="300" cy="110" r="90" fill="#fff" opacity=".18"/></svg>`
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}
const NAMES = ["Clockwork Market", "Lantern Grove", "Harbour Council", "Tiny Orchard", "Night Courier", "Salt and Sail", "Ember Vale", "Quiet Archive"]

async function mockShelf(page: Page) {
  const games = NAMES.map((name, index) => ({
    id: index + 1, bgg_id: 1000 + index, name, year_published: 2020 + (index % 6),
    min_players: 1 + (index % 2), max_players: 4 + (index % 3), min_play_time: 20, max_play_time: 30 + index * 10,
    complexity: 1.5 + index / 5, rating: 7 + index / 10, thumbnail_url: cover(index, name), image_url: cover(index, name),
    owned: true, is_expansion: false, mechanics: [], categories: [],
  }))
  await page.route(/\/games(\?.*)?$/, route => route.fulfill({ json: games }))
  await page.route("**/collection/stats**", route => route.fulfill({
    json: games.map((game, index) => ({ bgg_id: game.bgg_id, play_count: [14, 0, 9, 3, 0, 7, 1, 0][index], last_played_at: [ "2026-11-16", null, "2026-11-10", "2026-10-30", null, "2026-11-12", "2026-09-01", null ][index] })),
  }))
}

test.use({ viewport: { width: 390, height: 844 } })
test.beforeEach(({ browserName }, testInfo) => { test.skip(browserName !== "webkit" || testInfo.project.name !== "iPhone 15") })

for (const scheme of ["light", "dark"] as const) {
  test(`checkpoint ${scheme}: Tonight and Shelf`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: "reduce" })
    await mockShelf(page)
    await logIn(page, "local-free@shelfpick.app")
    await expect(page).toHaveURL(/\/tonight/)
    await page.waitForLoadState("networkidle")
    await page.screenshot({ path: `${SHOTS}/tonight-${scheme}.png` })
    await page.goto("/tonight?mode=vote")
    await page.waitForLoadState("networkidle")
    await page.screenshot({ path: `${SHOTS}/tonight-vote-${scheme}.png` })
    await page.goto("/shelf")
    await expect(page.getByRole("heading", { name: "Shelf" })).toBeVisible()
    await page.waitForLoadState("networkidle")
    await page.screenshot({ path: `${SHOTS}/shelf-grid-${scheme}.png` })
    await page.getByRole("button", { name: "Show as list" }).click()
    await page.screenshot({ path: `${SHOTS}/shelf-list-${scheme}.png` })
    await page.getByRole("button", { name: "Show as grid" }).click()
  })
}
