import type {
  PickerMatch,
} from "../../api/client"

import PlayLogForm, {
  type SavedPlayResult,
} from "../collection/PlayLogForm"

import ResilientGameArtwork
  from "../ResilientGameArtwork"


type Props = {
  match: PickerMatch
  playerCount: number
  playerNames: string[]
  pickerSessionId: string | null
  onCancel: () => void
  onSaved: (result: SavedPlayResult) => Promise<void>
}


function PickerPlayEntry({
  match,
  playerCount,
  playerNames,
  pickerSessionId,
  onCancel,
  onSaved,
}: Props) {
  const game = match.game
  const participantSummary =
    playerNames.length > 0
      ? playerNames.join(", ")
      : `${playerCount} player${playerCount === 1 ? "" : "s"}`

  return (
    <section
      className="screen picker-play-entry"
      aria-labelledby="picker-play-entry-title"
    >
      <header className="picker-play-entry-header">
        <button
          type="button"
          className="collection-back picker-play-entry-back"
          onClick={onCancel}
        >
          ← Back to your pick
        </button>

        <h1 id="picker-play-entry-title">
          Log a play
        </h1>

        <p>
          Record the session while the details are fresh.
        </p>
      </header>

      <div className="picker-play-game-summary">
        <div className="picker-play-game-artwork">
          <ResilientGameArtwork
            src={game.image_url ?? game.thumbnail_url}
            alt={`Cover of ${game.name}`}
            gameName={game.name}
          />
        </div>

        <div>
          <h2>{game.name}</h2>
          <p>{participantSummary}</p>
        </div>
      </div>

      <PlayLogForm
        game={game}
        initialPlayerCount={playerCount}
        initialPlayerNames={playerNames}
        pickerSessionId={pickerSessionId}
        presentation="dedicated"
        onCancel={onCancel}
        onSaved={onSaved}
      />
    </section>
  )
}


export default PickerPlayEntry
