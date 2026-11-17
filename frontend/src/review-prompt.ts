import { Capacitor } from "@capacitor/core"
import { InAppReview } from "@capacitor-community/in-app-review"

export const REVIEW_PROMPT_INTERVAL_MS = 90 * 24 * 60 * 60 * 1000
export const REVIEW_PROMPT_LAST_KEY = "shelfpick-review-prompt-last-requested"
export const SAVED_PLAYS_KEY = "shelfpick-review-prompt-saved-plays"
export const SAVED_PLAYS_THRESHOLD = 3

export type ReviewMoment = "recap_shared" | "vote_winner" | "saved_play"

type KeyValueStore = Pick<Storage, "getItem" | "setItem">

export type ReviewPromptDeps = {
  isNative: () => boolean
  request: () => Promise<void>
  now: () => number
  storage: KeyValueStore
}

// The throttle is stored locally only; nothing about it leaves the device.
// iOS decides whether to actually show the system prompt.
export function createReviewPrompt(deps: ReviewPromptDeps) {
  function readNumber(key: string): number {
    try {
      const value = Number(deps.storage.getItem(key))
      return Number.isFinite(value) && value > 0 ? value : 0
    } catch {
      return 0
    }
  }

  async function requestIfDue(): Promise<boolean> {
    if (!deps.isNative()) return false
    const now = deps.now()
    const last = readNumber(REVIEW_PROMPT_LAST_KEY)
    if (last && now - last < REVIEW_PROMPT_INTERVAL_MS) return false
    try {
      // Record first so a failure or repeat call can never re-prompt early.
      deps.storage.setItem(REVIEW_PROMPT_LAST_KEY, String(now))
      await deps.request()
      return true
    } catch {
      return false
    }
  }

  return {
    // Call after a clearly positive moment.
    async afterPositiveMoment(moment: ReviewMoment): Promise<boolean> {
      void moment
      return requestIfDue()
    },
    // Counts saved plays on this device; the third is a positive moment.
    async afterPlaySaved(): Promise<boolean> {
      const count = readNumber(SAVED_PLAYS_KEY) + 1
      try {
        deps.storage.setItem(SAVED_PLAYS_KEY, String(count))
      } catch {
        return false
      }
      return count >= SAVED_PLAYS_THRESHOLD ? requestIfDue() : false
    },
  }
}

function browserStorage(): KeyValueStore {
  return {
    getItem: key => { try { return localStorage.getItem(key) } catch { return null } },
    setItem: (key, value) => { try { localStorage.setItem(key, value) } catch { /* ignore */ } },
  }
}

const prompt = createReviewPrompt({
  isNative: () => Capacitor.isNativePlatform() && Capacitor.getPlatform() === "ios",
  request: () => InAppReview.requestReview(),
  now: () => Date.now(),
  storage: browserStorage(),
})

export const requestReviewAfter = prompt.afterPositiveMoment
export const requestReviewAfterPlaySaved = prompt.afterPlaySaved
