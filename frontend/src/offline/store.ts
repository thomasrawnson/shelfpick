import { Capacitor } from "@capacitor/core"
import { Preferences } from "@capacitor/preferences"

// Small async key-value store for data that must survive the app being closed. The play queue holds
// work the person has not yet synced, so it lives in native Preferences on iOS (the web view's
// localStorage can be cleared by the system) and in localStorage on the web. Never put a token here.
export interface KeyValueStore {
  get(key: string): Promise<string | null>
  set(key: string, value: string): Promise<void>
  remove(key: string): Promise<void>
}

export function createMemoryStore(initial: Record<string, string> = {}): KeyValueStore & { dump(): Record<string, string> } {
  const data = new Map(Object.entries(initial))
  return {
    async get(key) { return data.get(key) ?? null },
    async set(key, value) { data.set(key, value) },
    async remove(key) { data.delete(key) },
    dump() { return Object.fromEntries(data) },
  }
}

const localStorageStore: KeyValueStore = {
  async get(key) { return localStorage.getItem(key) },
  async set(key, value) { localStorage.setItem(key, value) },
  async remove(key) { localStorage.removeItem(key) },
}

const nativeStore: KeyValueStore = {
  async get(key) { return (await Preferences.get({ key })).value },
  async set(key, value) { await Preferences.set({ key, value }) },
  async remove(key) { await Preferences.remove({ key }) },
}

export function createDeviceStore(): KeyValueStore {
  return Capacitor.isNativePlatform() ? nativeStore : localStorageStore
}
