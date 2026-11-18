import type { ShelfLayout } from "./components/collection/CollectionGameList"

const STORAGE_KEY = "shelfpick-shelf-layout"

// Grid with covers is the default; the choice is remembered on this device only.
export function readShelfLayout(
  storage: Pick<Storage, "getItem"> | null = safeStorage(),
): ShelfLayout {
  try {
    return storage?.getItem(STORAGE_KEY) === "list" ? "list" : "grid"
  } catch {
    return "grid"
  }
}

export function saveShelfLayout(
  layout: ShelfLayout,
  storage: Pick<Storage, "setItem"> | null = safeStorage(),
) {
  try { storage?.setItem(STORAGE_KEY, layout) } catch { /* Best effort. */ }
}

function safeStorage(): Storage | null {
  try { return typeof localStorage === "undefined" ? null : localStorage } catch { return null }
}
