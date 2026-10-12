import {
  useRef,
  useState,
} from "react"
import { Link } from "react-router-dom"

import {
  addGameToCollection,
  addToWishlist,
  searchBGGGames,
  type BGGSearchResult,
  type Game,
} from "../../api/client"
import { APP_PATHS } from "../../routes"
import {
  beginAddGameAction,
  markSearchResultMembership,
  type AddGameDestination,
} from "../../add-game-state"


type Props = {
  onGameAdded: (
    game: Game,
  ) => void
  onClose: () => void
}

type ResultProps = {
  result: BGGSearchResult
  pendingAction: string
  onAdd: (
    result: BGGSearchResult,
    destination: "owned" | "wishlist",
  ) => void
}

export function AddGameResult({
  result,
  pendingAction,
  onAdd,
}: ResultProps) {
  return (
    <div className="add-game-result">
      <div>
        <strong>{result.name}</strong>

        {result.year_published && (
          <span>{result.year_published}</span>
        )}
      </div>

      <div className="add-game-result-actions" role="group" aria-label={`Add ${result.name}`}>
        <button
          type="button"
          className="ghost-button"
          disabled={result.owned || Boolean(pendingAction)}
          onClick={() => onAdd(result, "owned")}
        >
          {result.owned
            ? "Already Owned"
            : pendingAction === `owned:${result.bgg_id}`
              ? "Adding to Owned..."
              : "Add to Owned"}
        </button>

        <button
          type="button"
          className="ghost-button"
          disabled={result.wishlisted || Boolean(pendingAction)}
          onClick={() => onAdd(result, "wishlist")}
        >
          {result.wishlisted
            ? "Already Want to Play"
            : pendingAction === `wishlist:${result.bgg_id}`
              ? "Adding to Want to Play..."
              : "Add to Want to Play"}
        </button>
      </div>
    </div>
  )
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

  const [pendingAction, setPendingAction] = useState("")
  const pendingActions = useRef(new Set<string>())

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
    destination: AddGameDestination,
  ) {
    const actionKey = `${destination}:${result.bgg_id}`

    if (!beginAddGameAction(pendingActions.current, actionKey)) {
      return
    }

    setPendingAction(actionKey)

    setError("")
    setStatus("")

    try {
      const game = destination === "owned"
        ? await addGameToCollection(result.bgg_id)
        : await addToWishlist(result.bgg_id)

      if (destination === "owned") {
        onGameAdded(game)
      }

      setStatus(
        destination === "owned"
          ? `${game.name} added to Owned.`
          : `${game.name} added to Want to Play.`
      )

      setResults(
        (current) => markSearchResultMembership(
          current,
          result.bgg_id,
          destination,
        )
      )
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : destination === "owned"
            ? "Couldn't add that game to Owned."
            : "Couldn't add that game to Want to Play."
      )
    } finally {
      pendingActions.current.delete(actionKey)
      setPendingAction("")
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
            <AddGameResult
              key={result.bgg_id}
              result={result}
              pendingAction={pendingAction}
              onAdd={(item, destination) => void addGame(item, destination)}
            />
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
