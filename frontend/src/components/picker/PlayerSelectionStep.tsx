import RetryNotice from "../ui/RetryNotice"
import {
  useEffect,
  useMemo,
  useState,
} from "react"

import {
  createPlayer,
  getPlayers,
  type Player,
} from "../../api/client"

import PlayerAvatar from "../ui/PlayerAvatar"

import LoadingMessage
  from "../ui/LoadingMessage"
import { selectedPlayerNamesInOrder }
  from "../../player-selection"


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
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState("")
  const [saving, setSaving] = useState(false)
  const [addError, setAddError] = useState("")
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
      selectedPlayerNamesInOrder(players, nextIds),
    )
  }


  async function addPlayer(event: React.FormEvent) {
    event.preventDefault()
    const name = newName.trim()
    if (!name || saving) return
    setSaving(true)
    setAddError("")
    try {
      const player = await createPlayer(name)
      const nextPlayers = players.some((existing) => existing.id === player.id)
        ? players
        : [player, ...players]
      const nextIds = selectedPlayerIds.includes(player.id)
        ? selectedPlayerIds
        : [...selectedPlayerIds, player.id]
      setPlayers(nextPlayers)
      onChange(nextIds, selectedPlayerNamesInOrder(nextPlayers, nextIds))
      setNewName("")
      setSearch("")
      setAdding(false)
    } catch (err) {
      setAddError(err instanceof Error ? err.message : "Couldn't add the player.")
    } finally {
      setSaving(false)
    }
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


      {adding ? (
        <form className="picker-add-player" onSubmit={addPlayer}>
          <label className="picker-search-label">
            <span className="sr-only">New player name</span>
            <input
              type="text"
              className="player-picker-search"
              placeholder="Player's name"
              value={newName}
              maxLength={100}
              autoFocus
              onChange={(event) => setNewName(event.target.value)}
            />
          </label>
          {addError && <p className="picker-add-player-error" role="alert">{addError}</p>}
          <div className="picker-add-player-actions">
            <button type="submit" className="primary-button" disabled={saving || !newName.trim()}>
              {saving ? "Adding..." : "Add and select"}
            </button>
            <button
              type="button"
              className="secondary-button"
              disabled={saving}
              onClick={() => { setAdding(false); setNewName(""); setAddError("") }}
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          className="secondary-button picker-add-player-button"
          onClick={() => { setNewName(search.trim()); setAdding(true) }}
        >
          + Add player
        </button>
      )}

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
            No players match that search. Check the spelling, or use Add player.
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
