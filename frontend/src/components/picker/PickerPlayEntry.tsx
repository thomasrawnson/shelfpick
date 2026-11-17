import type {
  PickerMatch,
} from "../../api/client"

import PlayLogForm, {
  type SavedPlayResult,
} from "../collection/PlayLogForm"


type Props = {
  match: PickerMatch
  playerCount: number
  playerNames: string[]
  pickerSessionId: string | null
  onCancel: () => void
  onSaved: (result: SavedPlayResult) => Promise<void>
  onDone?: () => void
}


// Tonight's players carry over: named players become rows; a count-only
// session asks for that many players.
function PickerPlayEntry({
  match,
  playerCount,
  playerNames,
  pickerSessionId,
  onCancel,
  onSaved,
  onDone,
}: Props) {
  return (
    <PlayLogForm
      game={match.game}
      initialPlayerCount={playerCount}
      initialPlayerNames={playerNames}
      pickerSessionId={pickerSessionId}
      onClose={onCancel}
      onSaved={onSaved}
      onDone={onDone}
    />
  )
}


export default PickerPlayEntry
