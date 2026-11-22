import { useSyncExternalStore } from "react"

// Whether the app can reach ShelfPick. The browser's offline flag is only a hint (a phone can report
// "online" with no signal, and the iOS Simulator has no airplane mode), so every API call also
// reports whether it got an answer.
type Listener = () => void

let online = typeof navigator === "undefined" ? true : navigator.onLine !== false
const listeners = new Set<Listener>()

function set(next: boolean) {
  if (online === next) return
  online = next
  for (const listener of listeners) listener()
}

export function reportReachable(): void { set(true) }
export function reportUnreachable(): void { set(false) }
export function isOnline(): boolean { return online }

export function subscribeConnectivity(listener: Listener): () => void {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

if (typeof window !== "undefined" && typeof window.addEventListener === "function") {
  window.addEventListener("online", reportReachable)
  window.addEventListener("offline", reportUnreachable)
}

export function useOnline(): boolean {
  return useSyncExternalStore(subscribeConnectivity, isOnline, () => true)
}

// A request that never got an answer: no connection, or no reply in time. Anything with an HTTP status
// (even 500) is "reachable".
export class RequestTimeoutError extends Error {}

export function isUnreachableError(error: unknown): boolean {
  return error instanceof RequestTimeoutError
    || (error instanceof Error && error.cause instanceof TypeError)
}
