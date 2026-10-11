import type { BGGSearchResult } from "./api/client"

export type AddGameDestination = "owned" | "wishlist"

export function beginAddGameAction(
  pendingActions: Set<string>,
  actionKey: string,
): boolean {
  if (pendingActions.size > 0) {
    return false
  }

  pendingActions.add(actionKey)
  return true
}

export function markSearchResultMembership(
  results: BGGSearchResult[],
  bggId: number,
  destination: AddGameDestination,
): BGGSearchResult[] {
  return results.map(
    (item) => item.bgg_id === bggId
      ? {
          ...item,
          [destination === "owned"
            ? "owned"
            : "wishlisted"]: true,
        }
      : item
  )
}
