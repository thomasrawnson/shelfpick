import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"
import { createPortal } from "react-dom"

import { lightImpact } from "../../haptics"
import { Analytics } from "../../analytics"
import { requestReviewAfterPlaySaved } from "../../review-prompt"
import {
  getGameHistory,
  getLatestPlay,
  getPlayers,
  getScoresheet,
  getScoresheets,
  recordPlay,
  updatePlay,
  type CoopResult,
  type Game,
  type GamePlay,
  type OutcomeType,
  type Player,
  type PlayParticipant,
  type PlayResult,
  type PlayScoresheet,
  type Scoresheet,
} from "../../api/client"
import { useEntitlement } from "../../entitlements"
import {
  cellValue,
  completeBreakdown,
  openRoundCount,
  scorePlay,
  sheetRows,
  targetReached,
  type Breakdown,
  type ScoresheetSchema,
} from "../../scoresheets/engine"
import { formatNumber } from "../../scoresheets/math-input"
import ScoresheetGrid from "../scoresheets/ScoresheetGrid"
import ScoresheetBuilder from "../scoresheets/ScoresheetBuilder"
import {
  OUTCOME_TYPES,
  autoWinners,
  buildResult,
  draftsFromPlay,
  emptyDraft,
  finishingOrder,
  inferScoreDirection,
  playerBestFor,
  recordContext,
  resolveCompetitive,
  type PlayPrefill,
  type PlayerDraft,
  type ScoreDirection,
} from "../../play-results"
import { createBGStatsPlayUrl } from "../../utils/bgstats"
import { useLiveTimer } from "../../live-timer"
import { elapsedSeconds, formatElapsed } from "../../live-timer-utils"
import PlayerAvatar from "../ui/PlayerAvatar"
import ResilientGameArtwork from "../ResilientGameArtwork"

export type SavedPlayResult = {
  bgStatsUrl: string | null
}

type Prefill = {
  initialPlayerCount?: number
  initialPlayerNames?: string[]
  initialTeams?: string[]
  initialOutcomeType?: OutcomeType
  initialLocation?: string
  initialDurationMinutes?: number | null
  pickerSessionId?: string | null
  timerSessionId?: string | null
}

type Props = Prefill & {
  game: Game
  onSaved: (result: SavedPlayResult) => Promise<void>
  // Cancel, and Done after saving unless onDone is given.
  onClose: () => void
  onDone?: () => void
  // Edit an already saved play instead of recording a new one.
  editingPlay?: GamePlay | null
}

const HISTORY_LIMIT = 500
const CHIP_LIMIT = 6

function dateValue(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${date.getFullYear()}-${month}-${day}`
}

function summaryDate(value: string) {
  if (value === dateValue(new Date())) return "Today"
  const date = new Date(`${value}T12:00:00`)
  if (Number.isNaN(date.getTime())) return value
  const sameYear = date.getFullYear() === new Date().getFullYear()
  return date.toLocaleDateString(undefined, sameYear
    ? { day: "numeric", month: "short" }
    : { day: "numeric", month: "short", year: "numeric" })
}

function normalName(name: string) {
  return name.trim().toLowerCase().replace(/\s+/g, " ")
}

function draftsFor(names: string[], teams: string[]) {
  return names.filter((name) => name.trim() !== "").map((name, index) => emptyDraft(name, teams[index] ?? ""))
}

// Edits keep what was recorded: places that differ from the scores stay
// manual, and hand-picked winners stay overridden.
function editModes(drafts: PlayerDraft[]) {
  const scores = drafts.map((draft) => draft.score)
  const ranks = drafts.map((draft) => draft.rank)
  const order = finishingOrder(scores, "highest")
  const placesMatch = order !== null && ranks.every((rank, index) => rank === String(order[index]))
  const manualPlaces = ranks.some((rank) => rank !== "") && !placesMatch
  const winners = autoWinners(scores, "highest")
  const winnersMatch = drafts.every((draft, index) => draft.isWinner === winners[index])
  return { manualPlaces, winnersOverridden: !manualPlaces && !winnersMatch }
}

// Entries for categories the sheet still has; used when switching sheets.
function pruneBreakdown(schema: ScoresheetSchema, breakdown: Breakdown | null | undefined): Breakdown {
  const ids = new Set(schema.categories.map((category) => category.id))
  return Object.fromEntries(Object.entries(breakdown ?? {}).filter(([id]) => ids.has(id)))
}

function TrophyIcon() {
  return <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
    <path fill="currentColor" d="M7 3h10v2h3v3a4 4 0 0 1-4 4h-.3A5 5 0 0 1 13 14.9V18h3v2H8v-2h3v-3.1A5 5 0 0 1 8.3 12H8a4 4 0 0 1-4-4V5h3V3Zm0 4H6v1a2 2 0 0 0 1 1.7V7Zm10 0v2.7A2 2 0 0 0 18 8V7h-1Z" />
  </svg>
}

// A full-screen sheet over the app. The tab bar and page behind it are inert.
function Sheet({ labelledBy, onEscape, children }: { labelledBy: string; onEscape: () => void; children: ReactNode }) {
  const sheet = useRef<HTMLDivElement>(null)
  const escape = useRef(onEscape)
  useEffect(() => { escape.current = onEscape })

  useEffect(() => {
    const root = document.getElementById("root")
    const previous = document.activeElement as HTMLElement | null
    document.documentElement.classList.add("play-sheet-open")
    if (root) root.inert = true
    sheet.current?.focus()
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") escape.current() }
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("keydown", onKey)
      document.documentElement.classList.remove("play-sheet-open")
      if (root) root.inert = false
      previous?.focus?.()
    }
  }, [])

  const content = (
    <div className="play-sheet-layer">
      <div ref={sheet} className="play-sheet" role="dialog" aria-modal="true" aria-labelledby={labelledBy} tabIndex={-1}>
        {children}
      </div>
    </div>
  )
  return typeof document === "undefined" ? content : createPortal(content, document.body)
}

function PlayLogForm({
  game,
  onSaved,
  onClose,
  onDone,
  editingPlay = null,
  initialPlayerCount = 0,
  initialPlayerNames = [],
  initialTeams = [],
  initialOutcomeType = "competitive",
  initialLocation = "",
  initialDurationMinutes = null,
  pickerSessionId = null,
  timerSessionId = null,
}: Props) {
  const ids = useId()
  const formId = `${ids}-form`
  const titleId = `${ids}-title`
  const detailsId = `${ids}-details`
  const liveTimer = useLiveTimer()
  const isEditing = editingPlay !== null
  const canBuildSheets = useEntitlement("custom_scoresheets")
  const editingSheetId = editingPlay?.scoresheet_id ?? null
  const [initial] = useState(() => {
    if (editingPlay) {
      const edit = draftsFromPlay(editingPlay)
      if (editingSheetId !== null) {
        return { ...edit, manualPlaces: false, winnersOverridden: editingPlay.result_overridden === true }
      }
      return { ...edit, ...editModes(edit.drafts) }
    }
    return {
      drafts: draftsFor(initialPlayerNames, initialTeams),
      coopResult: "" as CoopResult | "",
      winningTeam: "",
      manualPlaces: false,
      winnersOverridden: false,
    }
  })

  const [playDate, setPlayDate] = useState(editingPlay ? dateValue(new Date(editingPlay.played_at)) : dateValue(new Date()))
  const [duration, setDuration] = useState(
    editingPlay
      ? editingPlay.duration_minutes === null ? "" : String(editingPlay.duration_minutes)
      : initialDurationMinutes === null ? "" : String(initialDurationMinutes),
  )
  const [location, setLocation] = useState(editingPlay ? editingPlay.location ?? "" : initialLocation)
  const locationTouched = useRef(editingPlay !== null || initialLocation !== "")
  const [outcomeType, setOutcomeType] = useState<OutcomeType>(editingPlay ? editingPlay.outcome_type : initialOutcomeType)
  const [coopResult, setCoopResult] = useState<CoopResult | "">(initial.coopResult)
  const [winningTeam, setWinningTeam] = useState(initial.winningTeam)
  const [players, setPlayers] = useState<PlayerDraft[]>(initial.drafts)
  const [manualPlaces, setManualPlaces] = useState(initial.manualPlaces)
  const [winnersOverridden, setWinnersOverridden] = useState(initial.winnersOverridden)
  const [direction, setDirection] = useState<ScoreDirection>("highest")
  const directionTouched = useRef(false)
  const [history, setHistory] = useState<GamePlay[]>([])
  const [knownPlayers, setKnownPlayers] = useState<Player[]>([])
  const [newName, setNewName] = useState("")
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [saved, setSaved] = useState(false)
  const [bgStatsUrl, setBGStatsUrl] = useState<string | null>(null)
  const savePending = useRef(false)
  const lastSaved = useRef<PlayPrefill | null>(null)
  const [sheets, setSheets] = useState<Scoresheet[]>([])
  const [sheet, setSheet] = useState<Scoresheet | null>(null)
  const [sheetLoading, setSheetLoading] = useState(editingSheetId !== null)
  const [chosenSheetId, setChosenSheetId] = useState<number | null>(null)
  const [breakdowns, setBreakdowns] = useState<Breakdown[]>(() => (
    editingSheetId !== null && editingPlay
      ? editingPlay.participants.map((participant) => participant.score_breakdown ?? {})
      : initial.drafts.map(() => ({}))
  ))
  const [teamBreakdown, setTeamBreakdown] = useState<Breakdown>(() => (
    editingSheetId !== null && editingPlay ? editingPlay.participants[0]?.score_breakdown ?? {} : {}
  ))
  const [extraRounds, setExtraRounds] = useState<Record<string, number>>({})
  const [builder, setBuilder] = useState<{ editing: Scoresheet | null } | null>(null)
  const completeNotified = useRef(editingSheetId !== null)
  const [, redrawTimer] = useState(0)
  const matchingTimer = liveTimer.timer?.game.bgg_id === game.bgg_id ? liveTimer.timer : null

  useEffect(() => {
    if (matchingTimer?.status !== "finished") return
    const id = window.setTimeout(() => {
      setDuration(String(Math.max(0, Math.round(elapsedSeconds(matchingTimer) / 60))))
    }, 0)
    return () => window.clearTimeout(id)
  }, [matchingTimer])

  useEffect(() => {
    if (matchingTimer?.status !== "running") return
    const id = window.setInterval(() => redrawTimer((value) => value + 1), 1000)
    return () => window.clearInterval(id)
  }, [matchingTimer?.public_id, matchingTimer?.status])

  useEffect(() => {
    getPlayers().then(setKnownPlayers).catch((err) => console.error(err))
    getGameHistory(game.bgg_id, HISTORY_LIMIT)
      .then((result) => {
        // Records are a nice-to-have: an odd response leaves them hidden.
        const plays = Array.isArray(result?.recent_plays) ? result.recent_plays : []
        setHistory(plays)
        if (!directionTouched.current) setDirection(inferScoreDirection(plays))
      })
      .catch((err) => console.error(err))
    if (!locationTouched.current) {
      getLatestPlay()
        .then((latest) => { if (!locationTouched.current && latest?.location) setLocation(latest.location) })
        .catch((err) => console.error(err))
    }
  }, [game.bgg_id])

  useEffect(() => {
    getScoresheets(game.bgg_id)
      .then((list) => {
        setSheets(list)
        setChosenSheetId((current) => current ?? list[0]?.id ?? null)
      })
      .catch((err) => console.error(err))
  }, [game.bgg_id])

  useEffect(() => {
    if (editingSheetId === null) return
    getScoresheet(editingSheetId, editingPlay?.scoresheet_version)
      .then(setSheet)
      .catch((err) => {
        console.error(err)
        setError("Couldn't load this play's scoresheet.")
      })
      .finally(() => setSheetLoading(false))
  }, [editingSheetId, editingPlay?.scoresheet_version])

  const schema = sheet?.schema ?? null
  const cooperativeSheet = schema?.win_condition === "cooperative"
  const effectiveOutcome: OutcomeType = schema
    ? cooperativeSheet ? "cooperative" : players.length === 1 ? "solo" : "competitive"
    : outcomeType
  const competitive = effectiveOutcome === "competitive"
  const columnBreakdowns = cooperativeSheet ? [teamBreakdown] : players.map((_, index) => breakdowns[index] ?? {})
  const roundCounts: Record<string, number> = schema
    ? Object.fromEntries(schema.categories
      .filter((category) => category.scope === "per_round")
      .map((category) => [category.id, Math.max(openRoundCount(columnBreakdowns, category.id), extraRounds[category.id] ?? 1)]))
    : {}
  const scored = schema ? scorePlay(schema, columnBreakdowns) : null
  const soloTarget = schema && scored && effectiveOutcome === "solo" ? targetReached(schema, scored.totals[0]) : null
  const mode = { direction, winnersOverridden, manualPlaces }
  const shown = schema && scored
    ? players.map((player, index) => ({
        ...player,
        score: formatNumber(scored.totals[cooperativeSheet ? 0 : index] ?? 0),
        rank: "",
        isWinner: competitive && (winnersOverridden ? player.isWinner : scored.winners.includes(index)),
      }))
    : competitive ? resolveCompetitive(players, mode) : players
  const sheetComplete = schema !== null && (cooperativeSheet || players.length > 0)
    && columnBreakdowns.every((breakdown) => sheetRows(schema, roundCounts)
      .every((row) => row.category.type === "boolean" || cellValue(breakdown, row) !== undefined))

  useEffect(() => {
    if (!sheetComplete) { completeNotified.current = false; return }
    if (completeNotified.current) return
    completeNotified.current = true
    void lightImpact()
  }, [sheetComplete])
  const records = useMemo(() => recordContext(history, players.length, direction), [history, players.length, direction])
  const avatarFor = (name: string) => knownPlayers.find((player) => normalName(player.name) === normalName(name))?.avatar_key
  const inPlay = new Set(players.map((player) => normalName(player.name)))
  const chips = knownPlayers.filter((player) => !inPlay.has(normalName(player.name))).slice(0, CHIP_LIMIT)
  const canAdd = schema !== null || outcomeType !== "solo" || players.length === 0
  const missing = !isEditing && initialPlayerNames.length === 0 && initialPlayerCount > players.length
    ? initialPlayerCount - players.length
    : 0

  function updatePlayer(index: number, changes: Partial<PlayerDraft>) {
    setPlayers((current) => current.map((player, at) => (at === index ? { ...player, ...changes } : player)))
    setError("")
  }

  function addPlayer(name: string) {
    const trimmed = name.trim()
    if (trimmed === "") return
    if (inPlay.has(normalName(trimmed))) {
      setError(`${trimmed} is already in this play.`)
      return
    }
    setPlayers((current) => [...current, emptyDraft(trimmed)])
    setBreakdowns((current) => [...players.map((_, index) => current[index] ?? {}), {}])
    setNewName("")
    setError("")
  }

  function removePlayer(index: number) {
    setPlayers((current) => current.filter((_, at) => at !== index))
    setBreakdowns((current) => current.filter((_, at) => at !== index))
    if (players.length <= 1) setRemoving(false)
  }

  function toggleWinner(index: number) {
    const base = winnersOverridden ? players : shown
    setPlayers(base.map((player, at) => ({ ...player, rank: "", isWinner: at === index ? !player.isWinner : player.isWinner })))
    setWinnersOverridden(true)
  }

  function startRematch() {
    const previous = lastSaved.current
    if (previous === null) return
    setPlayDate(dateValue(new Date()))
    setDuration("")
    setLocation(previous.location)
    setOutcomeType(previous.outcomeType)
    setCoopResult("")
    setWinningTeam("")
    setPlayers(draftsFor(previous.names, previous.teams))
    setBreakdowns(previous.names.map(() => ({})))
    setTeamBreakdown({})
    setExtraRounds({})
    setManualPlaces(false)
    setWinnersOverridden(false)
    setError("")
    setSaved(false)
    setBGStatsUrl(null)
  }

  function applySheet(next: Scoresheet) {
    setSheet(next)
    setBreakdowns(players.map((_, index) => pruneBreakdown(next.schema, breakdowns[index])))
    setTeamBreakdown(pruneBreakdown(next.schema, teamBreakdown))
    setExtraRounds({})
    setManualPlaces(false)
    setWinnersOverridden(false)
    setError("")
  }

  // Back to plain score entry; each player keeps their total.
  function switchToPlainScores() {
    setPlayers(shown.map((player) => ({ ...player, isWinner: winnersOverridden ? player.isWinner : false })))
    setOutcomeType(effectiveOutcome)
    setSheet(null)
    setError("")
  }

  function updateBreakdown(column: number, breakdown: Breakdown) {
    if (cooperativeSheet) setTeamBreakdown(breakdown)
    else setBreakdowns((current) => players.map((_, index) => (index === column ? breakdown : current[index] ?? {})))
    setError("")
  }

  type Built = { participants: PlayParticipant[]; result: PlayResult; scoresheet: PlayScoresheet | undefined }

  function buildSheetPlay(drafts: PlayerDraft[]): Built | string {
    if (!schema || !sheet || !scored) return "Choose a scoresheet."
    if (effectiveOutcome === "cooperative" && coopResult === "") return "Choose whether the group won."
    const override = competitive && winnersOverridden
    const participants = drafts.map((player, index) => ({
      name: player.name.trim(),
      score: scored.totals[cooperativeSheet ? 0 : index] ?? 0,
      is_winner: player.isWinner,
      rank: override ? null : scored.ranks?.[index] ?? null,
      team: null,
      role: null,
      score_breakdown: completeBreakdown(schema, columnBreakdowns[cooperativeSheet ? 0 : index] ?? {}, roundCounts),
    }))
    const shared = effectiveOutcome === "cooperative" || effectiveOutcome === "solo"
    const sharedResult = soloTarget !== null ? (soloTarget ? "won" : "lost") : coopResult === "" ? null : coopResult
    return {
      participants,
      result: { outcome_type: effectiveOutcome, coop_result: shared ? sharedResult : null },
      scoresheet: { scoresheet_id: sheet.id, scoresheet_version: sheet.version, result_override: override },
    }
  }

  async function savePlay() {
    if (savePending.current) return
    if (sheetLoading) return
    const drafts = competitive || schema ? shown : players
    const names = drafts.map((player) => player.name.trim())
    if (drafts.length === 0) {
      setError("Add at least one player.")
      return
    }
    if (names.some((name) => name.length === 0)) {
      setError("Please enter a name for every player.")
      return
    }
    if (new Set(names.map(normalName)).size !== names.length) {
      setError("The same player can't be added twice.")
      return
    }
    if (!schema && drafts.some((player) => player.score.trim() !== "" && Number.isNaN(Number(player.score)))) {
      setError("Scores must be numbers.")
      return
    }
    let built: Built
    if (schema) {
      const sheetPlay = buildSheetPlay(drafts)
      if (typeof sheetPlay === "string") {
        setError(sheetPlay)
        return
      }
      built = sheetPlay
    } else {
      const plain = buildResult(outcomeType, drafts, coopResult, winningTeam)
      if (!plain.ok) {
        setError(plain.error)
        return
      }
      built = {
        participants: plain.participants,
        result: plain.result,
        // Leaving a scoresheet on an edited play goes back to plain scores.
        scoresheet: editingSheetId !== null
          ? { scoresheet_id: null, scoresheet_version: null, result_override: false }
          : undefined,
      }
    }
    const { participants, result, scoresheet } = built
    const durationMinutes = duration.trim() === "" ? null : Number(duration)
    if (durationMinutes !== null && (Number.isNaN(durationMinutes) || durationMinutes < 0)) {
      setError("Duration must be a valid number.")
      setDetailsOpen(true)
      return
    }

    savePending.current = true
    setSaving(true)
    setError("")
    let url: string | null = null
    let succeeded = false
    try {
      const playedAt = editingPlay && playDate === dateValue(new Date(editingPlay.played_at))
        ? editingPlay.played_at
        : new Date(`${playDate}T12:00:00`).toISOString()
      if (editingPlay) {
        await updatePlay(editingPlay.id, {
          played_at: playedAt,
          duration_minutes: durationMinutes,
          location: location.trim() === "" ? null : location.trim(),
          participants,
          ...result,
          ...scoresheet,
        })
      } else {
        const savedPlay = await recordPlay(
          game.bgg_id,
          playedAt,
          durationMinutes,
          participants,
          pickerSessionId,
          location,
          timerSessionId ?? (matchingTimer?.status === "finished" ? matchingTimer.public_id : null),
          result,
          scoresheet,
        )
        url = createBGStatsPlayUrl(game, savedPlay, participants, durationMinutes, result)
      }
      succeeded = true
    } catch (err) {
      console.error(err)
      setError(isEditing ? "Couldn't save your changes." : "Couldn't save this play.")
    } finally {
      savePending.current = false
      setSaving(false)
    }
    if (!succeeded) return

    void lightImpact()
    if (isEditing) {
      try {
        await onSaved({ bgStatsUrl: null })
      } catch (err) {
        console.error(err)
      }
      onClose()
      return
    }

    lastSaved.current = {
      outcomeType: effectiveOutcome,
      location: location.trim(),
      names,
      teams: drafts.map((player) => player.team.trim()),
    }
    setBGStatsUrl(url)
    setSaved(true)
    Analytics.track("play_logged", {
      source: "play_log_form",
      player_count: Math.min(participants.length, 999),
      has_scores: participants.some((participant) => participant.score !== null),
    })
    void requestReviewAfterPlaySaved()
    try {
      await onSaved({ bgStatsUrl: url })
    } catch (err) {
      console.error(err)
    }
    void liveTimer.refresh()
  }

  const timerText = matchingTimer && matchingTimer.status !== "finished"
    ? `${matchingTimer.status === "paused" ? "Paused" : "Timer"} ${formatElapsed(elapsedSeconds(matchingTimer))}`
    : null
  const summary = [
    summaryDate(playDate),
    location.trim() || null,
    timerText ?? (duration.trim() !== "" ? `${duration.trim()} min` : null),
  ].filter(Boolean) as string[]
  const needsDetails = location.trim() === "" && duration.trim() === "" && timerText === null
  const footer = competitive
    ? [
        records.bestAtCount !== null ? `Best ${players.length}p: ${records.bestAtCount}` : null,
        records.average !== null ? `Avg: ${records.average}` : null,
        records.worstWin !== null ? `Worst win: ${records.worstWin}` : null,
      ].filter(Boolean)
    : []
  const teams = Array.from(new Map(players.map((player) => player.team.trim()).filter(Boolean)
    .map((team) => [team.toLowerCase(), team] as const)).values())
  const done = onDone ?? onClose
  const chosenSheet = sheets.find((item) => item.id === chosenSheetId) ?? sheets[0] ?? null

  if (builder !== null) {
    return (
      <Sheet labelledBy={titleId} onEscape={() => setBuilder(null)}>
        <ScoresheetBuilder
          gameName={game.name}
          bggId={game.bgg_id}
          editing={builder.editing}
          titleId={titleId}
          onCancel={() => setBuilder(null)}
          onSaved={(savedSheet) => {
            setSheets((current) => [...current.filter((item) => item.id !== savedSheet.id), savedSheet])
            setChosenSheetId(savedSheet.id)
            applySheet(savedSheet)
            setBuilder(null)
          }}
          onDeleted={(id) => {
            setSheets((current) => current.filter((item) => item.id !== id))
            setChosenSheetId(null)
            if (sheet?.id === id) switchToPlainScores()
            setBuilder(null)
          }}
        />
      </Sheet>
    )
  }

  return (
    <Sheet labelledBy={titleId} onEscape={() => { if (!saving) (saved ? done : onClose)() }}>
      <header className="play-sheet-header">
        {saved
          ? <span />
          : <button type="button" className="sheet-text-button" onClick={onClose} disabled={saving}>Cancel</button>}
        <div className="play-sheet-title">
          <span className="play-sheet-cover">
            <ResilientGameArtwork src={game.thumbnail_url ?? game.image_url} alt="" gameName={game.name} />
          </span>
          <span className="play-sheet-title-text">
            <h2 id={titleId}>{game.name}</h2>
            <span>{isEditing ? "Edit play" : saved ? "Saved" : "Log play"}</span>
          </span>
        </div>
        {saved
          ? <button type="button" className="sheet-text-button sheet-strong" onClick={done}>Done</button>
          : <button
              type="submit"
              form={formId}
              className="sheet-save-button"
              disabled={saving}
              aria-busy={saving}
              aria-label={isEditing ? "Save changes" : "Save play"}
            >
              {saving ? "Saving…" : "Save"}
            </button>}
      </header>

      {saved ? (
        <div className="play-saved" role="status">
          <strong>Play saved</strong>
          <div className="play-saved-actions">
            <button type="button" className="secondary-button" onClick={() => { void lightImpact(); startRematch() }}>Rematch</button>
            {bgStatsUrl && <a className="bgstats-button" href={bgStatsUrl} target="_blank" rel="noopener noreferrer">Send to BG Stats</a>}
          </div>
        </div>
      ) : (
        <form
          id={formId}
          className="play-sheet-form"
          noValidate
          onSubmit={(event) => { event.preventDefault(); void savePlay() }}
        >
          <datalist id={`${ids}-known`}>
            {knownPlayers.map((player) => <option key={player.id} value={player.name} />)}
          </datalist>

          <div className="play-summary-row">
            <button
              type="button"
              className="play-summary-button"
              aria-expanded={detailsOpen}
              aria-controls={detailsId}
              aria-label={`Date, place and time: ${summary.join(", ")}. ${detailsOpen ? "Hide" : "Edit"}`}
              onClick={() => setDetailsOpen((open) => !open)}
            >
              <svg className="play-summary-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <rect x="3.5" y="5" width="17" height="15" rx="2" />
                <path d="M3.5 9.5h17M8 3v4M16 3v4" />
              </svg>
              <span className="play-summary-text">
                {summary.join(" · ")}
                {needsDetails && <span className="play-summary-hint"> · Add place & time</span>}
              </span>
              <span className="play-summary-chevron" aria-hidden="true">{detailsOpen ? "▴" : "▾"}</span>
            </button>
            {!schema && <label className="play-type-menu">
              <span className="sr-only">Result type</span>
              <select
                value={outcomeType}
                onChange={(event) => { setOutcomeType(event.target.value as OutcomeType); setError("") }}
              >
                {OUTCOME_TYPES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>}
          </div>

          {detailsOpen && (
            <div id={detailsId} className="play-details">
              <label>
                <span>Date</span>
                <input type="date" value={playDate} onChange={(event) => setPlayDate(event.target.value)} />
              </label>
              <label>
                <span>Minutes</span>
                <input
                  type="number"
                  min="0"
                  inputMode="numeric"
                  placeholder="60"
                  value={duration}
                  onChange={(event) => setDuration(event.target.value)}
                />
              </label>
              <label className="play-details-wide">
                <span>Location</span>
                <input
                  type="text"
                  maxLength={200}
                  autoComplete="off"
                  placeholder="e.g. The Dice Cup"
                  value={location}
                  onChange={(event) => { locationTouched.current = true; setLocation(event.target.value) }}
                />
              </label>
              {liveTimer.enabled && !isEditing && (
                <div className="play-details-wide play-timer">
                  {matchingTimer ? (
                    <>
                      <strong className="play-timer-clock">{formatElapsed(elapsedSeconds(matchingTimer))}</strong>
                      {matchingTimer.status === "running" && <button type="button" className="secondary-button" disabled={liveTimer.pending} onClick={() => void liveTimer.pause()}>Pause</button>}
                      {matchingTimer.status === "paused" && <button type="button" className="secondary-button" disabled={liveTimer.pending} onClick={() => void liveTimer.resume()}>Resume</button>}
                      {matchingTimer.status !== "finished" && <button type="button" className="primary-button" disabled={liveTimer.pending} onClick={() => void liveTimer.finish()}>Finish</button>}
                      {matchingTimer.status === "finished" && <span role="status">Duration ready</span>}
                    </>
                  ) : liveTimer.timer ? (
                    <p className="supporting-copy">A timer is already running for {liveTimer.timer.game.name}.</p>
                  ) : (
                    <button
                      type="button"
                      className="secondary-button"
                      disabled={liveTimer.pending}
                      onClick={() => void liveTimer.start(game.bgg_id, players.map((player) => player.name.trim()).filter(Boolean), location.trim())}
                    >
                      Start timer · Pro
                    </button>
                  )}
                  {liveTimer.error && <p className="error-message" role="alert">{liveTimer.error}</p>}
                </div>
              )}
            </div>
          )}

          <div className="play-players-head">
            <span className="preference-label">Players · {players.length}</span>
            {competitive && !manualPlaces && !schema && (
              <label className="play-direction-menu">
                <span className="sr-only">Scoring</span>
                <select
                  value={direction}
                  onChange={(event) => { directionTouched.current = true; setDirection(event.target.value as ScoreDirection) }}
                >
                  <option value="highest">Highest wins</option>
                  <option value="lowest">Lowest wins</option>
                </select>
              </label>
            )}
            {players.length > 0 && (
              <button type="button" className="sheet-text-button" aria-pressed={removing} onClick={() => setRemoving((value) => !value)}>
                {removing ? "Done" : "Edit"}
              </button>
            )}
          </div>

          {players.length > 0 && (
            <ul className="play-rows">
              {shown.map((player, index) => {
                const label = player.name.trim() || `Player ${index + 1}`
                const best = competitive ? playerBestFor(records, player.name) : null
                return (
                  <li className={player.isWinner && competitive ? "play-row winner" : "play-row"} key={index}>
                    {removing && (
                      <button type="button" className="play-row-remove" aria-label={`Remove ${label}`} onClick={() => removePlayer(index)}>−</button>
                    )}
                    {competitive && !manualPlaces && (
                      <button
                        type="button"
                        className="play-winner-toggle"
                        aria-pressed={player.isWinner}
                        aria-label={`${label} won`}
                        onClick={() => toggleWinner(index)}
                      >
                        <TrophyIcon />
                      </button>
                    )}
                    {competitive && manualPlaces && (
                      <input
                        className="play-row-place"
                        type="number"
                        min="1"
                        max="99"
                        inputMode="numeric"
                        placeholder="#"
                        aria-label={`Place for ${label}`}
                        value={player.rank}
                        onChange={(event) => updatePlayer(index, { rank: event.target.value })}
                      />
                    )}
                    <PlayerAvatar name={player.name} variant={avatarFor(player.name)} className="play-row-avatar" />
                    <input
                      className="play-row-name"
                      type="text"
                      list={`${ids}-known`}
                      autoComplete="off"
                      placeholder="Player name"
                      aria-label={`Player ${index + 1} name`}
                      value={player.name}
                      onChange={(event) => updatePlayer(index, { name: event.target.value })}
                    />
                    {effectiveOutcome === "team" && (
                      <input
                        className="play-row-team"
                        type="text"
                        maxLength={50}
                        autoComplete="off"
                        placeholder="Team"
                        aria-label={`Team for ${label}`}
                        value={player.team}
                        onChange={(event) => updatePlayer(index, { team: event.target.value })}
                      />
                    )}
                    {schema
                      ? <span className="play-row-total" aria-label={`${label} total ${player.score}`}>{player.score}</span>
                      : <input
                          className="play-row-score"
                          type="number"
                          inputMode="decimal"
                          placeholder="Score"
                          aria-label={`Score for ${label}`}
                          value={player.score}
                          onChange={(event) => updatePlayer(index, { score: event.target.value })}
                        />}
                    {competitive && !schema && (
                      // Always present so every score box lines up, with or without a record.
                      best !== null
                        ? <span className="play-row-best" aria-label={`${label}'s best: ${best}`}>best {best}</span>
                        : <span className="play-row-best" aria-hidden="true" />
                    )}
                  </li>
                )
              })}
            </ul>
          )}

          {canAdd && (
            <div className="play-add">
              {missing > 0 && <p className="play-add-hint">Tonight: add {missing} more {missing === 1 ? "player" : "players"}.</p>}
              {chips.length > 0 && (
                <div className="play-chips" role="group" aria-label="Recent players">
                  {chips.map((player) => (
                    <button type="button" key={player.id} className="play-chip" aria-label={`Add ${player.name}`} onClick={() => addPlayer(player.name)}>
                      <PlayerAvatar name={player.name} variant={player.avatar_key} />
                      <span>{player.name}</span>
                    </button>
                  ))}
                </div>
              )}
              <div className="play-add-field">
                <input
                  type="text"
                  list={`${ids}-known`}
                  autoComplete="off"
                  enterKeyHint="done"
                  placeholder="Add player"
                  aria-label="Add player"
                  value={newName}
                  onChange={(event) => setNewName(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") { event.preventDefault(); addPlayer(newName) }
                  }}
                />
                <button type="button" className="sheet-text-button" disabled={newName.trim() === ""} onClick={() => addPlayer(newName)}>Add</button>
              </div>
            </div>
          )}

          {schema && sheet && scored ? (
            <section className="scoresheet-section" aria-label="Scoresheet">
              <div className="scoresheet-head">
                <span className="preference-label">{schema.name}</span>
                {sheet.kind === "custom" && canBuildSheets && sheet.version === sheet.current_version && (
                  <button type="button" className="sheet-text-button" onClick={() => setBuilder({ editing: sheet })}>Edit sheet</button>
                )}
                <button type="button" className="sheet-text-button" onClick={switchToPlainScores}>Plain scores</button>
              </div>
              {sheet.version < sheet.current_version && (
                <p className="scoresheet-meta">Logged on version {sheet.version} of this sheet. Newer plays use version {sheet.current_version}.</p>
              )}
              {players.length === 0 && !cooperativeSheet
                ? <p className="scoresheet-meta">Add players to fill in the scoresheet.</p>
                : <ScoresheetGrid
                    sheet={schema}
                    columns={cooperativeSheet ? ["Team"] : shown.map((player, index) => player.name.trim() || `Player ${index + 1}`)}
                    breakdowns={columnBreakdowns}
                    roundCounts={roundCounts}
                    scored={scored}
                    caption={`${schema.name} scoresheet`}
                    onChange={updateBreakdown}
                    onAddRound={(id) => setExtraRounds((current) => ({ ...current, [id]: (roundCounts[id] ?? 1) + 1 }))}
                  />}
              {sheetComplete && <p className="scoresheet-meta" role="status">All scores entered.</p>}
              {cooperativeSheet && (
                <p className="scoresheet-result">
                  Team score {formatNumber(scored.totals[0] ?? 0)}{scored.resultBand ? ` · ${scored.resultBand}` : ""}
                </p>
              )}
              {soloTarget !== null && (
                <p className="scoresheet-result">
                  {soloTarget ? "Target reached: won" : `Below the target of ${formatNumber(schema.target_score ?? 0)}: lost`}
                </p>
              )}
            </section>
          ) : sheetLoading ? (
            <p className="scoresheet-meta" role="status">Loading scoresheet…</p>
          ) : (sheets.length > 0 || canBuildSheets) && (
            <div className="scoresheet-picker">
              {sheets.length > 1 && (
                <label className="play-inline-select">
                  <span>Scoresheet</span>
                  <select value={chosenSheet?.id ?? ""} onChange={(event) => setChosenSheetId(Number(event.target.value))}>
                    {sheets.map((item) => (
                      <option key={item.id} value={item.id}>{item.schema.name}{item.kind === "custom" ? " (yours)" : ""}</option>
                    ))}
                  </select>
                </label>
              )}
              {chosenSheet && (
                <button type="button" className="secondary-button" onClick={() => applySheet(chosenSheet)}>
                  Use scoresheet
                </button>
              )}
              {canBuildSheets && (
                <button type="button" className="sheet-text-button" onClick={() => setBuilder({ editing: null })}>
                  Build a scoresheet
                </button>
              )}
            </div>
          )}

          {competitive && players.length > 1 && schema && (
            <div className="play-winner-note" role="status">
              {winnersOverridden
                ? <><span className="scoresheet-override">Winner chosen by hand.</span> <button type="button" className="sheet-text-button" onClick={() => setWinnersOverridden(false)}>Use calculated result</button></>
                : <span>{scored && scored.winners.length > 0
                    ? `Calculated: ${scored.winners.map((index) => shown[index]?.name.trim()).join(" and ")} ${scored.winners.length > 1 ? "share the win" : "wins"}.`
                    : "No winner yet."}</span>}
            </div>
          )}

          {competitive && players.length > 1 && !schema && (
            <div className="play-winner-note">
              {manualPlaces
                ? <button type="button" className="sheet-text-button" onClick={() => { setManualPlaces(false); setWinnersOverridden(false) }}>Use scores for places</button>
                : winnersOverridden
                  ? <><span>Winner chosen by hand.</span> <button type="button" className="sheet-text-button" onClick={() => setWinnersOverridden(false)}>Use scores</button></>
                  : <button type="button" className="sheet-text-button" onClick={() => { setManualPlaces(true); setWinnersOverridden(false); setPlayers(shown) }}>Set places manually</button>}
            </div>
          )}

          {(effectiveOutcome === "cooperative" || effectiveOutcome === "solo") && soloTarget === null && (
            <fieldset className="play-choice">
              <legend>{effectiveOutcome === "solo" ? "Result" : "Did the group win?"}</legend>
              {(["won", "lost"] as const).map((value) => (
                <label key={value} className={coopResult === value ? "play-choice-option selected" : "play-choice-option"}>
                  <input type="radio" name={`${ids}-coop`} value={value} checked={coopResult === value} onChange={() => setCoopResult(value)} />
                  <span>{value === "won" ? "Won" : "Lost"}</span>
                </label>
              ))}
            </fieldset>
          )}

          {effectiveOutcome === "team" && (
            <label className="play-inline-select">
              <span>Winning team</span>
              <select value={winningTeam} onChange={(event) => setWinningTeam(event.target.value)}>
                <option value="">No winner recorded</option>
                {teams.map((team) => <option key={team} value={team}>{team}</option>)}
              </select>
            </label>
          )}

          {footer.length > 0 && <p className="play-records">{footer.join(" · ")}</p>}

          {error && <p className="error-message" role="alert">{error}</p>}
        </form>
      )}
    </Sheet>
  )
}

type LogPlayButtonProps = Omit<Props, "onClose"> & {
  label?: string
  defaultOpen?: boolean
  className?: string
}

// An inline "Log a play" button that opens the sheet.
export function LogPlayButton({ label = "Log a play", defaultOpen = false, className = "primary-button log-play-button", ...props }: LogPlayButtonProps) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)}>{label}</button>
      {open && <PlayLogForm {...props} onClose={() => setOpen(false)} onDone={props.onDone ? () => { setOpen(false); props.onDone?.() } : undefined} />}
    </>
  )
}

export default PlayLogForm
