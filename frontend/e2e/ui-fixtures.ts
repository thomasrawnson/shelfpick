import type { Page } from "@playwright/test"

// Synthetic sample data (generated SVG covers) so screens can be judged without
// third-party artwork. The real app shows BGG covers.
const palette = ["#315C48", "#C28B37", "#356A7A", "#B7463C", "#6B4E9B", "#3F7655", "#A66D16", "#2F4858"]
export function cover(index: number): string {
  const color = palette[index % palette.length]
  // The last game has a tall box, to check awkward cover proportions.
  const tall = index === 8
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${tall ? 260 : 400}" height="${tall ? 480 : 400}"><rect width="100%" height="100%" fill="${color}"/><circle cx="300" cy="110" r="90" fill="#fff" opacity=".18"/></svg>`
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}
export const NAMES = ["Clockwork Market", "Lantern Grove", "Harbour Council", "Tiny Orchard", "Night Courier", "Salt and Sail", "Ember Vale", "Quiet Archive", "The Very Long Titled Expedition of the Northern Lights Cartographers"]
const PLAY_COUNTS = [14, 0, 9, 3, 0, 7, 1, 0, 2]
const LAST_PLAYED = ["2026-11-16", null, "2026-11-10", "2026-10-30", null, "2026-11-12", "2026-09-01", null, "2026-08-20"]
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
  await page.route(/\/plays\?/, route => {
    const plays = GAMES.flatMap((_, index) => historyFor(index).recent_plays.map(play => ({ ...play, bgg_id: 1000 + index })))
    return route.fulfill({ json: { total: plays.length, plays } })
  })
}

// Discover feed with enough cards to scroll, for layout checks.
export async function mockDiscover(page: Page) {
  const recommendations = GAMES.map((game, index) => ({
    game: { ...game, owned: false }, score: 90 - index * 4, reasons: ["Popular this week", "Plays well at 3"],
    wishlisted: index === 1, source_rank: index + 1, section: null,
  }))
  await page.route(/\/discover\?/, route => route.fulfill({ json: recommendations }))
}

// Controls and headings whose box meets the avatar's box.
export function avatarCollisions(page: Page) {
  return page.evaluate(() => {
    const avatar = document.querySelector(".app-top-bar .dice-menu-button")
    if (!avatar) return ["no avatar"]
    const a = avatar.getBoundingClientRect()
    const meets = (b: DOMRect) => b.width > 0 && b.height > 0 && b.left < a.right && b.right > a.left && b.top < a.bottom && b.bottom > a.top
    return Array.from(document.querySelectorAll<HTMLElement>(".app-content :is(button, a[href], input, select, h1, h2, [role=tab])"))
      .filter((element) => {
        if (getComputedStyle(element).visibility === "hidden") return false
        // Headings are measured by their text, not their full-width block.
        if (/^H[12]$/.test(element.tagName)) {
          const range = document.createRange()
          range.selectNodeContents(element)
          return Array.from(range.getClientRects()).some(meets)
        }
        return meets(element.getBoundingClientRect())
      })
      .map((element) => `${element.tagName.toLowerCase()}.${element.className} "${(element.textContent ?? "").trim().slice(0, 30)}"`)
  })
}

// Stats tab data (overview and Trends) so the screen is deterministic.
export async function mockStatsFeed(page: Page, apiOrigin: string) {
  const months = (count: number) => {
    const now = new Date()
    return Array.from({ length: count }, (_, index) => {
      const date = new Date(Date.UTC(now.getFullYear(), now.getMonth() - (count - 1 - index), 1))
      return { month: date.toISOString().slice(0, 7), plays: [3, 5, 2, 8, 11, 6, 0, 4, 9, 12, 7, 5][index % 12] }
    })
  }
  const heatmap = (year: number) => {
    const days = []
    for (let day = 0; day < 365; day += 3) {
      const date = new Date(Date.UTC(year, 0, 1 + day))
      if (date.getUTCFullYear() !== year) break
      days.push({ date: date.toISOString().slice(0, 10), plays: 1 + (day % 4) })
    }
    return { year, days, total_plays: days.reduce((sum, day) => sum + day.plays, 0), active_days: days.length, max_plays_in_day: 4 }
  }
  const insights = {
    total_games: 64, total_plays: 839, played_games_count: 41, historical_played_games_count: 58,
    collection_played_percentage: 64, total_duration_minutes: 41_220, duration_plays: 612, average_duration_minutes: 67,
    most_played: { bgg_id: 1, name: "Clockwork Market", play_count: 61 },
    last_played: { bgg_id: 2, name: "Lantern Grove", played_at: "2026-11-14T19:00:00Z" },
    never_played_count: 23,
    frequent_players: [
      { id: 1, name: "Tom", play_count: 802, win_count: 301, decided_count: 790 },
      { id: 2, name: "Wales", play_count: 512, win_count: 190, decided_count: 505 },
      { id: 3, name: "Sister", play_count: 140, win_count: 0, decided_count: 0 },
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
  await page.route("**/insights/monthly-recap**", route => route.fulfill({ json: {
    month: "2026-11", month_label: "November 2026", total_plays: 3, unique_games: 3, total_duration_minutes: 150, duration_plays: 2,
    most_played: { bgg_id: 1, name: "Clockwork Market", play_count: 1, image_url: null }, collage_games: [],
  } }))
  await page.route("**/insights/year-recap**", route => route.fulfill({ json: {
    year: 2026, total_plays: 87, unique_games: 23, total_duration_minutes: 4310, duration_plays: 87,
    top_games: [{ bgg_id: 1, name: "Clockwork Market", play_count: 14 }, { bgg_id: 2, name: "Lantern Grove", play_count: 11 }],
    new_games_count: 9, new_games: [{ bgg_id: 4, name: "Tiny Orchard", play_count: 7 }],
    plays_by_month: [4, 5, 6, 7, 9, 8, 6, 5, 12, 11, 8, 6], busiest_month: 9,
    plays_by_weekday: [3, 4, 5, 6, 12, 40, 17], busiest_weekday: 6,
    longest_play: { bgg_id: 1, name: "Clockwork Market", duration_minutes: 195, played_on: "2026-03-14" },
    co_players: [{ name: "Ann", play_count: 41 }],
  } }))
  await page.route(/\/insights(\?.*)?$/, route => route.fulfill({ json: insights }))
  await page.route(/\/rankings\?/, route => route.fulfill({ json: { rankings: [], unplayed: [], summary: { games_count: 64, designers: [], publishers: [], mechanics: [], categories: [] } } }))
  await page.route(/\/players(\?.*)?$/, route => route.fulfill({ json: [{ id: 1, name: "Ann", avatar_key: "forest" }, { id: 2, name: "Bob", avatar_key: "forest" }, { id: 3, name: "Cleo", avatar_key: "forest" }] }))
  // Only the API origin: the dev server also serves /src/components/stats/*.
  await page.route(`${apiOrigin}/stats/**`, route => {
    const url = new URL(route.request().url())
    const count = Number(url.searchParams.get("months") ?? 12)
    const json: Record<string, unknown> = {
      "plays-per-month": { months: months(count), total_plays: months(count).reduce((sum, month) => sum + month.plays, 0) },
      heatmap: heatmap(Number(url.searchParams.get("year"))),
      "h-index": {
        h_index: 7, next_target: 8, games_played: 22, total_plays: 190, qualifying_games: [], games_needed: 2, reachable: true, plays_needed_total: 3,
        raise_list: [{ bgg_id: 11, name: "Clockwork Market", plays: 7, plays_needed: 1 }, { bgg_id: 12, name: "Lantern Grove", plays: 6, plays_needed: 2 }],
      },
      streak: { current_weeks: 5, best_weeks: 9, played_this_week: false, at_risk: true, this_week_start: "2026-11-16" },
    }
    return route.fulfill({ json: json[url.pathname.split("/").pop()!] })
  })
}

// A game detail page: many mechanics (and an import artefact, "Tags"), a rated game, and a history with a won play whose
// winner is listed last, a play with no duration and no result, and a single-play variant.
export const DETAIL_GAME_ID = 1000
export const MECHANICS = ["Tags", "Engine Building", "Worker Placement", "Set Collection", "Hand Management", "Drafting", "Area Control", "Variable Player Powers", "Tile Placement"]

export async function mockGameDetail(page: Page, options: { onePlay?: boolean; noAverages?: boolean } = {}) {
  const games = GAMES.map((game, index) => index === 0
    ? { ...game, rating: 8.13, complexity: 2.2, max_play_time: 30, min_players: 2, max_players: 2, categories: ["Economic", "Medieval"], mechanics: MECHANICS }
    : game)
  await page.route(/\/games(\?.*)?$/, route => route.fulfill({ json: games }))
  const participant = (id: number, name: string, outcome: string, score: number | null) => ({
    id, name, score, is_winner: outcome === "win", outcome, team: null, rank: null, role: null,
  })
  const base = { source: "app", location: null, outcome_type: "competitive", coop_result: null }
  const plays = options.onePlay ? [
    { ...base, id: 1, played_at: "2026-11-16T18:00:00Z", player_count: 2, duration_minutes: 45, participants: [participant(1, "Bob", "loss", 51), participant(2, "Ann", "win", 63)] },
  ] : [
    { ...base, id: 1, played_at: "2026-11-16T18:00:00Z", player_count: 3, duration_minutes: 40, location: "Home", participants: [participant(1, "Bob", "loss", 51), participant(2, "Cleo", "loss", 47), participant(3, "Ann", "win", 63)] },
    { ...base, id: 2, played_at: "2026-11-10T18:00:00Z", player_count: 3, duration_minutes: null, participants: [participant(4, "Ann", "unknown", null), participant(5, "Bob", "unknown", null), participant(6, "Cleo", "unknown", null)] },
    { ...base, id: 3, played_at: "2026-10-30T18:00:00Z", player_count: 2, duration_minutes: 55, participants: [participant(7, "Dev", "win", 70), participant(8, "Ann", "loss", 66)] },
  ]
  await page.route(/\/games\/1000\/plays/, route => route.fulfill({ json: {
    bgg_id: 1000, play_count: plays.length, last_played_at: "2026-11-16", average_players: options.noAverages ? null : 2.7,
    average_duration_minutes: options.noAverages ? null : 47, recent_plays: plays,
  } }))
  await page.route("**/collection/stats**", route => route.fulfill({
    json: games.map((game, index) => ({ bgg_id: game.bgg_id, play_count: index === 0 ? plays.length : 0, last_played_at: index === 0 ? "2026-11-16" : null })),
  }))
}
