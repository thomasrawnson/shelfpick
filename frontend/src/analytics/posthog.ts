import { Capacitor } from "@capacitor/core"
import type { PostHog } from "posthog-js"

import { createAnalytics, type AnalyticsSdk, type CommonProperties, type KeyValueStore, EVENT_SPECS } from "./core"

// Public client key (safe to ship). If empty, analytics stays off.
export const POSTHOG_PROJECT_KEY = "phc_CqaVeMi2k48rkJfmp7s58HN9j3A3ScxhHRKAccQtjCic"
export const POSTHOG_HOST = "https://eu.i.posthog.com"

declare const __SHELFPICK_BUILD_ID__: string

// Release builds set VITE_ANALYTICS_ENV=production. Anything else is tagged dev, so a forgotten
// variable can never pollute production numbers.
const environment: CommonProperties["environment"] =
  import.meta.env.PROD && import.meta.env.VITE_ANALYTICS_ENV === "production" ? "production" : "dev"

const platform = Capacitor.getPlatform() as CommonProperties["platform"]

let commonProperties: CommonProperties | null = null
// The SDK is loaded as its own chunk so it never delays first paint; calls queue behind it in order.
let client: Promise<PostHog | null> | null = null
const withClient = (run: (posthog: PostHog) => void) => {
  void client?.then(posthog => { if (posthog) run(posthog) })
}

const sdk: AnalyticsSdk = {
  init({ startOptedOut, common }) {
    commonProperties = common
    if (!POSTHOG_PROJECT_KEY) throw new Error("analytics key not configured")
    client = import("posthog-js").then(({ default: posthog }) => {
      posthog.init(POSTHOG_PROJECT_KEY, {
        api_host: POSTHOG_HOST,
        // Anonymous, event-only: no person profiles, replay, autocapture, flags, surveys or error capture.
        person_profiles: "never",
        autocapture: false,
        rageclick: false,
        capture_pageview: false,
        capture_pageleave: false,
        capture_dead_clicks: false,
        capture_heatmaps: false,
        capture_exceptions: false,
        capture_performance: false,
        disable_session_recording: true,
        disable_surveys: true,
        disable_web_experiments: true,
        disable_external_dependency_loading: true,
        advanced_disable_flags: true,
        persistence: "localStorage",
        opt_out_capturing_by_default: startOptedOut,
        // Only events in the tracking plan leave the device, with URL-bearing properties removed
        // (reset-password links carry tokens).
        before_send: (event) => {
          if (!event || !(event.event in EVENT_SPECS)) return null
          const properties = { ...event.properties }
          for (const key of Object.keys(properties)) {
            if (/url|path|referr|host|title/i.test(key)) delete properties[key]
          }
          event.properties = properties
          delete event.$set
          delete event.$set_once
          return event
        },
      })
      return posthog
    }).catch(() => null)
  },
  capture: (name, properties) => withClient(posthog => posthog.capture(name, { ...properties, ...commonProperties })),
  optIn: () => withClient(posthog => posthog.opt_in_capturing()),
  optOut: () => withClient(posthog => posthog.opt_out_capturing()),
}

const storage: KeyValueStore = {
  getItem: key => localStorage.getItem(key),
  setItem: (key, value) => localStorage.setItem(key, value),
}

export const Analytics = createAnalytics({
  sdk,
  storage,
  appVersion: __SHELFPICK_BUILD_ID__,
  common: { environment, platform },
  onRejected: name => { if (import.meta.env.DEV) console.warn(`Analytics event "${name}" rejected by the guard`) },
})
