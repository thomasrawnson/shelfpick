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
