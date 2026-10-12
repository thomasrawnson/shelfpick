import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const authSource = await readFile(new URL("./components/AuthView.tsx", import.meta.url), "utf8")
const discoverSource = await readFile(new URL("./components/DiscoverView.tsx", import.meta.url), "utf8")
const verifySource = await readFile(new URL("./components/VerifyEmailView.tsx", import.meta.url), "utf8")

test("registration explains invite-only activation without exposing eligibility", () => {
  assert.match(authSource, /Private beta registration is invite-only/)
  assert.match(authSource, /registrationMessage/)
  assert.match(authSource, /role="status"/)
})

test("Top 100 has a dedicated unavailable state and returns to Hot", () => {
  assert.match(discoverSource, /Top 100 is temporarily unavailable/)
  assert.match(discoverSource, /authorised official rankings source/)
  assert.match(discoverSource, /selectMode\("hot"\)/)
})

test("verification failure distinguishes invalid expired or reused links", () => {
  assert.match(verifySource, /invalid, expired or already used/)
  assert.match(verifySource, /role="alert"/)
})
