import assert from "node:assert/strict"
import { after, before, beforeEach, test } from "node:test"
import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { MemoryRouter } from "react-router-dom"
import { createServer } from "vite"

let server
let tipJar
let TipJarContent
let SettingsView

const user = {
  id: 1, email: "morgan@example.com", display_name: "Morgan", bgg_username: null,
  email_verified: true, onboarding_completed: true, preferred_player_count: 4,
  preferred_play_time: 60, preferred_play_style: null, profile_player_id: 1,
  player_name: "Morgan Player", avatar_key: "forest", tier: "FREE", entitlements: [],
}

function memoryStorage() {
  const items = new Map()
  return {
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => items.set(key, String(value)),
    removeItem: (key) => items.delete(key),
  }
}

const GBP = { "tip.coffee": "£1.99", "tip.pint": "£4.99", "tip.gamenight": "£9.99" }
const withPrices = (prices) => tipJar.TIP_PRODUCTS.map((product) => ({ ...product, price: prices[product.id] }))

// A purchase layer that answers every purchase with the given result.
function mockLayer(result) {
  return {
    loadProducts: async (ids) => withPrices(GBP).filter((product) => ids.includes(product.id)),
    purchase: async () => {
      if (result instanceof Error) throw result
      return result
    },
  }
}

before(async () => {
  globalThis.window = { shelfPickTheme: { getPreference: () => "dark", setPreference: () => {} } }
  server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: "custom" })
  tipJar = await server.ssrLoadModule("/src/tip-jar.ts")
  TipJarContent = (await server.ssrLoadModule("/src/components/TipJarSheet.tsx")).TipJarContent
  SettingsView = (await server.ssrLoadModule("/src/components/SettingsView.tsx")).default
})

beforeEach(() => { globalThis.localStorage = memoryStorage() })

after(async () => { delete globalThis.window; delete globalThis.localStorage; await server?.close() })

function settings(purchases) {
  return renderToStaticMarkup(React.createElement(MemoryRouter, { initialEntries: ["/settings"] },
    React.createElement(SettingsView, { user, purchases })))
}

test("tip product IDs live in one config, with no prices in it", () => {
  assert.deepEqual(tipJar.TIP_PRODUCTS.map((product) => [product.id, product.name]), [
    ["tip.coffee", "Coffee"], ["tip.pint", "Pint"], ["tip.gamenight", "Game night"],
  ])
  assert.deepEqual([...tipJar.TIP_PRODUCT_IDS], tipJar.TIP_PRODUCTS.map((product) => product.id))
  assert.ok(tipJar.TIP_PRODUCTS.every((product) => !("price" in product)))
})

test("a completed tip increments the count and shows the Supporter badge", async () => {
  assert.doesNotMatch(settings(mockLayer({ status: "purchased" })), /Supporter/)
  assert.deepEqual(await tipJar.purchaseTip(mockLayer({ status: "purchased" }), "tip.coffee"), { kind: "thanks", count: 1 })
  assert.deepEqual(await tipJar.purchaseTip(mockLayer({ status: "purchased" }), "tip.pint"), { kind: "thanks", count: 2 })
  assert.equal(tipJar.tipCount(), 2)

  const markup = settings(mockLayer({ status: "purchased" }))
  assert.match(markup, /<span class="settings-supporter">Supporter<\/span>/)
  assert.match(markup, /aria-label="Account, plan and log out: Morgan Player, Supporter"/)
  assert.match(markup, />Tip jar<\/span><span class="settings-row-value">2 tips</)

  const thanks = renderToStaticMarkup(React.createElement(TipJarContent,
    { phase: { kind: "thanks", count: 2 }, products: [], onBuy() {}, onRetry() {} }))
  assert.match(thanks, /Thank you!/)
  assert.match(thanks, /That&#x27;s 2 tips from you/)
  assert.match(thanks, /Supporter/)
})

test("cancelled and failed tips leave the count unchanged", async () => {
  localStorage.setItem("shelfpick-tip-count", "1")
  assert.deepEqual(await tipJar.purchaseTip(mockLayer({ status: "cancelled" }), "tip.coffee"), { kind: "cancelled" })
  assert.equal(tipJar.tipCount(), 1)
  const failed = await tipJar.purchaseTip(mockLayer({ status: "failed" }), "tip.coffee")
  assert.equal(failed.kind, "failed")
  assert.match(failed.message, /haven't been charged/)
  const thrown = await tipJar.purchaseTip(mockLayer(new Error("StoreKit unavailable")), "tip.coffee")
  assert.equal(thrown.kind, "failed")
  assert.equal(tipJar.tipCount(), 1)

  const markup = renderToStaticMarkup(React.createElement(TipJarContent, {
    phase: { kind: "ready", message: failed.message }, products: withPrices(GBP), onBuy() {}, onRetry() {},
  }))
  assert.match(markup, /role="alert">The purchase didn&#x27;t go through/)
})

test("a pending tip shows a pending message and does not count yet", async () => {
  assert.deepEqual(await tipJar.purchaseTip(mockLayer({ status: "pending" }), "tip.gamenight"), { kind: "pending" })
  assert.equal(tipJar.tipCount(), 0)
  const markup = renderToStaticMarkup(React.createElement(TipJarContent,
    { phase: { kind: "pending" }, products: [], onBuy() {}, onRetry() {} }))
  assert.match(markup, /role="status"><strong>Waiting for approval/)
  assert.match(markup, /won&#x27;t be charged until then/)
})

test("the tip sheet says tips unlock nothing and names each option with its price", () => {
  const ready = renderToStaticMarkup(React.createElement(TipJarContent,
    { phase: { kind: "ready" }, products: withPrices(GBP), onBuy() {}, onRetry() {} }))
  assert.match(ready, /They don&#x27;t unlock anything, and ShelfPick Pro is separate/)
  for (const label of ["Tip Coffee, £1.99", "Tip Pint, £4.99", "Tip Game night, £9.99"]) {
    assert.match(ready, new RegExp(`aria-label="${label}"`))
  }
  const purchasing = renderToStaticMarkup(React.createElement(TipJarContent,
    { phase: { kind: "purchasing", id: "tip.pint" }, products: withPrices(GBP), onBuy() {}, onRetry() {} }))
  assert.equal((purchasing.match(/disabled=""/g) ?? []).length, 3)
  assert.match(purchasing, /Purchasing…/)
  const loading = renderToStaticMarkup(React.createElement(TipJarContent,
    { phase: { kind: "loading" }, products: [], onBuy() {}, onRetry() {} }))
  assert.match(loading, /Loading tips…/)
  const loadFailed = renderToStaticMarkup(React.createElement(TipJarContent,
    { phase: { kind: "load-failed" }, products: [], onBuy() {}, onRetry() {} }))
  assert.match(loadFailed, /role="alert" class="tip-jar-error"><p>Couldn&#x27;t load tips[^]*Try again/)
})

test("the Tip jar row is hidden when there is no purchase layer", () => {
  assert.doesNotMatch(settings(null), /Tip jar/)
  assert.match(settings(null), /Leave a review/)
})

// --- The RevenueCat layer, against a mocked store ---------------------------------

const COFFEE = "tip.coffee"
const PINT = "tip.pint"
const GAMENIGHT = "tip.gamenight"

function fakeStore({ prices = { [COFFEE]: "$2.49", [PINT]: "4,99 €", [GAMENIGHT]: "¥1,500" }, outcome = "purchased" } = {}) {
  const calls = []
  return {
    calls,
    loadTipProducts: async (ids, appUserId) => {
      calls.push(["load", appUserId])
      return ids.filter((id) => prices[id]).map((id) => ({ id, priceString: prices[id], handle: { id } }))
    },
    purchaseTip: async (tip, appUserId) => {
      calls.push(["buy", tip.id, appUserId])
      if (outcome instanceof Error) throw outcome
      return outcome
    },
  }
}

function realLayer(store, { isCurrent = () => true, getAppUserId = async () => "acct-1" } = {}) {
  return tipJar.createTipLayer({ store, getAppUserId, isCurrent })
}

test("the sheet shows the store's own price strings, not stored ones", async () => {
  const layer = realLayer(fakeStore())
  const products = await layer.loadProducts(tipJar.TIP_PRODUCT_IDS)
  assert.deepEqual(products.map((product) => [product.name, product.price]), [
    ["Coffee", "$2.49"], ["Pint", "4,99 €"], ["Game night", "¥1,500"],
  ])
  const markup = renderToStaticMarkup(React.createElement(TipJarContent, { phase: { kind: "ready" }, products, onBuy() {}, onRetry() {} }))
  for (const label of ["Tip Coffee, $2.49", "Tip Pint, 4,99 €", "Tip Game night, ¥1,500"]) assert.ok(markup.includes(`aria-label="${label}"`), label)
  assert.doesNotMatch(markup, /£/)
})

test("a purchase through the layer counts, shows thanks and the badge", async () => {
  const store = fakeStore()
  const layer = realLayer(store)
  await layer.loadProducts(tipJar.TIP_PRODUCT_IDS)
  assert.deepEqual(await tipJar.purchaseTip(layer, PINT), { kind: "thanks", count: 1 })
  assert.deepEqual(store.calls.at(-1), ["buy", PINT, "acct-1"])
  assert.equal(tipJar.tipCount(), 1)
  assert.match(settings(layer), /<span class="settings-supporter">Supporter<\/span>/)
})

test("cancelled, pending and failed store outcomes map to the existing states", async () => {
  for (const [outcome, expected, counted] of [
    ["cancelled", { kind: "cancelled" }, 0],
    ["pending", { kind: "pending" }, 0],
  ]) {
    const layer = realLayer(fakeStore({ outcome }))
    await layer.loadProducts(tipJar.TIP_PRODUCT_IDS)
    assert.deepEqual(await tipJar.purchaseTip(layer, COFFEE), expected)
    assert.equal(tipJar.tipCount(), counted)
  }
  const failing = realLayer(fakeStore({ outcome: new Error("StoreKit unavailable") }))
  await failing.loadProducts(tipJar.TIP_PRODUCT_IDS)
  const failed = await tipJar.purchaseTip(failing, COFFEE)
  assert.equal(failed.kind, "failed")
  assert.equal(tipJar.tipCount(), 0)
})

test("nothing is buyable without a loaded product", async () => {
  const store = fakeStore({ prices: {} })
  const layer = realLayer(store)
  assert.deepEqual(await layer.loadProducts(tipJar.TIP_PRODUCT_IDS), [])
  // Not loaded at all, and loaded but missing from the store: both refuse before the store is asked to buy.
  assert.equal((await tipJar.purchaseTip(realLayer(fakeStore()), COFFEE)).kind, "failed")
  assert.equal((await tipJar.purchaseTip(layer, COFFEE)).kind, "failed")
  assert.ok(store.calls.every(([kind]) => kind !== "buy"))
  assert.equal(tipJar.tipCount(), 0)

  const partial = realLayer(fakeStore({ prices: { [PINT]: "£4.99" } }))
  assert.deepEqual((await partial.loadProducts(tipJar.TIP_PRODUCT_IDS)).map((product) => product.id), [PINT])
  assert.equal((await tipJar.purchaseTip(partial, COFFEE)).kind, "failed")
})

test("a failed product load can be retried and the sheet shows its error with Retry", async () => {
  let attempts = 0
  const store = fakeStore()
  const flaky = { ...store, loadTipProducts: async (ids, id) => { attempts += 1; if (attempts === 1) throw new Error("App Store unreachable"); return store.loadTipProducts(ids, id) } }
  const layer = realLayer(flaky)
  await assert.rejects(layer.loadProducts(tipJar.TIP_PRODUCT_IDS), /unreachable/)
  assert.equal((await layer.loadProducts(tipJar.TIP_PRODUCT_IDS)).length, 3)
  // A failed account lookup is retried too, not remembered.
  let lookups = 0
  const lookup = realLayer(fakeStore(), { getAppUserId: async () => { lookups += 1; if (lookups === 1) throw new Error("offline"); return "acct-1" } })
  await assert.rejects(lookup.loadProducts(tipJar.TIP_PRODUCT_IDS), /offline/)
  assert.equal((await lookup.loadProducts(tipJar.TIP_PRODUCT_IDS)).length, 3)
})

test("a tip is only bought for the account that is signed in", async () => {
  let current = true
  let release
  const store = fakeStore()
  const layer = realLayer(store, { isCurrent: () => current, getAppUserId: () => new Promise((resolve) => { release = () => resolve("acct-1") }) })
  const loading = layer.loadProducts(tipJar.TIP_PRODUCT_IDS)
  current = false // the account switched while the lookup and SDK preparation were pending
  release()
  await assert.rejects(loading, /account changed/)
  assert.deepEqual(store.calls, [])

  const switched = realLayer(store, { isCurrent: () => current })
  current = true
  await switched.loadProducts(tipJar.TIP_PRODUCT_IDS)
  current = false
  assert.equal((await tipJar.purchaseTip(switched, COFFEE)).kind, "failed")
  assert.ok(store.calls.every(([kind]) => kind !== "buy"))
  assert.equal(tipJar.tipCount(), 0)
})

test("the layer exists only when purchases are on and there is a store", () => {
  const deps = { getAppUserId: async () => "a", isCurrent: () => true }
  assert.equal(tipJar.tipLayerFor({ purchasesEnabled: false, store: fakeStore(), ...deps }), null)
  assert.equal(tipJar.tipLayerFor({ purchasesEnabled: true, store: null, ...deps }), null)
  assert.equal(tipJar.tipLayerFor({ purchasesEnabled: false, store: null, ...deps }), null)
  const layer = tipJar.tipLayerFor({ purchasesEnabled: true, store: fakeStore(), ...deps })
  assert.equal(typeof layer.loadProducts, "function")
  assert.match(settings(layer), /Tip jar/)
  assert.doesNotMatch(settings(null), /Tip jar/)
})
