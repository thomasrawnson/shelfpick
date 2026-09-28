import {
  useState,
} from "react"
import { Link } from "react-router-dom"

import {
  addGameToCollection,
  searchBGGGames,
  type BGGSearchResult,
  type Game,
} from "../../api/client"
import { APP_PATHS } from "../../routes"


type Props = {
  onGameAdded: (
    game: Game,
  ) => void
  onClose: () => void
}


function AddGameSearch({
  onGameAdded,
  onClose,
}: Props) {
  const [
    query,
    setQuery,
  ] = useState("")

  const [
    results,
    setResults,
  ] = useState<
    BGGSearchResult[]
  >([])

  const [
    searching,
    setSearching,
  ] = useState(false)

  const [
    addingId,
    setAddingId,
  ] = useState<number | null>(
    null
  )

  const [
    error,
    setError,
  ] = useState("")

  const [status, setStatus] = useState("")
  const [hasSearched, setHasSearched] = useState(false)


  async function search() {
    const cleaned =
      query.trim()

    if (cleaned.length < 2) {
      return
    }

    setSearching(true)
    setError("")
    setStatus("")

    try {
      const found =
        await searchBGGGames(
          cleaned
        )

      setResults(
        found
      )
      setHasSearched(true)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Couldn't search BoardGameGeek."
      )
    } finally {
      setSearching(false)
    }
  }


  async function addGame(
    result: BGGSearchResult,
  ) {
    setAddingId(
      result.bgg_id
    )

    setError("")
    setStatus("")

    try {
      const game =
        await addGameToCollection(
          result.bgg_id
        )

      onGameAdded(
        game
      )

      setStatus(`${game.name} added to your collection.`)

      setResults(
        (current) =>
          current.map(
            (item) =>
              item.bgg_id
              === result.bgg_id
                ? {
                    ...item,
                    owned: true,
                  }
                : item
          )
      )
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Couldn't add that game."
      )
    } finally {
      setAddingId(
        null
      )
    }
  }


  return (
    <section className="add-game-panel" id="add-game-panel" aria-labelledby="add-game-heading">
      <div className="add-game-header">
        <div>
          <h2 id="add-game-heading">
            Search BoardGameGeek
          </h2>
        </div>

        <button
          type="button"
          className="ghost-button"
          onClick={onClose}
        >
          Close
        </button>
      </div>


      <form className="add-game-search-row" onSubmit={(event) => { event.preventDefault(); void search() }}>
        <label className="sr-only" htmlFor="add-game-query">Game title</label>
        <input
          id="add-game-query"
          className="setup-input"
          type="search"
          autoFocus
          value={query}
          placeholder="e.g. Heat: Pedal to the Metal"
          onChange={(event) =>
            setQuery(
              event.target.value
            )
          }
        />

        <button
          type="submit"
          className="primary-button"
          disabled={
            searching
            || query.trim()
              .length < 2
          }
        >
          {searching
            ? "Searching..."
            : "Search"}
        </button>
      </form>


      {error && (
        <p className="error-message" role="alert">
          {error}
        </p>
      )}

      {status && <p className="setup-success add-game-status" role="status">{status}</p>}

      {hasSearched && !searching && results.length === 0 && !error && (
        <p className="add-game-no-results">No BoardGameGeek games matched that title. Try another search.</p>
      )}


      <div className="add-game-results">
        {results.map(
          (result) => (
            <div
              key={
                result.bgg_id
              }
              className="add-game-result"
            >
              <div>
                <strong>
                  {result.name}
                </strong>

                {result.year_published && (
                  <span>
                    {
                      result.year_published
                    }
                  </span>
                )}
              </div>

              <button
                type="button"
                className="ghost-button"
                disabled={
                  result.owned
                  || addingId
                    === result.bgg_id
                }
                onClick={() =>
                  void addGame(
                    result
                  )
                }
              >
                {result.owned
                  ? "Owned"
                  : addingId
                    === result.bgg_id
                    ? "Adding..."
                    : "Add"}
              </button>
            </div>
          ),
        )}
      </div>

      <p className="add-game-import">
        Adding a whole shelf? <Link to={APP_PATHS.settingsCollectionData}>Import from BoardGameGeek</Link>
      </p>
    </section>
  )
}


export default AddGameSearch
