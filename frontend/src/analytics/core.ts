// Product analytics core: the event catalogue, the property guard and the opt-out gate.
// It never imports an SDK; feature code calls `Analytics` (see ./index.ts) and nothing else.

export type TimeBand = "any" | "up_to_30" | "up_to_60" | "up_to_90" | "up_to_120" | "over_120"

type PropertySpec =
  | { kind: "enum"; values: readonly string[] }
  | { kind: "count" } // whole number 0..999: a count or a bucket, never an ID
  | { kind: "boolean" }

const TIME_BANDS = ["any", "up_to_30", "up_to_60", "up_to_90", "up_to_120", "over_120"] as const
const count: PropertySpec = { kind: "count" }
const timeBandSpec: PropertySpec = { kind: "enum", values: TIME_BANDS }
const oneOf = (...values: string[]): PropertySpec => ({ kind: "enum", values })

// The single source of truth for what may leave the device. docs/analytics/tracking-plan.md
// mirrors it and a test fails if they drift apart. Add an event here first.
export const EVENT_SPECS = {
  app_installed: {},
  app_updated: {},
  app_opened: {},
  app_backgrounded: {},
  onboarding_completed: { player_count: count, time_band: timeBandSpec },
  collection_import_completed: {
    source: oneOf("onboarding_bgg", "settings_bgg", "settings_bgstats"), result_count: count,
  },
  game_added: { source: oneOf("onboarding_search", "collection_search", "wishlist_move") },
  wishlist_added: { source: oneOf("discover", "collection_search") },
  pick_started: { source: oneOf("pick"), player_count: count, time_band: timeBandSpec },
  picker_completed: { source: oneOf("pick"), player_count: count, time_band: timeBandSpec, result_count: count },
  game_night_completed: { source: oneOf("game_night"), player_count: count, time_band: timeBandSpec, result_count: count },
  discover_opened: { tab: oneOf("hot", "top500", "for_you") },
  play_logged: { source: oneOf("play_log_form"), player_count: count, has_scores: { kind: "boolean" } },
  settings_changed: { setting: oneOf("theme", "analytics"), value: oneOf("system", "light", "dark", "black", "on") },
} as const satisfies Record<string, Record<string, PropertySpec>>

export type EventName = keyof typeof EVENT_SPECS

type Value<S extends PropertySpec> =
  S extends { kind: "enum"; values: readonly (infer V)[] } ? V
  : S extends { kind: "count" } ? number
  : boolean
export type EventProperties<N extends EventName> = {
  [K in keyof (typeof EVENT_SPECS)[N]]?: Value<(typeof EVENT_SPECS)[N][K] & PropertySpec>
}

export type CommonProperties = {
  environment: "dev" | "production"
  platform: "ios" | "web" | "android"
  app_version: string
}

export type AnalyticsSdk = {
  init: (opts: { common: CommonProperties }) => void
  capture: (name: string, properties: Record<string, unknown>) => void
  optIn: () => void
  optOut: () => void
}

export type KeyValueStore = {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

export const ANALYTICS_PREF_KEY = "shelfpick.analytics.enabled"
const INSTALLED_VERSION_KEY = "shelfpick.analytics.installed-version"

const EMAIL_LIKE = /\S+@\S+/

/** Returns the properties if every one is allowed for the event, else null (event is dropped). */
export function guardProperties(name: string, properties: Record<string, unknown>): Record<string, unknown> | null {
  const spec = (EVENT_SPECS as Record<string, Record<string, PropertySpec> | undefined>)[name]
  if (!spec) return null
  for (const [key, value] of Object.entries(properties)) {
    if (value === undefined) continue
    const rule = spec[key]
    if (!rule) return null
    if (typeof value === "string" && EMAIL_LIKE.test(value)) return null
    if (rule.kind === "boolean" && typeof value !== "boolean") return null
    if (rule.kind === "count" && !(typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 999)) return null
    if (rule.kind === "enum" && !(typeof value === "string" && rule.values.includes(value))) return null
  }
  return properties
}

export type AnalyticsDeps = {
  sdk: AnalyticsSdk
  storage: KeyValueStore
  /** Build identifier (git short SHA): a change between launches is an app update. */
  appVersion: string
  common: Omit<CommonProperties, "app_version">
  onRejected?: (name: string) => void
}

export function createAnalytics(deps: AnalyticsDeps) {
  const read = (key: string) => { try { return deps.storage.getItem(key) } catch { return null } }
  const write = (key: string, value: string) => { try { deps.storage.setItem(key, value) } catch { /* ignore */ } }
  // Optional analytics need an affirmative stored choice. A missing or unreadable preference is off.
  const isEnabled = () => read(ANALYTICS_PREF_KEY) === "on"
  const hasChoice = () => { const value = read(ANALYTICS_PREF_KEY); return value === "on" || value === "off" }
  let started = false

  function track<N extends EventName>(name: N, properties?: EventProperties<N>): void {
    try {
      if (!started || !isEnabled()) return
      const safe = guardProperties(name, { ...properties })
      if (!safe) { deps.onRejected?.(name); return }
      deps.sdk.capture(name, safe)
    } catch {
      // Analytics must never interrupt a product journey.
    }
  }

  // Initializes the SDK and records the launch. Only ever called once the user has opted in.
  function begin(): void {
    if (started) return
    try {
      deps.sdk.init({ common: { ...deps.common, app_version: deps.appVersion } })
      started = true
    } catch { return }
    const previous = read(INSTALLED_VERSION_KEY)
    write(INSTALLED_VERSION_KEY, deps.appVersion)
    if (previous === null) track("app_installed")
    else if (previous !== deps.appVersion) track("app_updated")
    track("app_opened")
  }

  return {
    isEnabled,
    /** False until the user has answered the first-launch choice (Share usage data / Not now). */
    hasChoice,
    /** Call once at launch. Does nothing, not even loading the SDK, without a stored opt-in. */
    start(): void {
      if (isEnabled()) begin()
    },
    /** First-launch choice and Settings toggle. OFF: nothing more is sent, not even a final event. */
    setEnabled(enabled: boolean): void {
      write(ANALYTICS_PREF_KEY, enabled ? "on" : "off")
      try {
        if (!enabled) {
          if (started) deps.sdk.optOut()
        } else if (isEnabled()) {
          // Only a choice that was actually stored starts collection.
          if (started) deps.sdk.optIn()
          else begin()
          track("settings_changed", { setting: "analytics", value: "on" })
        }
      } catch { /* ignore */ }
    },
    track,
  }
}

export function timeBand(minutes: number | null | undefined): TimeBand {
  if (minutes == null || minutes === 0) return "any"
  if (minutes <= 30) return "up_to_30"
  if (minutes <= 60) return "up_to_60"
  if (minutes <= 90) return "up_to_90"
  if (minutes <= 120) return "up_to_120"
  return "over_120"
}
