import type {
  CoopResult,
  GamePlay,
  OutcomeType,
  ParticipantOutcome,
  PlayParticipant,
  PlayResult,
} from "./api/client"

export const OUTCOME_TYPES: { value: OutcomeType; label: string }[] = [
  { value: "competitive", label: "Competitive" },
  { value: "cooperative", label: "Co-op" },
  { value: "team", label: "Teams" },
  { value: "solo", label: "Solo" },
]

export type PlayerDraft = {
  name: string
  score: string
  isWinner: boolean
  team: string
  rank: string
  role: string
}

// What a rematch carries over: who played, on which team, and where.
export type PlayPrefill = {
  outcomeType: OutcomeType
  location: string
  names: string[]
  teams: string[]
}

export function emptyDraft(name = "", team = ""): PlayerDraft {
  return { name, score: "", isWinner: false, team, rank: "", role: "" }
}

function sameTeam(a: string, b: string) {
  return a.trim().toLowerCase() === b.trim().toLowerCase()
}

export type BuiltResult =
  | { ok: true; participants: PlayParticipant[]; result: PlayResult }
  | { ok: false; error: string }

export function buildResult(
  outcomeType: OutcomeType,
  drafts: PlayerDraft[],
  coopResult: CoopResult | "",
  winningTeam: string,
): BuiltResult {
  const shared = outcomeType === "cooperative" || outcomeType === "solo"

  if (outcomeType === "cooperative" && coopResult === "") {
    return { ok: false, error: "Choose Won or Lost for this co-op play." }
  }
  if (outcomeType === "solo" && drafts.length !== 1) {
    return { ok: false, error: "A solo play has one player." }
  }

  let ranked = false
  if (outcomeType === "competitive") {
    const withRank = drafts.filter((draft) => draft.rank.trim() !== "")
    if (withRank.length > 0 && withRank.length !== drafts.length) {
      return { ok: false, error: "Give every player a place, or none." }
    }
    ranked = withRank.length > 0
    const bad = withRank.some((draft) => {
      const value = Number(draft.rank)
      return !Number.isInteger(value) || value < 1 || value > 99
    })
    if (bad) {
      return { ok: false, error: "Places must be whole numbers from 1." }
    }
  }

  if (outcomeType === "team") {
    if (drafts.some((draft) => draft.team.trim() === "")) {
      return { ok: false, error: "Give every player a team." }
    }
    const teams = new Set(drafts.map((draft) => draft.team.trim().toLowerCase()))
    if (teams.size < 2) {
      return { ok: false, error: "A team play needs at least two teams." }
    }
  }

  const participants = drafts.map((draft): PlayParticipant => {
    const score = draft.score.trim() === "" ? null : Number(draft.score)
    const role = draft.role.trim() === "" ? null : draft.role.trim()
    const base = { name: draft.name.trim(), score, role }
    if (shared) {
      return { ...base, is_winner: false }
    }
    if (outcomeType === "team") {
      return {
        ...base,
        team: draft.team.trim(),
        is_winner: winningTeam !== "" && sameTeam(draft.team, winningTeam),
      }
    }
    if (ranked) {
      const rank = Number(draft.rank)
      return { ...base, rank, is_winner: rank === 1 }
    }
    return { ...base, is_winner: draft.isWinner }
  })

  return {
    ok: true,
    participants,
    result: {
      outcome_type: outcomeType,
      coop_result: shared && coopResult !== "" ? coopResult : null,
    },
  }
}

export function draftsFromPlay(play: GamePlay): {
  drafts: PlayerDraft[]
  coopResult: CoopResult | ""
  winningTeam: string
} {
  const drafts = play.participants.map((participant) => ({
    name: participant.name,
    score: participant.score === null ? "" : String(participant.score),
    isWinner: participant.is_winner,
    team: participant.team ?? "",
    rank: participant.rank == null ? "" : String(participant.rank),
    role: participant.role ?? "",
  }))
  const winner = play.participants.find(
    (participant) => participant.is_winner && participant.team,
  )
  return {
    drafts,
    coopResult: play.coop_result ?? "",
    winningTeam: winner?.team ?? "",
  }
}

export function rematchPrefill(play: GamePlay): PlayPrefill {
  return {
    outcomeType: play.outcome_type,
    location: play.location ?? "",
    names: play.participants.map((participant) => participant.name),
    teams: play.participants.map((participant) => participant.team ?? ""),
  }
}

export function outcomeLabel(outcome: ParticipantOutcome): string | null {
  switch (outcome) {
    case "win":
      return "Won"
    case "loss":
      return "Lost"
    case "draw":
      return "Draw"
    default:
      return null
  }
}

// --- Compact logging: finishing order, winners and record context ---

export type ScoreDirection = "highest" | "lowest"

function parseScore(value: string): number | null {
  if (value.trim() === "") return null
  const score = Number(value)
  return Number.isFinite(score) ? score : null
}

function better(direction: ScoreDirection) {
  return (a: number, b: number) => (direction === "highest" ? b - a : a - b)
}

// Places from scores using standard competition ranking (1, 1, 3). Only when
// every player has a score; otherwise there is no finishing order yet.
export function finishingOrder(
  scores: string[],
  direction: ScoreDirection,
): number[] | null {
  const parsed = scores.map(parseScore)
  if (parsed.length === 0 || parsed.some((score) => score === null)) return null
  const values = parsed as number[]
  const compare = better(direction)
  return values.map((score) => 1 + values.filter((other) => compare(other, score) < 0).length)
}

// Winners follow the best score once at least two players have one. Ties share the win.
export function autoWinners(scores: string[], direction: ScoreDirection): boolean[] {
  const parsed = scores.map(parseScore)
  const scored = parsed.filter((score): score is number => score !== null)
  if (scored.length < 2) return parsed.map(() => false)
  const best = [...scored].sort(better(direction))[0]
  return parsed.map((score) => score === best)
}

export type CompetitiveMode = {
  direction: ScoreDirection
  // The player tapped a winner toggle, so their choice replaces the scores.
  winnersOverridden: boolean
  // The player typed places; places decide the winner (existing behaviour).
  manualPlaces: boolean
}

// The drafts a competitive play is saved with. Places come from the scores
// unless the player set them or chose the winners by hand.
export function resolveCompetitive(drafts: PlayerDraft[], mode: CompetitiveMode): PlayerDraft[] {
  if (mode.manualPlaces || mode.winnersOverridden) return drafts
  const scores = drafts.map((draft) => draft.score)
  const order = finishingOrder(scores, mode.direction)
  const winners = autoWinners(scores, mode.direction)
  return drafts.map((draft, index) => ({
    ...draft,
    isWinner: winners[index],
    rank: order ? String(order[index]) : "",
  }))
}

// Guess the scoring direction from earlier plays of this game: if winners
// usually hold the lowest score, the game is "lowest wins".
export function inferScoreDirection(plays: GamePlay[]): ScoreDirection {
  let highest = 0
  let lowest = 0
  for (const play of plays) {
    if (play.outcome_type !== "competitive") continue
    const scored = play.participants.filter((p) => p.score !== null)
    if (scored.length < 2) continue
    const values = scored.map((p) => p.score as number)
    const max = Math.max(...values)
    const min = Math.min(...values)
    if (max === min) continue
    const winners = scored.filter((p) => p.is_winner)
    if (winners.length === 0) continue
    if (winners.every((p) => p.score === max)) highest += 1
    else if (winners.every((p) => p.score === min)) lowest += 1
  }
  return lowest > highest ? "lowest" : "highest"
}

export type RecordContext = {
  // Best score per player name (lower-cased) in this game.
  playerBest: Map<string, number>
  bestAtCount: number | null
  average: number | null
  worstWin: number | null
}

function nameKey(name: string) {
  return name.trim().toLowerCase().replace(/\s+/g, " ")
}

export function playerBestFor(context: RecordContext, name: string): number | null {
  return context.playerBest.get(nameKey(name)) ?? null
}

// Records from existing plays of one game. Anything without data is null.
export function recordContext(
  plays: GamePlay[],
  playerCount: number,
  direction: ScoreDirection,
): RecordContext {
  const pick = (values: number[]) =>
    values.length === 0 ? null : [...values].sort(better(direction))[0]
  const playerScores = new Map<string, number[]>()
  const all: number[] = []
  const atCount: number[] = []
  const wins: number[] = []
  for (const play of plays) {
    if (play.outcome_type !== "competitive") continue
    for (const participant of play.participants) {
      if (participant.score === null) continue
      const key = nameKey(participant.name)
      playerScores.set(key, [...(playerScores.get(key) ?? []), participant.score])
      all.push(participant.score)
      if (play.player_count === playerCount) atCount.push(participant.score)
      if (participant.is_winner) wins.push(participant.score)
    }
  }
  const playerBest = new Map<string, number>()
  for (const [key, scores] of playerScores) playerBest.set(key, pick(scores) as number)
  const worst = wins.length === 0 ? null : [...wins].sort(better(direction)).at(-1) ?? null
  const average = all.length === 0 ? null : Math.round((all.reduce((a, b) => a + b, 0) / all.length) * 10) / 10
  return { playerBest, bestAtCount: pick(atCount), average, worstWin: worst }
}
