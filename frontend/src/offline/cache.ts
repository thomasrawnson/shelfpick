import { useSyncExternalStore } from "react"

import { isUnreachableError } from "./connectivity.ts"

// Read-through cache for the screens that work without a connection: the shelf, game details, plays and
// every scoresheet version the person has opened. A fresh answer replaces the saved copy. When the
// server cannot be reached the saved copy is returned and its age is published so the screen can say
// "last updated". Copies belong to one account and are removed on sign-out. Nothing here is a token.
type SavedCopy<T> = { at: number; data: T }
type Listener = () => void

const PREFIX = "shelfpick.cache."
let owner: number | null = null
const memory = new Map<string, string>()
const stale = new Map<string, number>()
let staleSnapshot: ReadonlyMap<string, number> = new Map()
const listeners = new Set<Listener>()

function emit() {
  staleSnapshot = new Map(stale)
  for (const listener of listeners) listener()
}

function storageKey(name: string): string | null {
  return owner === null ? null : `${PREFIX}${owner}.${name}`
}

function read(key: string): string | null {
  try {
    return localStorage.getItem(key) ?? memory.get(key) ?? null
  } catch {
    return memory.get(key) ?? null
  }
}

function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
    memory.delete(key)
  } catch {
    // Storage is full or blocked: keep it for this session only.
    memory.set(key, value)
  }
}

// The signed-in account, or null. Copies are only read or written for an account.
export function setCacheOwner(userId: number | null): void {
  if (owner === userId) return
  owner = userId
  stale.clear()
  emit()
}

// Everything saved for any account: used on sign-out and when a session ends.
export function clearAllSavedCopies(): void {
  try {
    const keys: string[] = []
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index)
      if (key?.startsWith(PREFIX)) keys.push(key)
    }
    for (const key of keys) localStorage.removeItem(key)
  } catch { /* storage unavailable */ }
  memory.clear()
  stale.clear()
  emit()
}

export function savedCopy<T>(name: string): SavedCopy<T> | null {
  const key = storageKey(name)
  const raw = key === null ? null : read(key)
  if (raw === null) return null
  try {
    const parsed = JSON.parse(raw) as SavedCopy<T>
    return typeof parsed?.at === "number" ? parsed : null
  } catch {
    return null
  }
}

export function saveCopy<T>(name: string, data: T, now: number = Date.now()): void {
  const key = storageKey(name)
  if (key !== null) write(key, JSON.stringify({ at: now, data } satisfies SavedCopy<T>))
}

// The fresh answer when the server replies; otherwise the saved copy, if there is one. Any other
// failure (a 4xx or 5xx the server sent) is still an error.
export async function readThrough<T>(
  name: string,
  fetcher: () => Promise<T>,
  keep: (data: T) => T = (data) => data,
): Promise<T> {
  try {
    const data = await fetcher()
    saveCopy(name, keep(data))
    if (stale.delete(name)) emit()
    return data
  } catch (error) {
    if (!isUnreachableError(error)) throw error
    const copy = savedCopy<T>(name)
    if (!copy) throw error
    stale.set(name, copy.at)
    emit()
    return copy.data
  }
}

export function useStaleSince(names: string[]): number | null {
  const snapshot = useSyncExternalStore(
    (listener) => { listeners.add(listener); return () => { listeners.delete(listener) } },
    () => staleSnapshot,
    () => staleSnapshot,
  )
  const times = names.map((name) => snapshot.get(name)).filter((value): value is number => value !== undefined)
  return times.length ? Math.min(...times) : null
}

export function staleSinceNow(names: string[]): number | null {
  const times = names.map((name) => stale.get(name)).filter((value): value is number => value !== undefined)
  return times.length ? Math.min(...times) : null
}

// "just now", "5 min ago", "3 h ago", "2 days ago".
export function agoLabel(at: number, now: number = Date.now()): string {
  const minutes = Math.max(0, Math.round((now - at) / 60_000))
  if (minutes < 1) return "just now"
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.round(minutes / 60)
  if (hours < 48) return `${hours} h ago`
  return `${Math.round(hours / 24)} days ago`
}
