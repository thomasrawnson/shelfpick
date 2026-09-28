import RetryNotice from "../ui/RetryNotice"
import {
  useEffect,
  useMemo,
  useState,
} from "react"

import {
  getPlayers,
  type Player,
} from "../../api/client"

import PlayerAvatar from "../ui/PlayerAvatar"

import LoadingMessage
  from "../ui/LoadingMessage"


type Props = {
  selectedPlayerIds: number[]
  onChange: (
    playerIds: number[],
    playerNames: string[],
  ) => void
  onBack: () => void
}


function PlayerSelectionStep({
  selectedPlayerIds,
  onChange,
  onBack,
}: Props) {
  const [
    players,
    setPlayers,
  ] = useState<Player[]>([])

  const [
    search,
    setSearch,
  ] = useState("")

  const [
    loading,
    setLoading,
  ] = useState(true)


  const [error, setError] = useState("")
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let active = true
    async function loadPlayers() {
      try {
        const result =
          await getPlayers()

        if (active) { setPlayers(result); setError("") }
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "Couldn't load players.")
      } finally {
        if (active) setLoading(false)
      }
    }

    void loadPlayers()
    return () => { active = false }
  }, [attempt])


  const filteredPlayers =
    useMemo(() => {
      const query =
        search
          .trim()
          .toLowerCase()

      if (!query) {
        return players
      }

      return players.filter(
        (player) =>
          player.name
            .toLowerCase()
            .includes(
              query
            ),
      )
    }, [
      players,
      search,
    ])


  function togglePlayer(
    playerId: number,
  ) {
    const nextIds = selectedPlayerIds.includes(playerId)
      ? selectedPlayerIds.filter((id) => id !== playerId)
      : [...selectedPlayerIds, playerId]

    onChange(
      nextIds,
      players
        .filter((player) => nextIds.includes(player.id))
        .map((player) => player.name),
    )
  }


  return (
    <section className="screen picker-selection-screen">
      <button
        type="button"
        className="collection-back"
        onClick={onBack}
      >
        ← Back
      </button>

      <header>
        <h1>
          Who's playing?
        </h1>
      </header>


      <label
        className="picker-search-label"
      >
        <span className="sr-only">
          Search players
        </span>

        <input
          type="search"
          className="player-picker-search"
          placeholder="Search players..."
          value={search}
          onChange={(event) =>
            setSearch(
              event.target.value
            )
          }
        />
      </label>


      {error && <RetryNotice message={error} busy={loading} onRetry={() => { setLoading(true); setAttempt(current => current + 1) }} />}
      <div className="picker-selection-list">
        {loading && players.length === 0 ? (
          <p className="picker-selection-empty">
            <LoadingMessage
              messages={[
                "Gathering the usual suspects...",
                "Checking who's free tonight...",
              ]}
            />
          </p>
        ) : filteredPlayers.length
          > 0 ? (
          filteredPlayers.map(
            (player) => {
              const selected =
                selectedPlayerIds
                  .includes(
                    player.id
                  )

              return (
                <button
                  key={player.id}
                  type="button"
                  className={
                    selected
                      ? "picker-selection-row selected"
                      : "picker-selection-row"
                  }
                  aria-pressed={
                    selected
                  }
                  onClick={() =>
                    togglePlayer(
                      player.id
                    )
                  }
                >
                  <span className="picker-selection-person">
                    <PlayerAvatar name={player.name} variant={player.avatar_key} />
                    {player.name}
                  </span>

                  <span
                    className={
                      selected
                        ? "picker-selection-check selected"
                        : "picker-selection-check"
                    }
                    aria-hidden="true"
                  >
                    {selected
                      ? "✓"
                      : ""}
                  </span>
                </button>
              )
            },
          )
        ) : !error && (
          <p className="picker-selection-empty">
            No players match that search — check the spelling, or add someone new.
          </p>
        )}
      </div>


      <div className="picker-selection-footer">
        <span>
          {selectedPlayerIds.length}{" "}
          {selectedPlayerIds.length
            === 1
            ? "player selected"
            : "players selected"}
        </span>

      </div>
    </section>
  )
}


export default PlayerSelectionStep
