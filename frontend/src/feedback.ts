import { APP_BUILD, APP_VERSION } from "./app-links"

export type FeedbackType = "feature" | "problem" | "other"
export const FEEDBACK_MIN = 10
export const FEEDBACK_MAX = 2000

export type FeedbackPayload = {
  type: FeedbackType
  message: string
  wants_reply: boolean
  app_version?: string
  build?: string
  os?: string
  device?: string
}

export function feedbackLengthError(message: string): string {
  const length = message.trim().length
  if (length < FEEDBACK_MIN) return `Write at least ${FEEDBACK_MIN} characters.`
  if (length > FEEDBACK_MAX) return `Keep it under ${FEEDBACK_MAX} characters.`
  return ""
}

export function deviceInfo(userAgent: string): { os?: string; device?: string } {
  const ios = /(iPhone|iPad|iPod).*? OS (\d+)[._](\d+)/.exec(userAgent)
  if (ios) return { os: `iOS ${ios[2]}.${ios[3]}`, device: ios[1] }
  const mac = /Mac OS X (\d+)[._](\d+)/.exec(userAgent)
  if (mac) return { os: `macOS ${mac[1]}.${mac[2]}`, device: "Mac" }
  const android = /Android (\d+(?:\.\d+)?)/.exec(userAgent)
  if (android) return { os: `Android ${android[1]}`, device: "Android" }
  return { device: "Web" }
}

export function buildFeedback(
  type: FeedbackType,
  message: string,
  wantsReply: boolean,
  includeInfo: boolean,
  userAgent: string,
): FeedbackPayload {
  const payload: FeedbackPayload = { type, message: message.trim(), wants_reply: wantsReply }
  if (!includeInfo) return payload
  return { ...payload, app_version: APP_VERSION, build: APP_BUILD, ...deviceInfo(userAgent) }
}

// Messages that could not be sent wait here, per account, until the next try.
const OUTBOX_KEY = "shelfpick-feedback-outbox"
type Queued = { userId: number; payload: FeedbackPayload }

function readOutbox(): Queued[] {
  try {
    const items = JSON.parse(localStorage.getItem(OUTBOX_KEY) ?? "[]")
    return Array.isArray(items) ? items : []
  } catch {
    return []
  }
}

function writeOutbox(items: Queued[]) {
  if (items.length) localStorage.setItem(OUTBOX_KEY, JSON.stringify(items))
  else localStorage.removeItem(OUTBOX_KEY)
}

export function queueFeedback(userId: number, payload: FeedbackPayload) {
  writeOutbox([...readOutbox(), { userId, payload }])
}

export function queuedFeedbackCount(userId: number): number {
  return readOutbox().filter((item) => item.userId === userId).length
}

export function clearQueuedFeedback(userId: number) {
  writeOutbox(readOutbox().filter((item) => item.userId !== userId))
}

// Sends this account's queued messages in order and stops at the first
// failure, so nothing is dropped. One flush runs at a time. Returns how many
// were sent.
let flushing: Promise<number> | null = null

export function flushFeedbackOutbox(
  userId: number,
  send: (payload: FeedbackPayload) => Promise<unknown>,
): Promise<number> {
  flushing ??= (async () => {
    let sent = 0
    for (const item of readOutbox().filter((queued) => queued.userId === userId)) {
      try {
        await send(item.payload)
      } catch {
        break
      }
      const rest = readOutbox()
      const key = JSON.stringify(item)
      const index = rest.findIndex((queued) => JSON.stringify(queued) === key)
      if (index >= 0) rest.splice(index, 1)
      writeOutbox(rest)
      sent += 1
    }
    return sent
  })().finally(() => { flushing = null })
  return flushing
}

// The message never reached the server (no connection), so it is safe to retry.
export class FeedbackOfflineError extends Error {
  constructor() { super("You're offline.") }
}
