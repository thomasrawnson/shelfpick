import { Analytics } from "./posthog"

export { Analytics }
export { timeBand, type TimeBand } from "./core"

// App lifecycle: launch/update/install are emitted by Analytics.start(); backgrounding is the page hiding.
export function startAnalytics(): void {
  Analytics.start()
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") Analytics.track("app_backgrounded")
    else Analytics.track("app_opened")
  })
}
