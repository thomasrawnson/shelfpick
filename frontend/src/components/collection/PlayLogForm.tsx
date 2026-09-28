import {
  useEffect,
  useRef,
  useState,
} from "react"

import {
  getPlayers,
  recordPlay,
  type Game,
  type Player,
  type PlayParticipant,
} from "../../api/client"

import {
  createBGStatsPlayUrl,
} from "../../utils/bgstats"
import {
  useLiveTimer,
} from "../../live-timer"
import { elapsedSeconds, formatElapsed } from "../../live-timer-utils"


type PlayerForm = {
  name: string
  score: string
  isWinner: boolean
}


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

function createPlayerForms(
  count: number,
  names: string[] = [],
): PlayerForm[] {
  return Array.from(
    {
      length: Math.max(
        1,
        count,
      ),
    },
    (_, index) => ({
      name: names[index] ?? "",
      score: "",
      isWinner: false,
    }),
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
}: Props) {
  const liveTimer = useLiveTimer()
  const isDedicated = presentation === "dedicated"
  const [open, setOpen] =
    useState(isDedicated)

  const [
    playDate,
    setPlayDate,
  ] = useState(
    todayValue(),
  )

  const [
    duration,
    setDuration,
  ] = useState(initialDurationMinutes === null ? "" : String(initialDurationMinutes))

  const [location, setLocation] = useState(initialLocation)
  const [, redrawTimer] = useState(0)

  const [
    players,
    setPlayers,
  ] = useState<PlayerForm[]>(
    createPlayerForms(
      initialPlayerCount,
      initialPlayerNames,
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

    setPlayers([
      {
        name: "",
        score: "",
        isWinner: false,
      },
    ])

    setError("")
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
    setPlayers([
      ...players,
      {
        name: "",
        score: "",
        isWinner: false,
      },
    ])
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

    const participants =
      players.map(
        (
          player,
        ): PlayParticipant => ({
          name:
            player.name.trim(),

          score:
            player.score.trim() ===
            ""
              ? null
              : Number(
                  player.score,
                ),

          is_winner:
            player.isWinner,
        }),
      )

    if (
      participants.some(
        (player) =>
          player.name.length ===
          0,
      )
    ) {
      setError(
        "Please enter a name for every player.",
      )

      return
    }
    const normalizedNames =
      participants.map(
        (participant) =>
          participant.name
            .trim()
            .toLowerCase()
            .replace(/\s+/g, " "),
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
      participants.some(
        (player) =>
          player.score !==
            null &&
          Number.isNaN(
            player.score,
          ),
      )
    ) {
      setError(
        "Scores must be numbers.",
      )

      return
    }

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

    try {
      const playedAt =
        new Date(
          `${playDate}T12:00:00`,
        ).toISOString()

      const savedPlay =
        await recordPlay(
          game.bgg_id,
          playedAt,
          durationMinutes,
          participants,
          pickerSessionId,
          location,
          timerSessionId ?? (matchingTimer?.status === "finished" ? matchingTimer.public_id : null),
        )

      url =
        createBGStatsPlayUrl(
          game,
          savedPlay,
          participants,
          durationMinutes,
        )

    } catch (err) {
      console.error(err)

      setError(
        "Couldn't save this play.",
      )
    } finally {
      savePending.current = false
      setSaving(false)
    }

    if (url === null) {
      return
    }

    setBGStatsUrl(url)
    setSaved(true)

    if (!isDedicated) {
      resetForm()
      setOpen(false)
    }

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

      {open && (
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
                New play
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

          {liveTimer.enabled && (
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
                </div>
              ),
            )}
          </div>

          <button
            type="button"
            className="add-player-button"
            onClick={
              addPlayer
            }
          >
            + Add player
          </button>

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
                : "Save play"}
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

      {saved && (
        <div className="play-confirmation-panel">
          <p className="play-confirmation">
            Play saved.
          </p>

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
