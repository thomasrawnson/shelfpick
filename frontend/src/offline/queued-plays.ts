import type {
  GameHistory,
  GamePlay,
  GamePlayParticipant,
  ParticipantOutcome,
} from "../api/client"
import type { QueuedPlay } from "./play-queue"

// A queued play shown beside the plays the server has. It carries pending: true and its client_id.
// Its id is negative so it can never collide with a server id; it is only a React key and a lookup.
function pendingId(clientId: string): number {
  let hash = 0
  for (const char of clientId) hash = (hash * 31 + char.charCodeAt(0)) | 0
  return -(Math.abs(hash) + 1)
}

function participantOutcome(isWinner: boolean, outcomeType: GamePlay["outcome_type"]): ParticipantOutcome {
  if (outcomeType === "cooperative" || outcomeType === "solo") return "unknown"
  return isWinner ? "win" : "unknown"
}

export function queuedGamePlay(item: QueuedPlay): GamePlay {
  const { payload } = item
  const id = pendingId(item.clientId)
  const participants: GamePlayParticipant[] = payload.participants.map((participant, index) => ({
    ...participant,
    id: id * 100 - index,
    outcome: participantOutcome(participant.is_winner, payload.outcome_type),
  }))
  return {
    id,
    played_at: payload.played_at,
    player_count: participants.length,
    duration_minutes: payload.duration_minutes,
    location: payload.location ?? null,
    source: "app",
    outcome_type: payload.outcome_type,
    coop_result: payload.coop_result,
    scoresheet_id: payload.scoresheet_id ?? null,
    scoresheet_version: payload.scoresheet_version ?? null,
    result_overridden: payload.result_override ?? false,
    participants,
    pending: true,
    client_id: item.clientId,
    sync_error: item.status === "failed" ? item.error ?? "This play couldn't be saved." : null,
  }
}

export function queuedForGame(items: QueuedPlay[], bggId: number): QueuedPlay[] {
  return items.filter((item) => item.payload.bgg_id === bggId)
}

// The game's history with its queued plays added, newest first. The counts include them: a play logged
// on this device counts straight away, and the totals the server knows catch up after the sync.
export function historyWithQueued(history: GameHistory | null, items: QueuedPlay[], bggId: number): GameHistory | null {
  const queued = queuedForGame(items, bggId)
  if (queued.length === 0) return history
  const pending = queued.map(queuedGamePlay)
  const base: GameHistory = history ?? {
    bgg_id: bggId, play_count: 0, last_played_at: null, average_players: null,
    average_duration_minutes: null, recent_plays: [],
  }
  const recent = [...pending, ...base.recent_plays]
    .sort((a, b) => Date.parse(b.played_at) - Date.parse(a.played_at) || b.id - a.id)
  const latest = recent.reduce<string | null>(
    (best, play) => (best === null || Date.parse(play.played_at) > Date.parse(best) ? play.played_at : best),
    base.last_played_at,
  )
  return { ...base, play_count: base.play_count + pending.length, last_played_at: latest, recent_plays: recent }
}
