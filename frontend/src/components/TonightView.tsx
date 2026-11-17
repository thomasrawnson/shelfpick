import { useLocation, useSearchParams } from "react-router-dom"

import type { PickerPlayStyle } from "../api/client"
import { APP_PATHS, type TonightMode } from "../routes"
import { readTonightMode, saveTonightMode } from "../tonight-mode"
import GameNightView from "./GameNightView"
import PickerView from "./picker/PickerView"
import SegmentedControl from "./ui/SegmentedControl"

type Props = {
  defaultPlayers: number | null
  defaultTime: number | null
  defaultPlayStyle: PickerPlayStyle | null
  gameNightEnabled: boolean
  votingEnabled: boolean
  onViewGame: (bggId: number) => void
  onViewShelf: () => void
  onUnlockPro: () => void
}

const MODES: Array<{ value: TonightMode; label: string }> = [
  { value: "solo", label: "Just me" },
  { value: "group", label: "A group" },
  { value: "vote", label: "Group vote" },
]

// One place to decide what to play: alone, with a group, or by group vote.
function TonightView({
  defaultPlayers,
  defaultTime,
  defaultPlayStyle,
  gameNightEnabled,
  votingEnabled,
  onViewGame,
  onViewShelf,
  onUnlockPro,
}: Props) {
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const mode = readTonightMode(searchParams.get("mode"))
  const loggingPlay = location.pathname === APP_PATHS.tonightPlay

  function changeMode(next: TonightMode) {
    saveTonightMode(next)
    setSearchParams({ mode: next }, { replace: true })
  }

  return (
    <>
      {!loggingPlay && (
        <SegmentedControl
          ariaLabel="How are you playing tonight?"
          className="tonight-modes"
          value={mode}
          options={MODES}
          onChange={changeMode}
        />
      )}
      {mode === "vote" && !loggingPlay ? (
        <GameNightView
          defaultTime={defaultTime}
          enabled={gameNightEnabled}
          votingEnabled={votingEnabled}
          onBack={() => changeMode("group")}
          onViewGame={onViewGame}
          onUnlockPro={onUnlockPro}
        />
      ) : (
        <PickerView
          key={mode}
          onViewGame={onViewGame}
          onViewCollection={onViewShelf}
          defaultPlayers={mode === "solo" ? 1 : defaultPlayers}
          defaultTime={defaultTime}
          defaultPlayStyle={defaultPlayStyle}
        />
      )}
    </>
  )
}

export default TonightView
