import {
  useEffect,
  useRef,
  useState,
} from "react"

import { lightImpact } from "../../haptics"
import { requestReviewAfterPlaySaved } from "../../review-prompt"
import {
  getPlayers,
  recordPlay,
  updatePlay,
  type CoopResult,
  type Game,
  type GamePlay,
  type OutcomeType,
  type Player,
} from "../../api/client"
import {
  OUTCOME_TYPES,
  buildResult,
  draftsFromPlay,
  emptyDraft,
  type PlayPrefill,
  type PlayerDraft,
} from "../../play-results"

import {
  createBGStatsPlayUrl,
} from "../../utils/bgstats"
import {
  useLiveTimer,
} from "../../live-timer"
import { elapsedSeconds, formatElapsed } from "../../live-timer-utils"


type PlayerForm = PlayerDraft


type Props = {
  game: Game
  onSaved: (result: SavedPlayResult) => Promise<void>
  initialPlayerCount?: number
  initialPlayerNames?: string[]
  pickerSessionId?: string | null
  presentation?: "inline" | "dedicated"
  onCancel?: () => void
  initialDurationMinutes?: number | null
  initialLocation?: string
  timerSessionId?: string | null
  // A rematch opens with the same type and teams as an earlier play.
  initialOutcomeType?: OutcomeType
  initialTeams?: string[]
  initialOpen?: boolean
  // Edit an already saved play instead of recording a new one.
  editingPlay?: GamePlay | null
  // Dedicated screens show Rematch and Done after saving.
  onDone?: () => void
}

export type SavedPlayResult = {
  bgStatsUrl: string | null
}

function todayValue() {
  const now = new Date()

  const year = now.getFullYear()

  const month = String(
    now.getMonth() + 1,
  ).padStart(
    2,
    "0",
  )

  const day = String(
    now.getDate(),
  ).padStart(
    2,
    "0",
  )

  return `${year}-${month}-${day}`
}

function localDateValue(iso: string) {
  const date = new Date(iso)
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${date.getFullYear()}-${month}-${day}`
}

function createPlayerForms(
  count: number,
  names: string[] = [],
  teams: string[] = [],
): PlayerForm[] {
  return Array.from(
    {
      length: Math.max(
        1,
        count,
      ),
    },
    (_, index) => emptyDraft(names[index] ?? "", teams[index] ?? ""),
  )
}

function PlayLogForm({
  game,
  onSaved,
  initialPlayerCount = 1,
  initialPlayerNames = [],
  pickerSessionId = null,
  presentation = "inline",
  onCancel,
  initialDurationMinutes = null,
  initialLocation = "",
  timerSessionId = null,
  initialOutcomeType = "competitive",
  initialTeams = [],
  initialOpen = false,
  editingPlay = null,
  onDone,
}: Props) {
  const liveTimer = useLiveTimer()
  const isDedicated = presentation === "dedicated"
  const isEditing = editingPlay !== null
  const editDraft = editingPlay ? draftsFromPlay(editingPlay) : null
  const [open, setOpen] =
    useState(isDedicated || initialOpen)

  const [
    playDate,
    setPlayDate,
  ] = useState(
    editingPlay ? localDateValue(editingPlay.played_at) : todayValue(),
  )

  const [
    duration,
    setDuration,
  ] = useState(
    editingPlay
      ? editingPlay.duration_minutes === null ? "" : String(editingPlay.duration_minutes)
      : initialDurationMinutes === null ? "" : String(initialDurationMinutes),
  )

  const [location, setLocation] = useState(editingPlay ? editingPlay.location ?? "" : initialLocation)
  const [outcomeType, setOutcomeType] = useState<OutcomeType>(
    editingPlay ? editingPlay.outcome_type : initialOutcomeType,
  )
  const [coopResult, setCoopResult] = useState<CoopResult | "">(editDraft?.coopResult ?? "")
  const [winningTeam, setWinningTeam] = useState(editDraft?.winningTeam ?? "")
  const lastSaved = useRef<PlayPrefill | null>(null)
  const [, redrawTimer] = useState(0)

  const [
    players,
    setPlayers,
  ] = useState<PlayerForm[]>(
    editDraft
      ? editDraft.drafts
      : createPlayerForms(
          initialPlayerCount,
          initialPlayerNames,
          initialTeams,
        ),
  )

  const [
    knownPlayers,
    setKnownPlayers,
  ] = useState<Player[]>([])

  const [
    saving,
    setSaving,
  ] = useState(false)

  const [
    error,
    setError,
  ] = useState("")

  const [
    saved,
    setSaved,
  ] = useState(false)

  const [
    bgStatsUrl,
    setBGStatsUrl,
  ] = useState<string | null>(
    null,
  )

  const savePending = useRef(false)
  const matchingTimer = liveTimer.timer?.game.bgg_id === game.bgg_id
    ? liveTimer.timer
    : null

  useEffect(() => {
    if (matchingTimer?.status !== "finished") return
    const id = window.setTimeout(() => {
      setDuration(String(Math.max(0, Math.round(elapsedSeconds(matchingTimer) / 60))))
    }, 0)
    return () => window.clearTimeout(id)
  }, [matchingTimer])

  useEffect(() => {
    if (matchingTimer?.status !== "running") return
    const id = window.setInterval(() => redrawTimer(value => value + 1), 1000)
    return () => window.clearInterval(id)
  }, [matchingTimer?.public_id, matchingTimer?.status])


  useEffect(() => {
    async function loadPlayers() {
      try {
        const result =
          await getPlayers()

        setKnownPlayers(
          result,
        )
      } catch (err) {
        console.error(err)
      }
    }

    loadPlayers()
  }, [])


  function resetForm() {
    setPlayDate(
      todayValue(),
    )

    setDuration("")
    setLocation("")
    setOutcomeType("competitive")
    setCoopResult("")
    setWinningTeam("")

    setPlayers([emptyDraft()])

    setError("")
  }


  function startRematch() {
    const previous = lastSaved.current
    if (previous === null) return
    setPlayDate(todayValue())
    setDuration("")
    setLocation(previous.location)
    setOutcomeType(previous.outcomeType)
    setCoopResult("")
    setWinningTeam("")
    setPlayers(
      createPlayerForms(
        previous.names.length,
        previous.names,
        previous.teams,
      ),
    )
    setError("")
    setSaved(false)
    setBGStatsUrl(null)
    setOpen(true)
  }


  function updatePlayer(
    index: number,
    changes: Partial<PlayerForm>,
  ) {
    setPlayers(
      players.map(
        (
          player,
          playerIndex,
        ) =>
          playerIndex === index
            ? {
                ...player,
                ...changes,
              }
            : player,
      ),
    )
  }


  function addPlayer() {
    setPlayers([...players, emptyDraft()])
  }


  function removePlayer(
    index: number,
  ) {
    if (
      players.length === 1
    ) {
      return
    }

    setPlayers(
      players.filter(
        (
          _,
          playerIndex,
        ) =>
          playerIndex !== index,
      ),
    )
  }


  async function refreshPlayers() {
    try {
      const result =
        await getPlayers()

      setKnownPlayers(
        result,
      )
    } catch (err) {
      console.error(err)
    }
  }


  async function savePlay() {
    if (savePending.current) {
      return
    }

    const names = players.map((player) => player.name.trim())

    if (names.some((name) => name.length === 0)) {
      setError(
        "Please enter a name for every player.",
      )

      return
    }
    const normalizedNames = names.map(
      (name) => name.toLowerCase().replace(/\s+/g, " "),
    )

    const hasDuplicatePlayers =
      new Set(
        normalizedNames,
      ).size !==
      normalizedNames.length

    if (hasDuplicatePlayers) {
      setError(
        "The same player can't be added twice.",
      )

      return
    }
    if (
      players.some(
        (player) =>
          player.score.trim() !== "" &&
          Number.isNaN(Number(player.score)),
      )
    ) {
      setError(
        "Scores must be numbers.",
      )

      return
    }

    const built = buildResult(
      outcomeType,
      players,
      coopResult,
      winningTeam,
    )

    if (!built.ok) {
      setError(built.error)

      return
    }

    const { participants, result } = built

    const durationMinutes =
      duration.trim() === ""
        ? null
        : Number(
            duration,
          )

    if (
      durationMinutes !==
        null &&
      (
        Number.isNaN(
          durationMinutes,
        ) ||
        durationMinutes < 0
      )
    ) {
      setError(
        "Duration must be a valid number.",
      )

      return
    }

    savePending.current = true
    setSaving(true)
    setError("")
    setSaved(false)

    let url: string | null = null
    let succeeded = false

    try {
      const playedAt =
        editingPlay && playDate === localDateValue(editingPlay.played_at)
          ? editingPlay.played_at
          : new Date(
              `${playDate}T12:00:00`,
            ).toISOString()

      if (editingPlay) {
        await updatePlay(editingPlay.id, {
          played_at: playedAt,
          duration_minutes: durationMinutes,
          location: location.trim() === "" ? null : location.trim(),
          participants,
          ...result,
        })
      } else {
        const savedPlay =
          await recordPlay(
            game.bgg_id,
            playedAt,
            durationMinutes,
            participants,
            pickerSessionId,
            location,
            timerSessionId ?? (matchingTimer?.status === "finished" ? matchingTimer.public_id : null),
            result,
          )

        url =
          createBGStatsPlayUrl(
            game,
            savedPlay,
            participants,
            durationMinutes,
            result,
          )
      }
      succeeded = true
    } catch (err) {
      console.error(err)

      setError(
        isEditing ? "Couldn't save your changes." : "Couldn't save this play.",
      )
    } finally {
      savePending.current = false
      setSaving(false)
    }

    if (!succeeded) {
      return
    }

    void lightImpact()

    if (isEditing) {
      try {
        await onSaved({ bgStatsUrl: null })
      } catch (err) {
        console.error(err)
      }
      return
    }

    lastSaved.current = {
      outcomeType,
      location: location.trim(),
      names,
      teams: players.map((player) => player.team.trim()),
    }
    setBGStatsUrl(url)
    setSaved(true)

    if (!isDedicated) {
      resetForm()
      setOpen(false)
    }

    void requestReviewAfterPlaySaved()

    try {
      await onSaved({
        bgStatsUrl: url,
      })
    } catch (err) {
      console.error(err)
    }

    void refreshPlayers()
    void liveTimer.refresh()
  }


  return (
    <>
      <datalist id="known-players">
        {knownPlayers.map(
          (player) => (
            <option
              key={player.id}
              value={player.name}
            />
          ),
        )}
      </datalist>

      {!isDedicated && (
        <button
          type="button"
          className={
            saved && !open
              ? "secondary-button log-play-button"
              : "primary-button log-play-button"
          }
          onClick={() => {
            setOpen(
              !open,
            )

            setError("")
            setSaved(false)
            setBGStatsUrl(null)
          }}
        >
          {open
            ? "Cancel"
            : saved
              ? "Log another play"
              : "Log a play"}
        </button>
      )}

      {open && !(saved && isDedicated && onDone) && (
        <form
          className={
            isDedicated
              ? "play-form play-form-dedicated"
              : "play-form"
          }
          onSubmit={(event) => {
            event.preventDefault()
            void savePlay()
          }}
        >
          <div className="play-form-heading">
            <div>
              <p className="preference-label">
                {isEditing ? "Edit play" : "New play"}
              </p>

              <strong>
                {game.name}
              </strong>
            </div>
          </div>

          <div className="play-form-grid">
            <label>
              <span>
                Date
              </span>

              <input
                type="date"
                value={
                  playDate
                }
                onChange={(
                  event,
                ) =>
                  setPlayDate(
                    event
                      .target
                      .value,
                  )
                }
              />
            </label>

            <label>
              <span>
                Duration
              </span>

              <div className="duration-input">
                <input
                  type="number"
                  min="0"
                  inputMode="numeric"
                  placeholder="60"
                  value={
                    duration
                  }
                  onChange={(
                    event,
                  ) =>
                    setDuration(
                      event
                        .target
                        .value,
                    )
                  }
                />

                <small>
                  min
                </small>
              </div>
            </label>
          </div>

          <label className="play-location-field">
            <span>Location <small>Optional</small></span>
            <input
              type="text"
              maxLength={200}
              autoComplete="off"
              placeholder="e.g. The Dice Cup"
              value={location}
              onChange={(event) => setLocation(event.target.value)}
            />
          </label>

          <fieldset className="outcome-type-field">
            <legend className="preference-label">Result type</legend>
            <div className="outcome-type-options">
              {OUTCOME_TYPES.map((option) => (
                <label
                  key={option.value}
                  className={
                    outcomeType === option.value
                      ? "outcome-type-option selected"
                      : "outcome-type-option"
                  }
                >
                  <input
                    type="radio"
                    name="outcome-type"
                    value={option.value}
                    checked={outcomeType === option.value}
                    onChange={() => {
                      setOutcomeType(option.value)
                      setError("")
                    }}
                  />
                  <span>{option.label}</span>
                </label>
              ))}
            </div>
          </fieldset>

          {liveTimer.enabled && !isEditing && (
            <section className="play-timer-panel" aria-labelledby="play-timer-heading">
              <div>
                <p className="preference-label" id="play-timer-heading">Live duration · Pro</p>
                <p>Keep an accurate duration while you use ShelfPick.</p>
              </div>
              {matchingTimer ? (
                <>
                  <strong className="play-timer-value">{formatElapsed(elapsedSeconds(matchingTimer))}</strong>
                  <div className="play-timer-actions">
                    {matchingTimer.status === "running" && <button type="button" className="secondary-button" disabled={liveTimer.pending} onClick={() => void liveTimer.pause()}>Pause</button>}
                    {matchingTimer.status === "paused" && <button type="button" className="secondary-button" disabled={liveTimer.pending} onClick={() => void liveTimer.resume()}>Resume</button>}
                    {matchingTimer.status !== "finished" && <button type="button" className="primary-button" disabled={liveTimer.pending} onClick={() => void liveTimer.finish()}>Finish</button>}
                    {matchingTimer.status === "finished" && <span role="status">Duration ready to review</span>}
                  </div>
                </>
              ) : liveTimer.timer ? (
                <p className="supporting-copy">A timer is already active for {liveTimer.timer.game.name}.</p>
              ) : (
                <button
                  type="button"
                  className="secondary-button"
                  disabled={liveTimer.pending}
                  onClick={() => void liveTimer.start(game.bgg_id, players.map(player => player.name.trim()).filter(Boolean), location.trim())}
                >
                  Start timer
                </button>
              )}
              {liveTimer.error && <p className="error-message" role="alert">{liveTimer.error}</p>}
            </section>
          )}

          <div className="player-form-heading">
            <p className="preference-label">
              Players
            </p>

            <span>
              {players.length}
            </span>
          </div>

          <div className="player-forms">
            {players.map(
              (
                player,
                index,
              ) => (
                <div
                  className="player-form-card"
                  key={index}
                >
                  <div className="player-form-number">
                    <strong>
                      Player{" "}
                      {index + 1}
                    </strong>

                    {players.length >
                      1 && (
                      <button
                        type="button"
                        onClick={() =>
                          removePlayer(
                            index,
                          )
                        }
                      >
                        Remove
                      </button>
                    )}
                  </div>

                  <div className="player-input-row">
                    <label>
                      <span>
                        Name
                      </span>

                      <input
                        type="text"
                        list="known-players"
                        autoComplete="off"
                        value={
                          player.name
                        }
                        placeholder="Player name"
                        onChange={(
                          event,
                        ) =>
                          updatePlayer(
                            index,
                            {
                              name:
                                event
                                  .target
                                  .value,
                            },
                          )
                        }
                      />
                    </label>

                    <label className="score-field">
                      <span>
                        Score
                      </span>

                      <input
                        type="number"
                        inputMode="decimal"
                        value={
                          player.score
                        }
                        placeholder="—"
                        onChange={(
                          event,
                        ) =>
                          updatePlayer(
                            index,
                            {
                              score:
                                event
                                  .target
                                  .value,
                            },
                          )
                        }
                      />
                    </label>
                  </div>

                  {outcomeType === "team" && (
                    <label className="team-field">
                      <span>Team</span>

                      <input
                        type="text"
                        maxLength={50}
                        autoComplete="off"
                        placeholder="e.g. Red"
                        value={player.team}
                        onChange={(event) =>
                          updatePlayer(index, { team: event.target.value })
                        }
                      />
                    </label>
                  )}

                  {outcomeType === "competitive" && (
                    <label className="rank-field">
                      <span>Place <small>Optional</small></span>

                      <input
                        type="number"
                        min="1"
                        max="99"
                        inputMode="numeric"
                        placeholder="1"
                        value={player.rank}
                        onChange={(event) =>
                          updatePlayer(index, { rank: event.target.value })
                        }
                      />
                    </label>
                  )}

                  {outcomeType === "competitive" && player.rank.trim() === "" && (
                  <label className="winner-toggle">
                    <input
                      type="checkbox"
                      checked={
                        player.isWinner
                      }
                      onChange={(
                        event,
                      ) =>
                        updatePlayer(
                          index,
                          {
                            isWinner:
                              event
                                .target
                                .checked,
                          },
                        )
                      }
                    />

                    <span>
                      Winner
                    </span>
                  </label>
                  )}
                </div>
              ),
            )}
          </div>

          {outcomeType !== "solo" && (
            <button
              type="button"
              className="add-player-button"
              onClick={
                addPlayer
              }
            >
              + Add player
            </button>
          )}

          {(outcomeType === "cooperative" || outcomeType === "solo") && (
            <fieldset className="coop-result-field">
              <legend className="preference-label">
                {outcomeType === "solo" ? "Result" : "Did the group win?"}
              </legend>
              <div className="outcome-type-options">
                {(["won", "lost"] as const).map((value) => (
                  <label
                    key={value}
                    className={
                      coopResult === value
                        ? "outcome-type-option selected"
                        : "outcome-type-option"
                    }
                  >
                    <input
                      type="radio"
                      name="coop-result"
                      value={value}
                      checked={coopResult === value}
                      onChange={() => setCoopResult(value)}
                    />
                    <span>{value === "won" ? "Won" : "Lost"}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          )}

          {outcomeType === "team" && (
            <label className="winning-team-field">
              <span>Winning team</span>
              <select
                value={winningTeam}
                onChange={(event) => setWinningTeam(event.target.value)}
              >
                <option value="">No winner recorded</option>
                {Array.from(
                  new Map(
                    players
                      .map((player) => player.team.trim())
                      .filter(Boolean)
                      .map((team) => [team.toLowerCase(), team] as const),
                  ).values(),
                ).map((team) => (
                  <option key={team} value={team}>{team}</option>
                ))}
              </select>
            </label>
          )}

          {error && (
            <p className="error-message" role="alert">
              {error}
            </p>
          )}

          <div className="play-form-actions">
            <button
              type="submit"
              className="primary-button save-play-button"
              disabled={saving}
              aria-busy={saving}
            >
              {saving
                ? "Saving..."
                : isEditing ? "Save changes" : "Save play"}
            </button>

            {isDedicated && onCancel && (
              <button
                type="button"
                className="ghost-button cancel-play-button"
                onClick={onCancel}
                disabled={saving}
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      )}

      {saved && !isEditing && (
        <div className="play-confirmation-panel">
          <p className="play-confirmation">
            Play saved.
          </p>

          <button
            type="button"
            className="secondary-button rematch-button"
            onClick={() => {
              void lightImpact()
              startRematch()
            }}
          >
            Rematch
          </button>

          {onDone && (
            <button
              type="button"
              className="primary-button"
              onClick={onDone}
            >
              Done
            </button>
          )}

          {bgStatsUrl && (
            <a
              className="bgstats-button"
              href={
                bgStatsUrl
              }
              target="_blank"
              rel="noopener noreferrer"
            >
              Send to BG Stats
            </a>
          )}
        </div>
      )}
    </>
  )
}


export default PlayLogForm
