import assert from "node:assert/strict"
import { test } from "node:test"

import { clearToken, getToken, restoreToken, saveToken } from "./auth.ts"
import { clearCredential, getCredential, isNativeIos, saveCredential } from "./native-secure-storage.ts"

test("web sessions and guest credentials retain the existing localStorage contract", async () => {
  assert.equal(isNativeIos, false)
  const values = new Map<string, string>()
  const previous = globalThis.localStorage
  globalThis.localStorage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value) },
    removeItem: (key) => { values.delete(key) },
  } as Storage

  try {
    await saveToken("test-token")
    assert.equal(getToken(), "test-token")
    assert.equal(await restoreToken(), "test-token")
    await saveCredential("guest-test", "guest-token")
    assert.equal(await getCredential("guest-test"), "guest-token")

    await clearToken()
    await clearCredential("guest-test")
    assert.equal(getToken(), null)
    assert.equal(await getCredential("guest-test"), null)
    assert.equal(values.size, 0)
  } finally {
    globalThis.localStorage = previous
  }
})
