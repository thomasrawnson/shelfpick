import { useLocation, useSearchParams } from "react-router-dom"

import type { PickerPlayStyle } from "../api/client"
import { APP_PATHS } from "../routes"
import GameNightView from "./GameNightView"
import PickerView from "./picker/PickerView"
import RecentlyPlayed from "./tonight/RecentlyPlayed"

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

// One place to decide what to play: pick for yourself or the table, or send the
// shortlist to the group to vote (?mode=vote, also the old Game Night path).
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
  const voting =
    searchParams.get("mode") === "vote" && location.pathname !== APP_PATHS.tonightPlay

  if (voting) {
    return (
      <GameNightView
        defaultTime={defaultTime}
        enabled={gameNightEnabled}
        votingEnabled={votingEnabled}
        onBack={() => setSearchParams({}, { replace: true })}
        onViewGame={onViewGame}
        onUnlockPro={onUnlockPro}
      />
    )
  }

  return (
    <PickerView
      onViewGame={onViewGame}
      onViewCollection={onViewShelf}
      onGroupVote={() => setSearchParams({ mode: "vote" })}
      playerStepFooter={<RecentlyPlayed onOpenGame={onViewGame} />}
      defaultPlayers={defaultPlayers}
      defaultTime={defaultTime}
      defaultPlayStyle={defaultPlayStyle}
    />
  )
}

export default TonightView
