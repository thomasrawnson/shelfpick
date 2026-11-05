import assert from "node:assert/strict"
import { test } from "node:test"

// Install a synthetic Capacitor bridge before importing the native adapter.
// This exercises the plugin's iOS path without a device or live credentials.
const keychain = new Map<string, string>()
const webStorage = new Map<string, string>()
const calls: { method: string; options: Record<string, unknown> }[] = []

Object.assign(globalThis, {
  webkit: { messageHandlers: { bridge: {} } },
  Capacitor: {
    PluginHeaders: [{
      name: "SecureStorage",
      methods: ["internalGetItem", "internalSetItem", "internalRemoveItem", "internalGetPrefixedKeys"].map((name) => ({ name, rtype: "promise" })),
    }],
    nativePromise: async (_plugin: string, method: string, options: Record<string, unknown>) => {
      calls.push({ method, options })
      const key = options.prefixedKey as string
      if (method === "internalGetItem") return { data: keychain.get(key) ?? null }
      if (method === "internalSetItem") {
        keychain.set(key, options.data as string)
        return {}
      }
      if (method === "internalRemoveItem") {
        keychain.delete(key)
        return { success: true }
      }
      if (method === "internalGetPrefixedKeys") {
        return { keys: [...keychain.keys()].filter((item) => item.startsWith(options.prefix as string)) }
      }
      throw new Error(`Unexpected native operation: ${method}`)
    },
  },
  localStorage: {
    getItem: (key: string) => webStorage.get(key) ?? null,
    setItem: (key: string, value: string) => { webStorage.set(key, value) },
    removeItem: (key: string) => { webStorage.delete(key) },
  },
})

const { clearCredential, getCredential, isNativeIos, saveCredential } = await import("./native-secure-storage.ts")
const { clearToken, getToken, restoreToken, saveToken } = await import("./auth.ts")
const { deleteAccountAndClearSession } = await import("./account-deletion-session.ts")

test("fresh native install removes only stale ShelfPick credentials", async () => {
  keychain.set("capacitor-storage_boardgamepicker_access_token", '"stale-account"')
  keychain.set("capacitor-storage_shelfpick-game-night-guest:old-join", '"stale-guest"')
  keychain.set("capacitor-storage_unrelated-fixture", '"keep"')

  assert.equal(await restoreToken(), null)
  assert.equal(keychain.has("capacitor-storage_boardgamepicker_access_token"), false)
  assert.equal(keychain.has("capacitor-storage_shelfpick-game-night-guest:old-join"), false)
  assert.equal(keychain.get("capacitor-storage_unrelated-fixture"), '"keep"')
  assert.equal(webStorage.get("shelfpick-native-install-v1"), "1")
  keychain.delete("capacitor-storage_unrelated-fixture")
})

test("native account session restores from Keychain, then clears on logout or expiry", async () => {
  assert.equal(isNativeIos, true)
  webStorage.set("boardgamepicker_access_token", "obsolete-web-fixture")
  await saveToken("synthetic-account-token")
  assert.equal(webStorage.get("boardgamepicker_access_token"), undefined)
  assert.equal(getToken(), "synthetic-account-token")
  assert.equal(keychain.get("capacitor-storage_boardgamepicker_access_token"), '"synthetic-account-token"')
  assert.equal(await restoreToken(), "synthetic-account-token")
  const updatedAuthPath = "./auth.ts?updated-app"
  const updatedApp = await import(updatedAuthPath) as typeof import("./auth.ts")
  assert.equal(updatedApp.getToken(), null)
  assert.equal(await updatedApp.restoreToken(), "synthetic-account-token")

  await clearToken() // ordinary logout and the API 401 path use this same operation
  assert.equal(getToken(), null)
  assert.equal(await restoreToken(), null)
  assert.equal(keychain.size, 0)

  await saveToken("synthetic-expired-token")
  await clearToken()
  assert.equal(await restoreToken(), null)
  assert.equal(keychain.size, 0)

  const setCall = calls.find((call) => call.method === "internalSetItem")
  assert.equal(setCall?.options.sync, false)
  assert.equal(setCall?.options.access, 1) // whenUnlockedThisDeviceOnly
})

test("synthetic Game Night guest credential restores and can be removed", async () => {
  const guestKey = "shelfpick-game-night-guest:fixture"
  await saveCredential(guestKey, "synthetic-guest-token")
  assert.equal(await getCredential(guestKey), "synthetic-guest-token")
  assert.equal(webStorage.get(guestKey), undefined)
  await clearCredential(guestKey)
  assert.equal(await getCredential(guestKey), null)
})

test("account deletion clears native session only after a successful response", async () => {
  await saveToken("synthetic-account-token")
  let completed = false
  await assert.rejects(
    deleteAccountAndClearSession("fixture-only", async () => { throw new Error("rejected") }, () => { completed = true }),
    /rejected/,
  )
  assert.equal(getToken(), "synthetic-account-token")
  assert.equal(completed, false)

  await deleteAccountAndClearSession("fixture-only", async () => "deleted", () => { completed = true })
  assert.equal(completed, true)
  assert.equal(getToken(), null)
  assert.equal(await restoreToken(), null)
})
