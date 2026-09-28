let lastFocusedEntry: string | null = null
const storageKey = "shelfpick-settings-focus"

export function rememberSettingsEntry(id: string, updateCurrentHistory = false) {
  lastFocusedEntry = id
  window.sessionStorage?.setItem(storageKey, id)
  if (updateCurrentHistory) {
    const historyState = window.history.state ?? {}
    window.history.replaceState({
      ...historyState,
      usr: { ...(historyState.usr ?? {}), focusEntry: id },
    }, "")
  }
}

export function takeRememberedSettingsEntry() {
  const storedEntry = typeof window === "undefined" ? null : window.sessionStorage?.getItem(storageKey)
  const entry = storedEntry ?? lastFocusedEntry
  if (typeof window !== "undefined") window.sessionStorage?.removeItem(storageKey)
  lastFocusedEntry = null
  return entry
}
