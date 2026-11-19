import assert from "node:assert/strict"
import { after, before, beforeEach, test } from "node:test"
import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { createServer } from "vite"

let server
let feedback
let client
let FeedbackSheet
let appLinks

const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 26_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148"

function memoryStorage() {
  const items = new Map()
  return {
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => items.set(key, String(value)),
    removeItem: (key) => items.delete(key),
  }
}

before(async () => {
  server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: "custom" })
  feedback = await server.ssrLoadModule("/src/feedback.ts")
  client = await server.ssrLoadModule("/src/api/client.ts")
  appLinks = await server.ssrLoadModule("/src/app-links.ts")
  FeedbackSheet = (await server.ssrLoadModule("/src/components/FeedbackSheet.tsx")).default
})

beforeEach(() => { globalThis.localStorage = memoryStorage() })

after(async () => { delete globalThis.localStorage; await server?.close() })

test("messages must be 10 to 2000 characters after trimming", () => {
  assert.match(feedback.feedbackLengthError("too short"), /at least 10/)
  assert.match(feedback.feedbackLengthError("   padded   "), /at least 10/)
  assert.equal(feedback.feedbackLengthError("Ten chars!"), "")
  assert.equal(feedback.feedbackLengthError(` ${"x".repeat(2000)} `), "")
  assert.match(feedback.feedbackLengthError("x".repeat(2001)), /under 2000/)
})

test("app and device info is sent only when the toggle is on", () => {
  assert.deepEqual(feedback.buildFeedback("problem", "  It crashed on Stats.  ", false, false, IPHONE), {
    type: "problem", message: "It crashed on Stats.", wants_reply: false,
  })
  assert.deepEqual(feedback.buildFeedback("feature", "Add a lending tracker.", true, true, IPHONE), {
    type: "feature", message: "Add a lending tracker.", wants_reply: true,
    app_version: appLinks.APP_VERSION, build: appLinks.APP_BUILD, os: "iOS 26.1", device: "iPhone",
  })
  assert.deepEqual(feedback.deviceInfo("Mozilla/5.0 (X11; Linux x86_64)"), { device: "Web" })
})

test("offline messages are queued per account and sent in order once back online", async () => {
  const first = feedback.buildFeedback("feature", "First idea, kept offline.", false, false, IPHONE)
  const second = feedback.buildFeedback("other", "Second note, also offline.", false, false, IPHONE)
  feedback.queueFeedback(1, first)
  feedback.queueFeedback(2, second)
  feedback.queueFeedback(1, second)
  assert.equal(feedback.queuedFeedbackCount(1), 2)

  // Still offline: nothing is dropped.
  const offline = async () => { throw new feedback.FeedbackOfflineError() }
  assert.equal(await feedback.flushFeedbackOutbox(1, offline), 0)
  assert.equal(feedback.queuedFeedbackCount(1), 2)

  const sent = []
  assert.equal(await feedback.flushFeedbackOutbox(1, async (payload) => { sent.push(payload) }), 2)
  assert.deepEqual(sent, [first, second])
  assert.equal(feedback.queuedFeedbackCount(1), 0)
  assert.equal(feedback.queuedFeedbackCount(2), 1, "another account's message waits for that account")

  feedback.clearQueuedFeedback(2)
  assert.equal(localStorage.getItem("shelfpick-feedback-outbox"), null)
})

test("a failed send stops the flush and keeps the rest", async () => {
  for (const text of ["Message number one.", "Message number two.", "Message number three."]) {
    feedback.queueFeedback(1, feedback.buildFeedback("other", text, false, false, IPHONE))
  }
  let calls = 0
  const sent = await feedback.flushFeedbackOutbox(1, async () => { if (++calls === 2) throw new Error("429") })
  assert.equal(sent, 1)
  assert.equal(feedback.queuedFeedbackCount(1), 2)
})

test("sendFeedback reports a lost connection as offline and server errors as messages", async () => {
  const realFetch = globalThis.fetch
  try {
    globalThis.fetch = async () => { throw new TypeError("Load failed") }
    await assert.rejects(client.sendFeedback({ type: "other", message: "Hello there!", wants_reply: false }), feedback.FeedbackOfflineError)

    globalThis.fetch = async () => new Response(JSON.stringify({ detail: "You've sent 5 messages today. Try again tomorrow, or email hello@plutonightlabs.com." }), { status: 429 })
    await assert.rejects(client.sendFeedback({ type: "other", message: "Hello there!", wants_reply: false }), /5 messages today/)

    let body
    globalThis.fetch = async (_url, init) => { body = JSON.parse(init.body); return new Response(JSON.stringify({ id: 1 }), { status: 201 }) }
    await client.sendFeedback({ type: "feature", message: "Hello there!", wants_reply: true })
    assert.deepEqual(body, { type: "feature", message: "Hello there!", wants_reply: true })
  } finally {
    globalThis.fetch = realFetch
  }
})

test("the feedback sheet names every control", () => {
  globalThis.document = undefined
  const markup = renderToStaticMarkup(React.createElement(FeedbackSheet, { userId: 1, initialType: "problem", onClose() {} }))
  assert.match(markup, /role="dialog" aria-modal="true"/)
  assert.match(markup, /role="group" aria-label="Feedback type"/)
  assert.deepEqual([...markup.matchAll(/aria-pressed="(true|false)">([^<]+)</g)].map((match) => [match[2], match[1]]),
    [["Feature idea", "false"], ["Problem", "true"], ["Other", "false"]])
  assert.match(markup, /<label for="([^"]+)">Message<\/label><textarea id="\1"/)
  assert.match(markup, /0 \/ 2000/)
  assert.match(markup, /<span>Email me back<\/span><input type="checkbox" role="switch"/)
  assert.match(markup, /<span>Include app and device info<\/span><input type="checkbox" role="switch" checked=""/)
  assert.match(markup, /type="submit"[^>]*>Send</)
  assert.match(markup, />Cancel</)
  delete globalThis.document
})
