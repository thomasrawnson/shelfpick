import type { TonightMode } from "./routes"

const STORAGE_KEY = "shelfpick-tonight-mode"
const MODES: TonightMode[] = ["solo", "group", "vote"]

function isMode(value: string | null): value is TonightMode {
  return value !== null && (MODES as string[]).includes(value)
}

// An explicit ?mode= wins; otherwise the last mode used on this device; else a group.
export function readTonightMode(
  param: string | null,
  storage: Pick<Storage, "getItem"> | null = safeStorage(),
): TonightMode {
  if (isMode(param)) return param
  try {
    const stored = storage?.getItem(STORAGE_KEY) ?? null
    if (isMode(stored)) return stored
  } catch { /* Storage can be unavailable. */ }
  return "group"
}

export function saveTonightMode(
  mode: TonightMode,
  storage: Pick<Storage, "setItem"> | null = safeStorage(),
) {
  try { storage?.setItem(STORAGE_KEY, mode) } catch { /* Best effort. */ }
}

function safeStorage(): Storage | null {
  try { return typeof localStorage === "undefined" ? null : localStorage } catch { return null }
}
