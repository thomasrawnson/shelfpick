import type { Page } from "@playwright/test"

// Synthetic sample data (generated SVG covers) so screens can be judged without
// third-party artwork. The real app shows BGG covers.
const palette = ["#315C48", "#C28B37", "#356A7A", "#B7463C", "#6B4E9B", "#3F7655", "#A66D16", "#2F4858"]
export function cover(index: number): string {
  const color = palette[index % palette.length]
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><rect width="400" height="400" fill="${color}"/><circle cx="300" cy="110" r="90" fill="#fff" opacity=".18"/></svg>`
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}
export const NAMES = ["Clockwork Market", "Lantern Grove", "Harbour Council", "Tiny Orchard", "Night Courier", "Salt and Sail", "Ember Vale", "Quiet Archive"]
const PLAY_COUNTS = [14, 0, 9, 3, 0, 7, 1, 0]
const LAST_PLAYED = ["2026-11-16", null, "2026-11-10", "2026-10-30", null, "2026-11-12", "2026-09-01", null]
const PEOPLE = ["Ann", "Bob", "Cleo", "Dev"]

export const GAMES = NAMES.map((name, index) => ({
  id: index + 1, bgg_id: 1000 + index, name, year_published: 2020 + (index % 6),
  min_players: 1 + (index % 2), max_players: 4 + (index % 3), min_play_time: 20, max_play_time: 30 + index * 10,
  complexity: 1.5 + index / 5, rating: 7 + index / 10, thumbnail_url: cover(index), image_url: cover(index),
  owned: true, is_expansion: false, mechanics: [], categories: [],
}))

function historyFor(index: number) {
  const count = PLAY_COUNTS[index]
  const recent = Array.from({ length: Math.min(count, 3) }, (_, n) => {
    const day = 16 - n * 6 - index
    const winner = PEOPLE[(index + n) % PEOPLE.length]
    return {
      id: index * 10 + n + 1, played_at: `2026-${day > 0 ? "11" : "10"}-${String(day > 0 ? day : day + 28).padStart(2, "0")}T18:00:00Z`,
      player_count: 3, duration_minutes: 40 + index * 5, location: null, source: "app",
      outcome_type: "competitive", coop_result: null,
      participants: PEOPLE.slice(0, 3).map((name, p) => ({ id: p + 1, name, score: null, is_winner: name === winner, outcome: name === winner ? "win" : "loss", team: null, rank: null, role: null })),
    }
  })
  return { bgg_id: 1000 + index, play_count: count, last_played_at: LAST_PLAYED[index], average_players: 3, average_duration_minutes: 45, recent_plays: recent }
}

export async function mockShelf(page: Page) {
  await page.route(/\/games(\?.*)?$/, route => route.fulfill({ json: GAMES }))
  await page.route("**/collection/stats**", route => route.fulfill({
    json: GAMES.map((game, index) => ({ bgg_id: game.bgg_id, play_count: PLAY_COUNTS[index], last_played_at: LAST_PLAYED[index] })),
  }))
  await page.route(/\/games\/(\d+)\/plays$/, route => {
    const id = Number(route.request().url().match(/games\/(\d+)\/plays/)![1])
    return route.fulfill({ json: historyFor(id - 1000) })
  })
}
