import assert from "node:assert/strict"
import { after, before, test } from "node:test"
import { createServer } from "vite"

let server
let mod

before(async () => {
  server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: "custom" })
  mod = await server.ssrLoadModule("/src/review-prompt.ts")
})
after(async () => { await server?.close() })

function setup({ native = true, start = 1_000_000 } = {}) {
  const data = new Map()
  const clock = { now: start }
  let requests = 0
  const prompt = mod.createReviewPrompt({
    isNative: () => native,
    request: async () => { requests += 1 },
    now: () => clock.now,
    storage: { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) },
  })
  return { prompt, clock, data, count: () => requests }
}

test("a positive moment prompts once, then is throttled for 90 days", async () => {
  const { prompt, clock, count } = setup()
  assert.equal(await prompt.afterPositiveMoment("recap_shared"), true)
  assert.equal(await prompt.afterPositiveMoment("vote_winner"), false)
  clock.now += mod.REVIEW_PROMPT_INTERVAL_MS - 1
  assert.equal(await prompt.afterPositiveMoment("vote_winner"), false)
  clock.now += 1
  assert.equal(await prompt.afterPositiveMoment("vote_winner"), true)
  assert.equal(count(), 2)
})

test("only the third saved play is a positive moment", async () => {
  const { prompt, count } = setup()
  assert.equal(await prompt.afterPlaySaved(), false)
  assert.equal(await prompt.afterPlaySaved(), false)
  assert.equal(count(), 0)
  assert.equal(await prompt.afterPlaySaved(), true)
  assert.equal(await prompt.afterPlaySaved(), false)
  assert.equal(count(), 1)
})

test("nothing is requested or stored for prompting on web", async () => {
  const { prompt, data, count } = setup({ native: false })
  assert.equal(await prompt.afterPositiveMoment("recap_shared"), false)
  assert.equal(count(), 0)
  assert.equal(data.has(mod.REVIEW_PROMPT_LAST_KEY), false)
})

test("a failing request is not retried early", async () => {
  const data = new Map()
  let attempts = 0
  const prompt = mod.createReviewPrompt({
    isNative: () => true,
    request: async () => { attempts += 1; throw new Error("unavailable") },
    now: () => 5_000_000,
    storage: { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) },
  })
  assert.equal(await prompt.afterPositiveMoment("recap_shared"), false)
  assert.equal(await prompt.afterPositiveMoment("recap_shared"), false)
  assert.equal(attempts, 1)
})
