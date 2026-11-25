import type { Page } from "@playwright/test"

// Synthetic sample data (generated, illustrated SVG box covers with fictional titles) so screens can be
// judged and photographed without third-party artwork. The real app shows BGG covers.
const palette = ["#315C48", "#C28B37", "#356A7A", "#B7463C", "#6B4E9B", "#3F7655", "#A66D16", "#2F4858"]

const MOTIFS: string[] = [
  // Clockwork Market: gears
  `<circle cx="150" cy="150" r="62" fill="none" stroke="#fff" stroke-opacity=".85" stroke-width="22" stroke-dasharray="15 15"/><circle cx="150" cy="150" r="48" fill="none" stroke="#fff" stroke-width="12"/><circle cx="150" cy="150" r="14" fill="#fff"/><circle cx="262" cy="214" r="42" fill="none" stroke="#fff" stroke-opacity=".7" stroke-width="16" stroke-dasharray="11 11"/><circle cx="262" cy="214" r="30" fill="none" stroke="#fff" stroke-opacity=".9" stroke-width="8"/>`,
  // Lantern Grove: lantern and pines
  `<polygon points="40,260 90,140 140,260" fill="#000" fill-opacity=".28"/><polygon points="250,260 310,120 370,260" fill="#000" fill-opacity=".28"/><rect x="170" y="92" width="60" height="96" rx="10" fill="#FFE2A0"/><circle cx="200" cy="140" r="86" fill="#FFE2A0" fill-opacity=".22"/><rect x="164" y="80" width="72" height="14" rx="5" fill="#fff"/><rect x="164" y="186" width="72" height="12" rx="5" fill="#fff"/><path d="M200 70 q0 -26 22 -34" stroke="#fff" stroke-width="6" fill="none"/>`,
  // Harbour Council: boat and waves
  `<polygon points="196,70 196,190 120,190" fill="#fff"/><polygon points="206,96 206,190 266,190" fill="#fff" fill-opacity=".8"/><path d="M100 196 h200 l-26 34 h-148 z" fill="#000" fill-opacity=".35"/><path d="M0 250 q50 -26 100 0 t100 0 t100 0 t100 0" fill="none" stroke="#fff" stroke-opacity=".7" stroke-width="10"/>`,
  // Tiny Orchard: tree with fruit
  `<rect x="188" y="170" width="24" height="96" fill="#000" fill-opacity=".35"/><circle cx="200" cy="120" r="82" fill="#fff" fill-opacity=".85"/><circle cx="165" cy="105" r="14" fill="#B7463C"/><circle cx="222" cy="95" r="14" fill="#B7463C"/><circle cx="205" cy="150" r="14" fill="#B7463C"/><circle cx="238" cy="140" r="12" fill="#B7463C"/>`,
  // Night Courier: moon over rooftops
  `<circle cx="280" cy="90" r="46" fill="#FFE9B8"/><circle cx="300" cy="78" r="40" fill="currentBg"/><polygon points="0,262 0,200 50,160 100,200 100,226 150,226 150,176 200,136 250,176 250,206 310,206 310,166 350,130 400,166 400,262" fill="#000" fill-opacity=".4"/><rect x="176" y="188" width="14" height="18" fill="#FFE2A0"/><rect x="330" y="176" width="14" height="18" fill="#FFE2A0"/>`,
  // Salt and Sail: twin sails
  `<polygon points="150,60 150,196 70,196" fill="#fff"/><polygon points="170,84 170,196 262,196" fill="#fff" fill-opacity=".8"/><rect x="146" y="196" width="4" height="22" fill="#fff"/><path d="M80 214 h190 l-30 30 h-130 z" fill="#000" fill-opacity=".35"/><circle cx="310" cy="80" r="26" fill="#fff" fill-opacity=".35"/>`,
  // Ember Vale: mountains and flame
  `<polygon points="0,262 110,100 210,262" fill="#000" fill-opacity=".3"/><polygon points="130,262 280,80 400,262" fill="#000" fill-opacity=".45"/><path d="M200 232 c-34 -34 -6 -62 -4 -86 c22 20 46 44 30 70 c-4 8 -12 14 -26 16z" fill="#FFB347"/><path d="M200 232 c-16 -14 -2 -30 0 -42 c12 10 22 22 12 36z" fill="#fff"/>`,
  // Quiet Archive: stacked books
  `<rect x="90" y="190" width="220" height="40" rx="5" fill="#fff" fill-opacity=".9"/><rect x="112" y="146" width="186" height="40" rx="5" fill="#fff" fill-opacity=".7"/><rect x="80" y="102" width="200" height="40" rx="5" fill="#fff" fill-opacity=".85"/><rect x="100" y="204" width="130" height="8" fill="#000" fill-opacity=".3"/><rect x="128" y="160" width="100" height="8" fill="#000" fill-opacity=".3"/><rect x="96" y="116" width="110" height="8" fill="#000" fill-opacity=".3"/>`,
  // The Very Long Titled Expedition: compass
  `<circle cx="200" cy="150" r="96" fill="none" stroke="#fff" stroke-width="10"/><polygon points="200,66 222,150 200,234 178,150" fill="#fff"/><polygon points="116,150 200,128 284,150 200,172" fill="#fff" fill-opacity=".6"/><circle cx="200" cy="150" r="10" fill="currentBg"/>`,
]

function titleLines(name: string): string[] {
  const words = name.split(" ")
  const lines: string[] = []
  for (const word of words) {
    const last = lines[lines.length - 1]
    if (last && (last + " " + word).length <= 16) lines[lines.length - 1] = last + " " + word
    else lines.push(word)
  }
  return lines.slice(0, 3)
}

export function cover(index: number): string {
  const color = palette[index % palette.length]
  // The last game has a tall box, to check awkward cover proportions.
  const tall = index === 8
  const height = tall ? 480 : 400
  const name = NAMES[index % NAMES.length]
  const lines = titleLines(name)
  const size = lines.length > 2 ? 28 : 33
  const firstY = height - 20 - (lines.length - 1) * (size + 4)
  const text = lines.map((line, n) => `<text x="200" y="${firstY + n * (size + 4)}" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-weight="700" font-size="${size}" fill="#fff">${line.replace(/&/g, "&amp;")}</text>`).join("")
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${tall ? 260 : 400}" height="${height}" viewBox="${tall ? "70" : "0"} 0 ${tall ? 260 : 400} ${height}">`
    + `<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${color}"/><stop offset="1" stop-color="#000" stop-opacity=".55"/></linearGradient></defs>`
    + `<rect width="400" height="${height}" fill="${color}"/><rect width="400" height="${height}" fill="url(#g)"/>`
    + `<g>${MOTIFS[index % MOTIFS.length].replace(/currentBg/g, color)}</g>`
    + `<rect x="14" y="14" width="372" height="${height - 28}" rx="10" fill="none" stroke="#fff" stroke-opacity=".5" stroke-width="3"/>`
    + `<rect y="${firstY - size - 14}" width="400" height="${height - (firstY - size - 14)}" fill="#000" fill-opacity=".38"/>${text}</svg>`
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
