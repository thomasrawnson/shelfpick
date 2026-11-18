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

// A purchase layer that answers every purchase with the given result.
function mockLayer(result) {
  return {
    loadProducts: async (ids) => tipJar.TIP_PRODUCTS.filter((product) => ids.includes(product.id)),
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

test("tip product IDs and prices live in one config", () => {
  assert.deepEqual(tipJar.TIP_PRODUCTS.map((product) => [product.id, product.price]), [
    ["tip.coffee", "£1.99"], ["tip.pint", "£4.99"], ["tip.gamenight", "£9.99"],
  ])
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
    phase: { kind: "ready", message: failed.message }, products: tipJar.TIP_PRODUCTS, onBuy() {}, onRetry() {},
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
    { phase: { kind: "ready" }, products: tipJar.TIP_PRODUCTS, onBuy() {}, onRetry() {} }))
  assert.match(ready, /They don&#x27;t unlock anything, and ShelfPick Pro is separate/)
  for (const label of ["Tip Coffee, £1.99", "Tip Pint, £4.99", "Tip Game night, £9.99"]) {
    assert.match(ready, new RegExp(`aria-label="${label}"`))
  }
  const purchasing = renderToStaticMarkup(React.createElement(TipJarContent,
    { phase: { kind: "purchasing", id: "tip.pint" }, products: tipJar.TIP_PRODUCTS, onBuy() {}, onRetry() {} }))
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
