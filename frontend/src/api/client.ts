import type { Breakdown, ScoresheetSchema } from "../scoresheets/engine"
import { request, responseError, SessionExpiredError } from "./request"
import { FeedbackOfflineError, type FeedbackPayload } from "../feedback"
import { resetConfirmationBody } from "../reset-link"
import {
  clearToken,
  getToken,
  type AuthResult,
  type AuthUser,
} from "../auth"
import type { AvatarId } from "../avatar-catalog"


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

export interface GameNightVotingCandidate {
  bgg_id: number
  name: string
  thumbnail_url: string | null
  // Added for new votes; sessions opened earlier do not have them.
  min_players?: number | null
  max_players?: number | null
  min_play_time?: number | null
  max_play_time?: number | null
  complexity?: number | null
}

export interface GameNightVotingResults {
  counts: { bgg_id: number; votes: number }[]
  abstain_count: number
  total_ballots: number
  winner_bgg_ids: number[]
  outcome: "winner" | "tie" | "no_votes"
}

export interface GameNightVotingGuest {
  display_name: string
  current_vote: number | null
  has_submitted: boolean
}

export interface GameNightVotingState {
  status: "open" | "closed" | "expired"
  candidates: GameNightVotingCandidate[]
  participant_count: number
  ballots_submitted: number
  results: GameNightVotingResults | null
}

export interface GameNightVotingHostState extends GameNightVotingState {
  session_id: string
  expires_at: string
  participant_names: string[]
  join_url?: string
}

export interface GameNightVotingPublicState extends GameNightVotingState {
  guest: GameNightVotingGuest | null
  guest_credential?: string
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
  youngestPlayerAge?: number
  playStyle?: PickerPlayStyle
  preferredCategories?: string[]
  preferredMechanics?: string[]
  mode?: PickerMode
  mood?: string
  helpHIndex?: boolean
}


export interface Play {
  id: number
  bgg_id: number
  player_count: number
  played_at: string
}


export type OutcomeType =
  | "competitive"
  | "cooperative"
  | "team"
  | "solo"


export type CoopResult = "won" | "lost"


export type ParticipantOutcome =
  | "win"
  | "loss"
  | "draw"
  | "unknown"


export interface PlayParticipant {
  name: string
  score: number | null
  is_winner: boolean
  team?: string | null
  rank?: number | null
  role?: string | null
  // Scoresheet entries by category id; null for plain scores.
  score_breakdown?: Breakdown | null
}


export interface GamePlayParticipant
  extends PlayParticipant {
  id: number
  outcome: ParticipantOutcome
}


export interface PlayResult {
  outcome_type: OutcomeType
  coop_result: CoopResult | null
}


export interface GamePlay extends PlayResult {
  id: number
  played_at: string
  player_count: number
  duration_minutes: number | null
  location: string | null
  source: string
  scoresheet_id?: number | null
  scoresheet_version?: number | null
  result_overridden?: boolean
  participants: GamePlayParticipant[]
}


// The scoresheet a play is logged on. Scores and, unless override is true,
// the result are calculated on the server from each player's breakdown.
export interface PlayScoresheet {
  scoresheet_id: number | null
  scoresheet_version: number | null
  result_override: boolean
}


export interface Scoresheet {
  id: number
  bgg_id: number
  kind: "builtin" | "custom"
  version: number
  current_version: number
  archived: boolean
  schema: ScoresheetSchema
}


// The game a listed play belongs to. on_shelf is false once the game has
// left the shelf; its plays still count (SP-UI-02 counting rule).
export interface PlayGameSummary {
  bgg_id: number
  name: string
  thumbnail_url: string | null
  image_url: string | null
  is_expansion: boolean
  on_shelf: boolean
}


export interface ListedPlay extends GamePlay {
  bgg_id: number
  game: PlayGameSummary
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
  // Plays with a known result (win, loss or draw); the win-rate denominator.
  decided_count: number
}

export interface CollectionInsights {
  total_games: number
  total_plays: number
  played_games_count: number
  historical_played_games_count: number
  collection_played_percentage:
    number
  total_duration_minutes: number | null
  duration_plays: number
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

export interface MonthlyRecapGame {
  bgg_id: number
  name: string
  play_count: number
  image_url: string | null
}

export interface MonthlyRecap {
  month: string
  month_label: string
  total_plays: number
  unique_games: number
  total_duration_minutes: number | null
  duration_plays: number
  most_played: MonthlyRecapGame | null
  collage_games: MonthlyRecapGame[]
}

export interface YearRecapGame {
  bgg_id: number
  name: string
  play_count: number
}

export interface YearRecap {
  year: number
  total_plays: number
  unique_games: number
  total_duration_minutes: number | null
  duration_plays: number
  top_games: YearRecapGame[]
  new_games_count: number
  new_games: YearRecapGame[]
  plays_by_month: number[]
  busiest_month: number | null
  plays_by_weekday: number[]
  busiest_weekday: number | null
  longest_play: {
    bgg_id: number
    name: string
    duration_minutes: number
    played_on: string
  } | null
  co_players: Array<{ name: string; play_count: number }>
}

export interface ExportConfiguration {
  cover_artwork_enabled: boolean
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
  avatar_key: AvatarId
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
  outcome: "win" | "loss" | "draw" | "unknown"
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
  losses: number
  draws: number
  unknown_results: number
  decided_plays: number
  win_rate: number | null
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
  | "rankings"

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
  item_type?: string
  year_published:
    number | null
  owned: boolean
  wishlisted: boolean
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
    try {
      await clearToken()
    } finally {
      window.dispatchEvent(
        new Event(
          "boardgamepicker-auth-expired",
        ),
      )
    }
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
  age13OrOver: boolean,
): Promise<AuthResult | { message: string }> {
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
        age_13_or_over: age13OrOver,
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


export interface BillingAccount {
  app_user_id: string
  billing_available: boolean
  pro: boolean
  source: "purchase" | "grant" | null
  plan: "LIFETIME" | "YEARLY" | null
  expires_at: string | null
}

export async function getBillingAccount(): Promise<BillingAccount> {
  const response = await apiFetch("/billing/account")
  if (!response.ok) {
    throw new Error(await readError(response, "Couldn't load your plan. Please try again."))
  }
  return response.json()
}

// Asks the server to re-check this account's purchase with RevenueCat. The
// request carries nothing: the server decides from RevenueCat's record.
export async function syncBilling(): Promise<BillingAccount> {
  const response = await apiFetch("/billing/sync", { method: "POST" })
  if (!response.ok) {
    throw new Error(await readError(response, "Couldn't confirm your purchase. Please try again."))
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

  if (criteria.helpHIndex) {
    params.set("help_h_index", "true")
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


const PLAYS_PAGE_SIZE = 200

// Every play on the shelf, newest first, fetched a page at a time.
export async function getPlays(): Promise<ListedPlay[]> {
  const plays: ListedPlay[] = []
  for (;;) {
    const response = await apiFetch(`/plays?limit=${PLAYS_PAGE_SIZE}&offset=${plays.length}`)
    if (!response.ok) throw new Error(`Plays request failed: ${response.status}`)
    const page = await response.json() as { total: number; plays: ListedPlay[] }
    plays.push(...page.plays)
    if (page.plays.length === 0 || plays.length >= page.total) return plays
  }
}


// Newest play on the account, used for "last used" defaults.
export async function getLatestPlay(): Promise<ListedPlay | null> {
  const response = await apiFetch("/plays?limit=1&offset=0")
  if (!response.ok) throw new Error(`Plays request failed: ${response.status}`)
  const page = await response.json() as { plays: ListedPlay[] }
  return page.plays[0] ?? null
}


export async function sendFeedback(payload: FeedbackPayload): Promise<void> {
  let response: Response
  try {
    response = await apiFetch("/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
  } catch (error) {
    if (error instanceof Error && error.cause instanceof TypeError) throw new FeedbackOfflineError()
    throw error
  }
  if (!response.ok) throw await responseError(response, "Couldn't send your message. Try again.")
}


export async function getGameHistory(
  bggId: number,
  limit?: number,
): Promise<GameHistory> {
  const response =
    await apiFetch(
      limit ? `/games/${bggId}/plays?limit=${limit}` : `/games/${bggId}/plays`,
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
  result: PlayResult = {
    outcome_type: "competitive",
    coop_result: null,
  },
  scoresheet?: PlayScoresheet,
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
          ...result,
          ...scoresheet,
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


export interface PlayEdit extends PlayResult, Partial<PlayScoresheet> {
  played_at: string
  duration_minutes: number | null
  location: string | null
  participants: PlayParticipant[]
}


export async function getScoresheets(bggId: number): Promise<Scoresheet[]> {
  const response = await apiFetch(`/scoresheets?bgg_id=${encodeURIComponent(bggId)}`)
  if (!response.ok) throw new Error(`Scoresheet request failed: ${response.status}`)
  return response.json()
}


export async function getScoresheet(id: number, version?: number | null): Promise<Scoresheet> {
  const query = version ? `?version=${encodeURIComponent(version)}` : ""
  const response = await apiFetch(`/scoresheets/${id}${query}`)
  if (!response.ok) throw new Error(`Scoresheet request failed: ${response.status}`)
  return response.json()
}


async function writeScoresheet(path: string, method: "POST" | "PUT", schema: ScoresheetSchema): Promise<Scoresheet> {
  const response = await apiFetch(path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ schema }),
  })
  if (!response.ok) throw new Error(await readError(response, "Couldn't save this scoresheet."))
  return response.json()
}


export function createScoresheet(schema: ScoresheetSchema): Promise<Scoresheet> {
  return writeScoresheet("/scoresheets", "POST", schema)
}


export function updateScoresheet(id: number, schema: ScoresheetSchema): Promise<Scoresheet> {
  return writeScoresheet(`/scoresheets/${id}`, "PUT", schema)
}


export async function deleteScoresheet(id: number): Promise<void> {
  const response = await apiFetch(`/scoresheets/${id}`, { method: "DELETE" })
  if (!response.ok) throw new Error(`Scoresheet delete failed: ${response.status}`)
}


export async function updatePlay(
  playId: number,
  edit: PlayEdit,
): Promise<GamePlay> {
  const response = await apiFetch(
    `/plays/${playId}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(edit),
    },
  )

  if (!response.ok) {
    throw new Error(
      `Play update failed: ${response.status}`,
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

export async function getLiveTimerRecovery(): Promise<LiveTimer | null> {
  const response = await apiFetch("/play-timer/recovery")
  if (!response.ok) throw new Error(await readError(response, "Couldn't check for a retained live timer."))
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

export async function getMonthlyRecap(
  month: string,
  timezone: string,
): Promise<MonthlyRecap> {
  const parameters = new URLSearchParams({ month, timezone })
  const response = await apiFetch(`/insights/monthly-recap?${parameters}`)
  if (!response.ok) {
    throw new Error(`Monthly recap request failed: ${response.status}`)
  }
  return response.json()
}

export async function getYearRecap(
  year: number,
  timezone: string,
): Promise<YearRecap> {
  const parameters = new URLSearchParams({ year: String(year), timezone })
  const response = await apiFetch(`/insights/year-recap?${parameters}`)
  if (!response.ok) {
    throw new Error(`Year recap request failed: ${response.status}`)
  }
  return response.json()
}

// BGG's image host sends no CORS headers, so a canvas cannot read its covers
// directly. The API serves them same-origin for exported images only.
export async function getExportCover(imageUrl: string): Promise<Blob> {
  const response = await apiFetch(
    `/export-cover?url=${encodeURIComponent(imageUrl)}`,
    { signal: AbortSignal.timeout(8_000) },
  )
  if (!response.ok) {
    throw new Error(`Export cover request failed: ${response.status}`)
  }
  return response.blob()
}


export async function getExportConfiguration(): Promise<ExportConfiguration> {
  const response = await apiFetch("/export-config")
  if (!response.ok) {
    throw new Error(`Export configuration request failed: ${response.status}`)
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

export async function createPlayer(
  name: string,
): Promise<Player> {
  const response = await apiFetch("/players", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  })

  if (!response.ok) {
    throw new Error(
      response.status === 422
        ? "Enter a name up to 100 characters."
        : `Couldn't add the player: ${response.status}`,
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

export async function openGameNightVoting(
  candidateBggIds: number[],
): Promise<GameNightVotingHostState> {
  const response = await apiFetch("/game-night/voting", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ candidate_bgg_ids: candidateBggIds }),
  })
  if (!response.ok) {
    throw await responseError(response, "Couldn't open phone voting.")
  }
  return response.json()
}

export async function getGameNightVotingHostState(
  sessionId: string,
): Promise<GameNightVotingHostState> {
  const response = await apiFetch(`/game-night/voting/sessions/${sessionId}`)
  if (!response.ok) {
    throw await responseError(response, "Couldn't refresh voting.")
  }
  return response.json()
}

export async function closeGameNightVoting(
  sessionId: string,
): Promise<GameNightVotingHostState> {
  const response = await apiFetch(
    `/game-night/voting/sessions/${sessionId}/close`,
    { method: "POST" },
  )
  if (!response.ok) {
    throw await responseError(response, "Couldn't close voting.")
  }
  return response.json()
}

function guestVotingHeaders(credential?: string | null): HeadersInit {
  return credential ? { "X-Game-Night-Guest": credential } : {}
}

export async function getGameNightVotingGuestState(
  joinToken: string,
  credential?: string | null,
): Promise<GameNightVotingPublicState> {
  const response = await apiFetch(`/game-night/voting/${joinToken}`, {
    headers: guestVotingHeaders(credential),
  })
  if (!response.ok) {
    throw await responseError(response, "Couldn't load this voting session.")
  }
  return response.json()
}

export async function joinGameNightVoting(
  joinToken: string,
  displayName: string,
): Promise<GameNightVotingPublicState> {
  const response = await apiFetch(`/game-night/voting/${joinToken}/join`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ display_name: displayName }),
  })
  if (!response.ok) {
    throw await responseError(response, "Couldn't join this voting session.")
  }
  return response.json()
}

export async function submitGameNightBallot(
  joinToken: string,
  credential: string,
  candidateBggId: number | null,
): Promise<GameNightVotingPublicState> {
  const response = await apiFetch(`/game-night/voting/${joinToken}/ballot`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...guestVotingHeaders(credential),
    },
    body: JSON.stringify({ candidate_bgg_id: candidateBggId }),
  })
  if (!response.ok) {
    throw await responseError(response, "Couldn't save your vote.")
  }
  return response.json()
}

export async function correctGameNightGuest(
  joinToken: string,
  credential: string,
  displayName: string,
): Promise<void> {
  const response = await apiFetch(`/game-night/voting/${joinToken}/guest`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...guestVotingHeaders(credential) },
    body: JSON.stringify({ display_name: displayName }),
  })
  if (!response.ok) throw await responseError(response, "Couldn't update your nickname.")
}

export async function removeGameNightGuest(
  joinToken: string,
  credential: string,
): Promise<void> {
  const response = await apiFetch(`/game-night/voting/${joinToken}/guest`, {
    method: "DELETE",
    headers: guestVotingHeaders(credential),
  })
  if (!response.ok) throw await responseError(response, "Couldn't remove your guest data.")
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
    "rankings",
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
  avatar_key?: AvatarId
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
      body: resetConfirmationBody(token, password),
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


export async function resendVerification(email: string): Promise<string> {
  const response = await request(`${API_BASE_URL}/auth/verification/resend`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  })
  if (!response.ok) throw await responseError(response, "Couldn't resend verification email")
  const data = await response.json()
  return data.message
}


export async function logoutAllSessions(): Promise<string> {
  const response = await apiFetch("/auth/logout-all", { method: "POST" })
  if (!response.ok) throw new Error(await readError(response, "Couldn't log out all sessions"))
  const data = await response.json()
  return data.message
}


export async function deleteAccount(password: string): Promise<string> {
  const response = await apiFetch("/auth/account", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  })
  if (!response.ok) throw new Error(await readError(response, "Couldn't delete account"))
  const data = await response.json()
  return data.message
}


// ---- Stats 2.0 (SP-STATS-01) ------------------------------------------

export interface StatsFilterValues {
  dateFrom?: string
  dateTo?: string
  playerId?: number
  location?: string
  playerCount?: number
}

export interface PlaysPerMonth {
  months: Array<{ month: string; plays: number }>
  total_plays: number
}

export interface PlayHeatmap {
  year: number
  days: Array<{ date: string; plays: number }>
  total_plays: number
  active_days: number
  max_plays_in_day: number
}

export interface HIndexGame {
  bgg_id: number
  name: string
  plays: number
  plays_needed?: number
}

export interface HIndexStats {
  h_index: number
  next_target: number
  games_played: number
  total_plays: number
  qualifying_games: HIndexGame[]
  games_needed: number
  reachable: boolean
  plays_needed_total: number
  raise_list: HIndexGame[]
}

export interface PlayStreak {
  current_weeks: number
  best_weeks: number
  played_this_week: boolean
  at_risk: boolean
  this_week_start: string
}

export interface ScoreRecord {
  bgg_id: number
  name: string
  scored_plays: number
  best: number
  average: number
  lowest: number
  highest_losing: number | null
  best_category: { label: string; points: number } | null
}

export interface HeadToHead {
  player_a: number
  player_b: number
  plays_together: number
  versus_plays: number
  wins_a: number
  wins_b: number
  draws: number
  undecided: number
  coop_plays: number
  coop_won: number
  coop_lost: number
  same_team_plays: number
  recent: Array<{
    play_id: number
    played_at: string
    bgg_id: number
    game: string
    kind: "versus" | "coop" | "teammates"
    result: "a" | "b" | "draw" | "undecided" | null
    coop_result: "won" | "lost" | null
  }>
}

export interface StatsFilterOptions {
  locations: Array<{ name: string; plays: number }>
  player_counts: number[]
  first_play: string | null
  last_play: string | null
}

export class AdvancedStatsRequiredError extends Error {
  constructor() { super("Advanced stats require Pro.") }
}

export function deviceTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"
}

async function getStats<T>(
  path: string,
  query: Record<string, string | number | undefined>,
  filters: StatsFilterValues = {},
  signal?: AbortSignal,
): Promise<T> {
  const parameters = new URLSearchParams({ timezone: deviceTimezone() })
  const all: Record<string, string | number | undefined> = {
    ...query,
    date_from: filters.dateFrom,
    date_to: filters.dateTo,
    player_id: filters.playerId,
    location: filters.location,
    player_count: filters.playerCount,
  }
  for (const [key, value] of Object.entries(all)) {
    if (value !== undefined && value !== "") parameters.set(key, String(value))
  }
  const response = await apiFetch(`/stats/${path}?${parameters}`, { signal })
  if (response.status === 403) throw new AdvancedStatsRequiredError()
  if (!response.ok) throw new Error(`Stats request failed: ${response.status}`)
  return response.json()
}

export const getPlaysPerMonth = (months: 12 | 24, filters?: StatsFilterValues, signal?: AbortSignal) =>
  getStats<PlaysPerMonth>("plays-per-month", { months }, filters, signal)
export const getPlayHeatmap = (year: number, filters?: StatsFilterValues, signal?: AbortSignal) =>
  getStats<PlayHeatmap>("heatmap", { year }, filters, signal)
export const getHIndex = (filters?: StatsFilterValues, signal?: AbortSignal) =>
  getStats<HIndexStats>("h-index", {}, filters, signal)
export const getPlayStreak = (filters?: StatsFilterValues, signal?: AbortSignal) =>
  getStats<PlayStreak>("streak", {}, filters, signal)
export const getScoreRecords = (filters?: StatsFilterValues, signal?: AbortSignal) =>
  getStats<{ games: ScoreRecord[] }>("records", {}, filters, signal)
export const getHeadToHead = (
  playerA: number, playerB: number, filters?: StatsFilterValues, signal?: AbortSignal,
) => getStats<HeadToHead>("head-to-head", { player_a: playerA, player_b: playerB }, filters, signal)
export const getStatsFilterOptions = (signal?: AbortSignal) =>
  getStats<StatsFilterOptions>("filter-options", {}, {}, signal)
