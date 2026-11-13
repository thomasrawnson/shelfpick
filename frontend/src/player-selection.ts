import type { Player } from "./api/client"


export function selectedPlayerNamesInOrder(
  players: Player[],
  selectedPlayerIds: number[],
): string[] {
  const namesById = new Map(
    players.map((player) => [player.id, player.name]),
  )

  return selectedPlayerIds.flatMap((playerId) => {
    const name = namesById.get(playerId)
    return name === undefined ? [] : [name]
  })
}
