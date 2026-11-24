import type { AuthUser } from "../auth"

// The profile last returned for the signed-in account, kept so the app can open with no connection.
// The sign-in token is NOT stored here; it stays in secure storage. Cleared on sign-out.
const KEY = "shelfpick.offline.session-user"

export function saveSessionUser(user: AuthUser): void {
  try { localStorage.setItem(KEY, JSON.stringify(user)) } catch { /* storage unavailable */ }
}

export function savedSessionUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw === null) return null
    const user = JSON.parse(raw) as AuthUser
    return typeof user?.id === "number" && typeof user.email === "string" ? user : null
  } catch {
    return null
  }
}

export function clearSessionUser(): void {
  try { localStorage.removeItem(KEY) } catch { /* storage unavailable */ }
}
