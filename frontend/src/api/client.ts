import { request, responseError, SessionExpiredError } from "./request"
import {
  clearToken,
  getToken,
  type AuthResult,
  type AuthUser,
} from "../auth"


export interface Game {
  bgg_id: number
  name: string
  year_published: number | null
  min_players: number | null
  max_players: number | null
  min_play_time: number | null
  max_play_time: number | null
  min_age: number | null
  complexity: number | null
  rating: number | null
  owned: boolean
  image_url: string | null
  thumbnail_url: string | null
  categories: string[]
  mechanics: string[]
}

export interface PickerOptions {
  categories: string[]
  mechanics: string[]
}

export interface RankingGame {
  bgg_id: number
  name: string
  year_published: number | null
  image_url: string | null
  thumbnail_url: string | null
  rating: number
  comparisons_count: number
  wins: number
  losses: number
  rank?: number
}

export interface RankingMatchup {
  games: RankingGame[]
}

export interface RankingsResponse {
  rankings: RankingGame[]
  unplayed: RankingGame[]
  summary: RankingSummary
}

export interface RankingSummaryItem {
  name: string
  count: number
}

export interface RankingSummary {
  games_count: number
  designers: RankingSummaryItem[]
  publishers: RankingSummaryItem[]
  mechanics: RankingSummaryItem[]
  categories: RankingSummaryItem[]
}

export interface PickerMatch {
  game: Game
  score: number
  reasons: string[]
  ai_used?: boolean
  ai_explanation?: string | null
}

export interface PickerNoMatchGuidance {
  owned_game_count: number
  player_count_exclusions: number
  can_relax_time: boolean
  can_relax_complexity: boolean
  can_relax_both: boolean
}

export interface PickerResponse {
  matches: PickerMatch[]
  guidance: PickerNoMatchGuidance | null
  session_id: string | null
}

export type PickerEventType =
  | "try_another"
  | "view_game"
  | "start_over"

export type PickerMode =
  | "best_match"
  | "different"
  | "surprise"

export type PickerPlayStyle =
  | "any"
  | "cooperative"
  | "competitive"

export type PickerComplexityBand =
  | "light"
  | "medium"
  | "heavy"


export interface PickerCriteria {
  players: number
  playerIds?: number[]
  maxPlayTime?: number
  complexityBand?: PickerComplexityBand
  maxComplexity?: number
  youngestPlayerAge?: number
  playStyle?: PickerPlayStyle
  preferredCategories?: string[]
  preferredMechanics?: string[]
  mode?: PickerMode
  mood?: string
}


export interface Play {
  id: number
  bgg_id: number
  player_count: number
  played_at: string
}


export interface PlayParticipant {
  name: string
  score: number | null
  is_winner: boolean
}


export interface GamePlayParticipant
  extends PlayParticipant {
  id: number
}


export interface GamePlay {
  id: number
  played_at: string
  player_count: number
  duration_minutes: number | null
  location: string | null
  source: string
  participants: GamePlayParticipant[]
}


export interface GameHistory {
  bgg_id: number
  play_count: number
  last_played_at: string | null
  average_players: number | null
  average_duration_minutes:
    number | null
  recent_plays: GamePlay[]
}


export interface GamePlaySummary {
  bgg_id: number
  name: string
  play_count: number
}


export interface LastPlayedGame {
  bgg_id: number
  name: string
  played_at: string
}

export interface PlayerSummary {
  id: number
  name: string
  play_count: number
  win_count: number
}

export interface CollectionInsights {
  total_games: number
  total_plays: number
  played_games_count: number
  collection_played_percentage:
    number
  total_duration_minutes: number
  average_duration_minutes:
    number | null
  most_played:
    GamePlaySummary | null
  last_played:
    LastPlayedGame | null
  never_played_count: number
  frequent_players: PlayerSummary[]
  monthly_activity: MonthlyActivity
  neglected_games: NeglectedGame[]
  top_games_by_player: PlayerTopGame[]
  common_groups: PlayerGroupSummary[]
}


export interface CollectionSyncResult {
  username: string
  games_synced: number
}


export interface BGStatsImportResult {
  imported: number
  skipped_existing: number
  skipped_missing_game: number
}


export interface CollectionGameStats {
  bgg_id: number
  play_count: number
  last_played_at: string | null
}

export interface Player {
  id: number
  name: string
  avatar_key: "forest" | "gold" | "clay"
}

export interface PlayerStatsGame {
  bgg_id: number
  name: string
  play_count: number
  last_played_at: string | null
}

export interface PlayerRecentGame {
  play_id: number
  bgg_id: number
  name: string
  played_at: string
  is_winner: boolean
  score: number | null
}

export interface PlayerPartner {
  id: number
  name: string
  play_count: number
}

export interface PlayerStats {
  player: Player
  total_plays: number
  unique_games: number
  wins: number
  win_rate: number
  most_played_games: PlayerStatsGame[]
  recent_games: PlayerRecentGame[]
  common_partners: PlayerPartner[]
}

export interface MonthlyActivity {
  plays: number
  unique_games: number
  new_games: number
  repeat_plays: number
  recent_plays: MonthlyPlay[]
}

export interface NeglectedGame {
  bgg_id: number
  name: string
  play_count: number
  last_played_at: string | null
}

export interface PlayerTopGame {
  player_id: number
  player_name: string
  bgg_id: number
  game_name: string
  play_count: number
}

export interface PlayerGroupSummary {
  player_ids: number[]
  player_names: string[]
  play_count: number
}

export interface MonthlyPlay {
  play_id: number
  bgg_id: number
  game_name: string
  played_at: string
  player_count: number
}

export interface DiscoverRecommendation {
  game: Game
  score: number
  reasons: string[]
  wishlisted: boolean
  source_rank: number | null
  section: string | null
}

export type DiscoverMode = "hot" | "top100" | "for_you"
export type DiscoverPersonalisationStatus =
  | "personalised"
  | "popular_fallback"
  | "not_applicable"
  | "unknown"
export type DiscoverPersonalisationSignal =
  | "collection"
  | "play_history"
  | "preferences"

export interface DiscoverRecommendationResult {
  recommendations: DiscoverRecommendation[]
  personalisation: {
    status: DiscoverPersonalisationStatus
    signals: DiscoverPersonalisationSignal[]
  }
}

export interface BGGSearchResult {
  bgg_id: number
  name: string
  year_published:
    number | null
  owned: boolean
}

const configuredApiUrl =
  import.meta.env
    .VITE_API_BASE_URL
    ?.trim()


if (
  import.meta.env.PROD
  && !configuredApiUrl
) {
  throw new Error(
    "VITE_API_BASE_URL must be configured for production"
  )
}


const API_BASE_URL =
  (
    configuredApiUrl
    ?? "http://127.0.0.1:8000"
  ).replace(
    /\/+$/,
    "",
  )


async function apiFetch(
  path: string,
  options: RequestInit = {},
): Promise<Response> {
  const token = getToken()

  const headers = new Headers(
    options.headers,
  )

  if (token) {
    headers.set(
      "Authorization",
      `Bearer ${token}`,
    )
  }

  const response = await request(
    `${API_BASE_URL}${path}`,
    {
      ...options,
      headers,
    },
    path === "/collection/sync" || path.includes("/import") ? 120_000 : 30_000,
  )

  if (
    response.status === 401
    && token
  ) {
    if (getToken() !== token) throw new SessionExpiredError()
    clearToken()

    window.dispatchEvent(
      new Event(
        "boardgamepicker-auth-expired",
      ),
    )
  }

  if (response.status === 401 && token) throw new SessionExpiredError()
  return response
}


async function readError(
  response: Response,
  fallback: string,
): Promise<string> {
  try {
    const data =
      await response.json()

    if (
      typeof data.detail ===
      "string"
    ) {
      return data.detail
    }
  } catch {
    // Use fallback below.
  }

  return fallback
}


export async function register(
  email: string,
  displayName: string,
  password: string,
): Promise<AuthResult> {
  const response = await request(
    `${API_BASE_URL}/auth/register`,
    {
      method: "POST",
      headers: {
        "Content-Type":
          "application/json",
      },
      body: JSON.stringify({
        email,
        display_name:
          displayName,
        password,
      }),
    },
  )

  if (!response.ok) {
    throw await responseError(
        response,
        "Registration failed",
      )
  }

  return response.json()
}


export async function login(
  email: string,
  password: string,
): Promise<AuthResult> {
  const response = await request(
    `${API_BASE_URL}/auth/login`,
    {
      method: "POST",
      headers: {
        "Content-Type":
          "application/json",
      },
      body: JSON.stringify({
        email,
        password,
      }),
    },
  )

  if (!response.ok) {
    throw new Error(
      await readError(
        response,
        "Login failed",
      ),
    )
  }

  return response.json()
}


export async function getMe():
Promise<AuthUser> {
  const response =
    await apiFetch(
      "/auth/me",
    )

  if (!response.ok) {
    throw new Error(
      await readError(
        response,
        "Couldn't restore your session. Please try again.",
      ),
    )
  }

  return response.json()
}

export async function getPlayerStats(
  playerId: number,
): Promise<PlayerStats> {
  const response =
    await apiFetch(
      `/players/${playerId}/stats`,
    )

  if (!response.ok) {
    throw new Error(
      `Player stats request failed: ${response.status}`,
    )
  }

  return response.json()
}

export async function getPickerOptions():
Promise<PickerOptions> {
  const response =
    await apiFetch(
      "/picker/options",
    )

  if (!response.ok) {
    throw new Error(
      `Picker options request failed: ${response.status}`,
    )
  }

  return response.json()
}

export async function getPickerMatches(
  criteria: PickerCriteria,
): Promise<PickerResponse> {
  const params =
    new URLSearchParams({
      players:
        criteria.players
          .toString(),
      limit: "20",
      include_guidance: "true",
    })

  if (
    criteria.maxPlayTime !==
    undefined
  ) {
    params.set(
      "max_play_time",
      criteria.maxPlayTime
        .toString(),
    )
  }
  if (
    criteria.mood
    && criteria.mood.trim()
  ) {
    params.set(
      "mood",
      criteria.mood.trim(),
    )
  }
  if (criteria.complexityBand) {
    params.set(
      "complexity_band",
      criteria.complexityBand,
    )
  }

  if (
    criteria.maxComplexity !==
    undefined
  ) {
    params.set(
      "max_complexity",
      criteria.maxComplexity
        .toString(),
    )
  }

  if (
    criteria.youngestPlayerAge !==
    undefined
  ) {
    params.set(
      "youngest_player_age",
      criteria.youngestPlayerAge
        .toString(),
    )
  }

  if (criteria.playStyle) {
    params.set(
      "play_style",
      criteria.playStyle,
    )
  }

  if (criteria.mode) {
    params.set(
      "mode",
      criteria.mode,
    )
  }

  criteria.playerIds?.forEach(
    (playerId) => {
      params.append(
        "player_ids",
        playerId.toString(),
      )
    },
  )

  criteria
    .preferredCategories
    ?.forEach(
      (category) => {
        params.append(
          "preferred_categories",
          category,
        )
      },
    )

  criteria
    .preferredMechanics
    ?.forEach(
      (mechanic) => {
        params.append(
          "preferred_mechanics",
          mechanic,
        )
      },
    )

  const response =
    await apiFetch(
      `/picker?${params.toString()}`,
    )

  if (!response.ok) {
    throw new Error(
      `Picker request failed: ${response.status}`,
    )
  }

  const data = await response.json()

  if (Array.isArray(data)) {
    return {
      matches: data,
      guidance: null,
      session_id: null,
    }
  }

  return data
}


export async function recordPickerEvent(
  sessionId: string | null,
  eventType: PickerEventType,
  bggId?: number,
  position?: number,
): Promise<void> {
  if (!sessionId) {
    return
  }

  try {
    await apiFetch(
      "/picker/events",
      {
        method: "POST",
        headers: {
          "Content-Type":
            "application/json",
        },
        body: JSON.stringify({
          session_id: sessionId,
          event_type: eventType,
          bgg_id: bggId,
          position,
        }),
      },
    )
  } catch (err) {
    console.error(
      "Couldn't record picker analytics",
      err,
    )
  }
}

export async function getGames():
Promise<Game[]> {
  const response =
    await apiFetch(
      "/games",
    )

  if (!response.ok) {
    throw new Error(
      `Games request failed: ${response.status}`,
    )
  }

  return response.json()
}


export async function getRankingMatchup(
  excludeBggIds: number[] = [],
  playedOnly = true,
): Promise<RankingMatchup> {
  const params = new URLSearchParams()

  params.set(
    "played_only",
    playedOnly.toString(),
  )

  excludeBggIds.forEach((bggId) => {
    params.append(
      "exclude_bgg_ids",
      bggId.toString(),
    )
  })

  const suffix = params.toString()

  const response = await apiFetch(
    `/rankings/matchup${
      suffix ? `?${suffix}` : ""
    }`,
  )

  if (!response.ok) {
    throw new Error(
      `Ranking matchup failed: ${response.status}`,
    )
  }

  return response.json()
}


export async function getRankings(
  playedOnly = true,
  summaryLimit: 10 | 20 | 50 | 100 = 20,
):
Promise<RankingsResponse> {
  const params = new URLSearchParams({
    played_only: playedOnly.toString(),
    summary_limit: summaryLimit.toString(),
  })

  const response = await apiFetch(
    `/rankings?${params.toString()}`,
  )

  if (!response.ok) {
    throw new Error(
      `Rankings request failed: ${response.status}`,
    )
  }

  return response.json()
}


export async function chooseRankingGame(
  winnerBggId: number,
  loserBggId: number,
): Promise<void> {
  const response = await apiFetch(
    "/rankings/comparisons",
    {
      method: "POST",
      headers: {
        "Content-Type":
          "application/json",
      },
      body: JSON.stringify({
        winner_bgg_id: winnerBggId,
        loser_bgg_id: loserBggId,
      }),
    },
  )

  if (!response.ok) {
    throw new Error(
      `Ranking comparison failed: ${response.status}`,
    )
  }
}


export async function markRankingGameUnplayed(
  bggId: number,
): Promise<void> {
  const response = await apiFetch(
    `/rankings/games/${bggId}/unplayed`,
    { method: "POST" },
  )

  if (!response.ok) {
    throw new Error(
      `Ranking exclusion failed: ${response.status}`,
    )
  }
}


export async function restoreRankingGame(
  bggId: number,
): Promise<void> {
  const response = await apiFetch(
    `/rankings/games/${bggId}/unplayed`,
    { method: "DELETE" },
  )

  if (!response.ok) {
    throw new Error(
      `Ranking restore failed: ${response.status}`,
    )
  }
}


export async function getGameHistory(
  bggId: number,
): Promise<GameHistory> {
  const response =
    await apiFetch(
      `/games/${bggId}/plays`,
    )

  if (!response.ok) {
    throw new Error(
      `Game history request failed: ${response.status}`,
    )
  }

  return response.json()
}


export async function recordPlay(
  bggId: number,
  playedAt: string,
  durationMinutes:
    number | null,
  participants:
    PlayParticipant[],
  pickerSessionId?: string | null,
  location?: string | null,
  timerSessionId?: string | null,
): Promise<Play> {
  const response =
    await apiFetch(
      "/plays",
      {
        method: "POST",
        headers: {
          "Content-Type":
            "application/json",
        },
        body: JSON.stringify({
          bgg_id: bggId,
          played_at:
            playedAt,
          duration_minutes:
            durationMinutes,
          participants,
          location,
          timer_session_id: timerSessionId,
          picker_session_id:
            pickerSessionId,
        }),
      },
    )

  if (!response.ok) {
    throw new Error(
      `Play request failed: ${response.status}`,
    )
  }

  return response.json()
}


export type LiveTimerStatus = "running" | "paused" | "finished"

export interface LiveTimer {
  public_id: string
  status: LiveTimerStatus
  accumulated_seconds: number
  running_since: string | null
  finished_at: string | null
  elapsed_seconds: number
  draft: { participant_names?: string[]; location?: string }
  game: { bgg_id: number; name: string; image_url: string | null; thumbnail_url: string | null }
}

async function liveTimerMutation(path: string, body?: unknown): Promise<LiveTimer> {
  const response = await apiFetch(path, {
    method: "POST",
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (!response.ok) throw new Error(await readError(response, "Couldn't update the live timer."))
  return response.json()
}

export async function getLiveTimer(): Promise<LiveTimer | null> {
  const response = await apiFetch("/play-timer")
  if (!response.ok) throw new Error(await readError(response, "Couldn't restore the live timer."))
  return response.json()
}

export function startLiveTimer(bggId: number, participantNames: string[], location: string): Promise<LiveTimer> {
  return liveTimerMutation("/play-timer/start", { bgg_id: bggId, participant_names: participantNames, location })
}

export function pauseLiveTimer(): Promise<LiveTimer> { return liveTimerMutation("/play-timer/pause") }
export function resumeLiveTimer(): Promise<LiveTimer> { return liveTimerMutation("/play-timer/resume") }
export function finishLiveTimer(): Promise<LiveTimer> { return liveTimerMutation("/play-timer/finish") }

export async function discardLiveTimer(): Promise<void> {
  const response = await apiFetch("/play-timer", { method: "DELETE" })
  if (!response.ok) throw new Error(await readError(response, "Couldn't discard the live timer."))
}


export async function getCollectionInsights():
Promise<CollectionInsights> {
  const response =
    await apiFetch(
      "/insights",
    )

  if (!response.ok) {
    throw new Error(
      `Insights request failed: ${response.status}`,
    )
  }

  return response.json()
}


export async function syncBGGCollection(
  username: string,
): Promise<CollectionSyncResult> {
  const response =
    await apiFetch(
      "/collection/sync",
      {
        method: "POST",
        headers: {
          "Content-Type":
            "application/json",
        },
        body: JSON.stringify({
          username,
        }),
      },
    )

  if (!response.ok) {
    throw new Error(
      await readError(
        response,
        "Collection sync failed",
      ),
    )
  }

  return response.json()
}


export async function importBGStatsPlays(
  file: File,
): Promise<BGStatsImportResult> {
  const formData =
    new FormData()

  formData.append(
    "file",
    file,
  )

  const response =
    await apiFetch(
      "/imports/bgstats/plays",
      {
        method: "POST",
        body: formData,
      },
    )

if (!response.ok) {
  throw new Error(
    await readError(
      response,
      "Couldn't import that BG Stats file.",
    ),
  )
}

  return response.json()
}


export async function getCollectionStats():
Promise<CollectionGameStats[]> {
  const response =
    await apiFetch(
      "/collection/stats",
    )

  if (!response.ok) {
    throw new Error(
      `Collection stats failed: ${response.status}`,
    )
  }

  return response.json()
}


export async function removeFromCollection(
  bggId: number,
): Promise<void> {
  const response =
    await apiFetch(
      `/collection/${bggId}`,
      {
        method: "DELETE",
      },
    )

  if (!response.ok) {
    throw new Error(
      `Collection removal failed: ${response.status}`,
    )
  }
}

export async function getPlayers():
Promise<Player[]> {
  const response =
    await apiFetch(
      "/players",
    )

  if (!response.ok) {
    throw new Error(
      `Players request failed: ${response.status}`,
    )
  }

  return response.json()
}

export async function getGameNightRecommendations(
  playerIds: number[],
  maxPlayTime: number | null,
): Promise<PickerMatch[]> {
  const params = new URLSearchParams({ limit: "5" })

  playerIds.forEach((playerId) => {
    params.append("player_ids", playerId.toString())
  })
  if (maxPlayTime !== null && maxPlayTime !== 0) {
    params.set("max_play_time", maxPlayTime.toString())
  }

  const response = await apiFetch(
    `/game-night/recommendations?${params.toString()}`,
  )
  if (!response.ok) {
    throw new Error(`Game Night request failed: ${response.status}`)
  }

  return response.json()
}

export async function deletePlay(
  playId: number,
): Promise<void> {
  const response =
    await apiFetch(
      `/plays/${playId}`,
      {
        method: "DELETE",
      },
    )

  if (!response.ok) {
    throw new Error(
      `Play deletion failed: ${response.status}`,
    )
  }
}

export async function getDiscoverRecommendations(
  mode: DiscoverMode = "hot",
):
Promise<DiscoverRecommendationResult> {
  const response =
    await apiFetch(
      `/discover?mode=${mode}`,
    )

  if (!response.ok) {
    throw new Error(
      await readError(
        response,
        "Couldn't load recommendations.",
      ),
    )
  }

  const rawStatus = response.headers.get("X-ShelfPick-Personalisation")
  const status: DiscoverPersonalisationStatus = (
    rawStatus === "personalised"
    || rawStatus === "popular_fallback"
    || rawStatus === "not_applicable"
  ) ? rawStatus : "unknown"
  const allowedSignals = new Set<DiscoverPersonalisationSignal>([
    "collection",
    "play_history",
    "preferences",
  ])
  const signals = (response.headers.get("X-ShelfPick-Personalisation-Signals") ?? "")
    .split(",")
    .filter(Boolean)
    .filter((signal): signal is DiscoverPersonalisationSignal => (
      allowedSignals.has(signal as DiscoverPersonalisationSignal)
    ))

  return {
    recommendations: await response.json(),
    personalisation: { status, signals },
  }
}


export async function getWishlist():
Promise<Game[]> {
  const response = await apiFetch(
    "/wishlist",
  )

  if (!response.ok) {
    throw new Error(
      await readError(
        response,
        "Couldn't load your Wishlist.",
      ),
    )
  }

  return response.json()
}


export async function getWishlistGame(
  bggId: number,
): Promise<Game | null> {
  const response = await apiFetch(
    `/wishlist/${bggId}`,
  )

  if (response.status === 404) {
    return null
  }

  if (!response.ok) {
    throw new Error(
      await readError(
        response,
        "Couldn't load that saved game.",
      ),
    )
  }

  return response.json()
}


export async function addToWishlist(
  bggId: number,
): Promise<Game> {
  const response = await apiFetch(
    `/wishlist/${bggId}`,
    {
      method: "POST",
    },
  )

  if (!response.ok) {
    throw new Error(
      await readError(
        response,
        "Couldn't save that game.",
      ),
    )
  }

  return response.json()
}


export async function removeFromWishlist(
  bggId: number,
): Promise<void> {
  const response = await apiFetch(
    `/wishlist/${bggId}`,
    {
      method: "DELETE",
    },
  )

  if (!response.ok) {
    throw new Error(
      await readError(
        response,
        "Couldn't remove that game.",
      ),
    )
  }
}


export async function moveWishlistGameToCollection(
  bggId: number,
): Promise<Game> {
  const response = await apiFetch(
    `/wishlist/${bggId}/move-to-collection`,
    {
      method: "POST",
    },
  )

  if (!response.ok) {
    throw new Error(
      await readError(
        response,
        "Couldn't add that game to your collection.",
      ),
    )
  }

  return response.json()
}

export async function searchBGGGames(
  query: string,
): Promise<BGGSearchResult[]> {
  const params =
    new URLSearchParams({
      query,
    })

  const response =
    await apiFetch(
      `/collection/search?${params.toString()}`,
    )

  if (!response.ok) {
    throw new Error(
      await readError(
        response,
        "Couldn't search BoardGameGeek.",
      ),
    )
  }

  return response.json()
}


export async function addGameToCollection(
  bggId: number,
): Promise<Game> {
  const response =
    await apiFetch(
      `/collection/games/${bggId}`,
      {
        method: "POST",
      },
    )

  if (!response.ok) {
    throw new Error(
      await readError(
        response,
        "Couldn't add that game.",
      ),
    )
  }

  return response.json()
}

export type ProfileChanges = {
  player_name?: string
  avatar_key?: "forest" | "gold" | "clay"
  preferred_player_count?: number | null
  preferred_play_time?: number | null
  preferred_play_style?: PickerPlayStyle | null
}

export async function completeOnboarding(changes: ProfileChanges = {}):
Promise<AuthUser> {
  const response =
    await apiFetch(
      "/auth/onboarding/complete",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(changes),
      },
    )

  if (!response.ok) {
    throw new Error(
      await readError(
        response,
        "Couldn't finish setup.",
      ),
    )
  }

  return response.json()
}

export async function saveProfile(changes: ProfileChanges): Promise<AuthUser> {
  const response = await apiFetch("/auth/profile", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(changes),
  })
  if (!response.ok) throw new Error(await readError(response, "Could not save profile."))
  return response.json()
}

export async function requestPasswordReset(
  email: string,
): Promise<string> {
  const response = await request(
    `${API_BASE_URL}/auth/password-reset/request`,
    {
      method: "POST",
      headers: {
        "Content-Type":
          "application/json",
      },
      body: JSON.stringify({
        email,
      }),
    },
  )

  if (!response.ok) {
    throw new Error(
      await readError(
        response,
        "Couldn't request password reset",
      ),
    )
  }

  const data = await response.json()

  return data.message
}


export async function confirmPasswordReset(
  token: string,
  password: string,
): Promise<string> {
  const response = await request(
    `${API_BASE_URL}/auth/password-reset/confirm`,
    {
      method: "POST",
      headers: {
        "Content-Type":
          "application/json",
      },
      body: JSON.stringify({
        token,
        password,
      }),
    },
  )

  if (!response.ok) {
    throw await responseError(
        response,
        "Couldn't reset password",
      )
  }

  const data = await response.json()

  return data.message
}


export async function confirmEmailVerification(
  token: string,
): Promise<string> {
  const response = await request(
    `${API_BASE_URL}/auth/verification/confirm`,
    {
      method: "POST",
      headers: {
        "Content-Type":
          "application/json",
      },
      body: JSON.stringify({
        token,
      }),
    },
  )

  if (!response.ok) {
    throw new Error(
      await readError(
        response,
        "Couldn't verify email",
      ),
    )
  }

  const data = await response.json()

  return data.message
}
