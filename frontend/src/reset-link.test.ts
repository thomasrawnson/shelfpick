import assert from "node:assert/strict"
import test from "node:test"
import { resetConfirmationBody, resetTokenFromSearch } from "./reset-link.ts"
import { request } from "./api/request.ts"

test("reset URL token survives parsing and confirmation serialization", () => {
  const token = "synthetic-_~token"
  const url = new URL(`https://example.test/reset-password?token=${encodeURIComponent(token)}`)
  const parsed = resetTokenFromSearch(url.search)
  assert.equal(parsed, token)
  assert.deepEqual(JSON.parse(resetConfirmationBody(parsed, "synthetic-password123")), {
    token, password: "synthetic-password123",
  })
  assert.equal(resetTokenFromSearch(""), "")
})

test("email-link token reaches confirmation request body unchanged", async () => {
  const token = "Synthetic_AbC-123"
  const emailUrl = new URL(`https://web.example.test/reset-password?token=${token}`)
  const originalFetch = globalThis.fetch
  let submitted = false
  globalThis.fetch = async (url, options) => {
    assert.equal(url, "https://api.example.test/auth/password-reset/confirm")
    assert.equal(options?.method, "POST")
    assert.equal(JSON.parse(String(options?.body)).token, token)
    submitted = true
    return Response.json({ message: "Password updated" })
  }
  try {
    const body = resetConfirmationBody(resetTokenFromSearch(emailUrl.search), "local-password123")
    const response = await request("https://api.example.test/auth/password-reset/confirm", {
      method: "POST", headers: { "Content-Type": "application/json" }, body,
    })
    assert.equal(response.status, 200)
    assert.equal(submitted, true)
  } finally {
    globalThis.fetch = originalFetch
  }
})
