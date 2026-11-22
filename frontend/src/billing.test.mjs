import assert from "node:assert/strict"
import { after, before, test } from "node:test"
import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { createServer } from "vite"

let server
let plans
let flow
let storeModule
let PaywallPanel
let paywallLoad

before(async () => {
  server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: "custom" })
  plans = await server.ssrLoadModule("/src/billing/plans.ts")
  flow = await server.ssrLoadModule("/src/billing/purchase-flow.ts")
  storeModule = await server.ssrLoadModule("/src/billing/store.ts")
  paywallLoad = await server.ssrLoadModule("/src/billing/paywall-load.ts")
  PaywallPanel = (await server.ssrLoadModule("/src/components/pro/PaywallPanel.tsx")).default
})

after(async () => { await server?.close() })

const yearly = { id: "yearly", price: "£3.99", handle: { sdk: "annual" } }
const lifetime = { id: "lifetime", price: "£9.99", handle: { sdk: "lifetime" } }
const free = { pro: false, source: null, plan: null, expiresAt: null }

function paywall(overrides = {}) {
  return renderToStaticMarkup(React.createElement(PaywallPanel, {
    status: free, offers: [lifetime, yearly], storeAvailable: true, restoreReady: true, purchasesEnabled: true, buildMarker: "shelfpick-purchases-on", busy: null, message: null,
    managementUrl: null, onBuy: () => {}, onRestore: () => {}, onReload: () => {}, ...overrides,
  }))
}

// --- Paywall: what App Review requires beside a price ------------------------

test("paywall shows both plans with store prices, periods and auto-renew terms", () => {
  const markup = paywall()
  assert.match(markup, /Pro Yearly/)
  assert.match(markup, /£3\.99<\/strong> <span>per year, renews automatically/)
  assert.match(markup, /Pro Lifetime/)
  assert.match(markup, /£9\.99<\/strong> <span>one-time purchase/)
  assert.match(markup, /auto-renewing subscription/)
  assert.match(markup, /unless you cancel at least 24 hours before the end of the current period/)
  assert.match(markup, /charged to your Apple Account/)
  assert.match(markup, /Settings &gt; Apple Account &gt; Subscriptions/)
  assert.match(markup, /Pro Lifetime is a one-time purchase and does not renew/)
})

test("paywall links Privacy and Terms and offers Restore purchases", () => {
  const markup = paywall()
  assert.match(markup, /<a href="https:\/\/plutonightlabs\.com\/shelfpick\/privacy\/"[^>]*>Privacy Policy<\/a>/)
  assert.match(markup, /<a href="https:\/\/plutonightlabs\.com\/shelfpick\/terms\/"[^>]*>Terms of Use<\/a>/)
  assert.match(markup, /<button[^>]*>Restore purchases<\/button>/)
})

test("buy buttons show the price and are described by their plan, with no hidden label", () => {
  const markup = paywall()
  assert.match(markup, /<button[^>]*aria-describedby="paywall-plan-yearly"[^>]*>Subscribe, £3\.99 a year<\/button>/)
  assert.match(markup, /<button[^>]*aria-describedby="paywall-plan-lifetime"[^>]*>Buy for £9\.99<\/button>/)
  // The spoken name must contain the visible text (WCAG 2.5.3), so no aria-label overrides it.
  assert.doesNotMatch(markup, /<button[^>]*aria-label=/)
})

test("paywall has no dark patterns: no countdown, scarcity, discount claims or pre-selection", () => {
  const markup = paywall()
  assert.doesNotMatch(markup, /limited time|only today|hurry|countdown|% off|save \d|best value|most popular|free trial/i)
  assert.doesNotMatch(markup, /checked|aria-pressed="true"|aria-selected="true"/)
  // Both plans are the same kind of card, listed with the subscription first.
  assert.ok(markup.indexOf("Pro Yearly") < markup.indexOf("Pro Lifetime"))
})

test("paywall states what happens to Pro-made data when Pro ends", () => {
  assert.match(paywall(), /nothing you made with it is deleted/)
})

test("busy state disables every purchase control", () => {
  const markup = paywall({ busy: "yearly" })
  assert.equal((markup.match(/disabled=""/g) ?? []).length, 3)
  assert.match(markup, />Working…</)
})

test("Restore stays disabled until the store is signed in as this account, and plans are not needed", () => {
  const waiting = paywall({ restoreReady: false, offers: null })
  assert.match(waiting, /<button[^>]*disabled=""[^>]*>Restore purchases<\/button>/)
  // Bound to this account but the plans failed to load: Restore works.
  const plansFailed = paywall({ restoreReady: true, offers: [] })
  assert.doesNotMatch(plansFailed, /<button[^>]*disabled=""[^>]*>Restore purchases<\/button>/)
  // The store could not be signed in: Restore stays off and there is a way to try again.
  const notBound = paywall({ restoreReady: false, offers: [], purchasesEnabled: false })
  assert.match(notBound, /<button[^>]*disabled=""[^>]*>Restore purchases<\/button>/)
  assert.match(notBound, /<button[^>]*>Reconnect to the App Store<\/button>/)
})

test("paywall explains the PWA and unconfigured builds instead of offering a purchase", () => {
  const markup = paywall({ storeAvailable: false, offers: [] })
  assert.match(markup, /Pro is bought in the ShelfPick iPhone app/)
  assert.doesNotMatch(markup, /Subscribe|Buy for|Restore purchases/)
  assert.match(markup, /Privacy Policy/)
})

test("purchases stay closed when the build does not sell Pro, but the legal links stay", () => {
  const markup = paywall({ purchasesEnabled: false, buildMarker: "shelfpick-purchases-off" })
  assert.match(markup, /Pro purchases aren’t open yet/)
  assert.doesNotMatch(markup, /Subscribe, |Buy for/)
  assert.match(markup, /<a href="https:\/\/plutonightlabs\.com\/shelfpick\/privacy\/"[^>]*>Privacy Policy<\/a>/)
  assert.match(markup, /<a href="https:\/\/plutonightlabs\.com\/shelfpick\/terms\/"[^>]*>Terms of Use<\/a>/)
  assert.match(markup, /data-purchases-build="shelfpick-purchases-off"/)
  // Someone who already has Pro still sees their plan.
  const pro = paywall({ purchasesEnabled: false, status: { pro: true, source: "purchase", plan: "LIFETIME", expiresAt: null } })
  assert.match(pro, /Pro Lifetime is active/)
})

test("the legal links render beside the price with purchases on", () => {
  const markup = paywall()
  assert.match(markup, /Subscribe, £3\.99 a year/)
  assert.match(markup, /<a href="https:\/\/plutonightlabs\.com\/shelfpick\/privacy\/"[^>]*>Privacy Policy<\/a>/)
  assert.match(markup, /<a href="https:\/\/plutonightlabs\.com\/shelfpick\/terms\/"[^>]*>Terms of Use<\/a>/)
  assert.match(markup, /data-purchases-build="shelfpick-purchases-on"/)
})

test("paywall shows loading and empty plan states", () => {
  assert.match(paywall({ offers: null }), /Loading plans from the App Store/)
  const empty = paywall({ offers: [] })
  assert.match(empty, /Pro isn’t available to buy right now/)
  assert.match(empty, /<button[^>]*>Try again<\/button>/)
})

test("an active plan hides the purchase cards and shows management for a yearly plan", () => {
  const lifetimeActive = paywall({ status: { pro: true, source: "purchase", plan: "LIFETIME", expiresAt: null } })
  assert.match(lifetimeActive, /Pro Lifetime is active/)
  assert.doesNotMatch(lifetimeActive, /Subscribe|Buy for|Manage subscription/)
  assert.match(lifetimeActive, /Restore purchases/)

  const yearlyActive = paywall({
    status: { pro: true, source: "purchase", plan: "YEARLY", expiresAt: "2027-11-18T12:00:00Z" },
    managementUrl: "https://apps.apple.com/account/subscriptions",
  })
  assert.match(yearlyActive, /Pro Yearly is active/)
  assert.match(yearlyActive, /18 November 2027/)
  assert.match(yearlyActive, /<a class="paywall-link" href="https:\/\/apps\.apple\.com\/account\/subscriptions"[^>]*>Manage subscription<\/a>/)
})

test("manual Pro grants say so and need no purchase", () => {
  const markup = paywall({ status: { pro: true, source: "grant", plan: null, expiresAt: null } })
  assert.match(markup, /Pro was added to your account by ShelfPick/)
  assert.doesNotMatch(markup, /Subscribe|Buy for/)
})

test("messages use alert for errors and status for the rest", () => {
  assert.match(paywall({ message: { tone: "error", text: "Nope" } }), /role="alert">Nope/)
  assert.match(paywall({ message: { tone: "info", text: "Waiting" } }), /role="status">Waiting/)
})

// --- Purchase flow: the server, not the store, decides --------------------------

function fakeStore(overrides = {}) {
  const calls = []
  return {
    calls,
    bind: async id => { calls.push(["bind", id]) },
    loadOffers: async () => [yearly, lifetime],
    purchase: async (plan, id) => { calls.push(["purchase", plan.id, id]); return "purchased" },
    restore: async id => { calls.push(["restore", id]) },
    managementUrl: async () => null,
    ...overrides,
  }
}

function deps(store, accounts, isCurrent = () => true) {
  const queue = [...accounts]
  const state = { syncs: 0, refreshed: 0, waits: [] }
  return {
    state,
    deps: {
      store,
      appUserId: "acct-1",
      isCurrent,
      syncBilling: async () => { state.syncs += 1; const next = queue.length > 1 ? queue.shift() : queue[0]; if (next instanceof Error) throw next; return next },
      refreshUser: async () => { state.refreshed += 1 },
      wait: async ms => { state.waits.push(ms) },
    },
  }
}

const proAccount = { pro: true, source: "purchase", plan: "LIFETIME", expires_at: null, billing_available: true, app_user_id: "x" }
const freeAccount = { ...proAccount, pro: false, source: null, plan: null }

test("a purchase turns Pro on only after the server confirms it", async () => {
  const store = fakeStore()
  const { state, deps: flowDeps } = deps(store, [proAccount])
  const result = await flow.buyPlan(flowDeps, lifetime)
  assert.equal(result.kind, "pro")
  assert.deepEqual(store.calls, [["purchase", "lifetime", "acct-1"]])
  assert.equal(state.syncs, 1)
  assert.equal(state.refreshed, 1)
})

test("a store purchase the server cannot confirm never reports Pro", async () => {
  const { state, deps: flowDeps } = deps(fakeStore(), [freeAccount])
  const result = await flow.buyPlan(flowDeps, yearly)
  assert.equal(result.kind, "unconfirmed")
  assert.equal(state.syncs, 4)
  assert.equal(state.refreshed, 0)
  assert.match(flow.flowMessage(result).text, /hasn’t confirmed it yet/)
})

test("confirmation waits for RevenueCat to catch up", async () => {
  const { state, deps: flowDeps } = deps(fakeStore(), [freeAccount, freeAccount, proAccount])
  const result = await flow.buyPlan(flowDeps, yearly)
  assert.equal(result.kind, "pro")
  assert.equal(state.syncs, 3)
  assert.deepEqual(state.waits, [2500, 2500])
})

test("cancelling the App Store sheet is silent and never calls the server", async () => {
  const store = fakeStore({ purchase: async () => "cancelled" })
  const { state, deps: flowDeps } = deps(store, [proAccount])
  const result = await flow.buyPlan(flowDeps, yearly)
  assert.equal(result.kind, "cancelled")
  assert.equal(flow.flowMessage(result), null)
  assert.equal(state.syncs, 0)
})

test("an Ask to Buy purchase reports pending without granting Pro", async () => {
  const store = fakeStore({ purchase: async () => "pending" })
  const { state, deps: flowDeps } = deps(store, [proAccount])
  const result = await flow.buyPlan(flowDeps, yearly)
  assert.equal(result.kind, "pending")
  assert.equal(state.syncs, 0)
})

test("store and server failures become messages, not Pro", async () => {
  const storeFailure = fakeStore({ purchase: async () => { throw new Error("Store down") } })
  const first = await flow.buyPlan(deps(storeFailure, [proAccount]).deps, yearly)
  assert.deepEqual(first, { kind: "error", message: "Store down" })

  const serverFailure = await flow.buyPlan(deps(fakeStore(), [new Error("Server down")]).deps, yearly)
  assert.deepEqual(serverFailure, { kind: "error", message: "Server down" })
})

test("restore asks the store, then lets the server decide", async () => {
  const store = fakeStore()
  const restored = deps(store, [proAccount])
  assert.equal((await flow.restorePurchases(restored.deps)).kind, "pro")
  assert.deepEqual(store.calls, [["restore", "acct-1"]])
  assert.equal(restored.state.refreshed, 1)

  const nothing = await flow.restorePurchases(deps(fakeStore(), [freeAccount]).deps)
  assert.equal(nothing.kind, "nothing-to-restore")
  assert.match(flow.flowMessage(nothing).text, /No Pro purchase was found/)
})

test("a restore or purchase for an account that is no longer signed in never touches the store or the server", async () => {
  const store = fakeStore()
  const stale = deps(store, [proAccount], () => false)
  assert.equal((await flow.restorePurchases(stale.deps)).kind, "superseded")
  assert.equal((await flow.buyPlan(stale.deps, yearly)).kind, "superseded")
  assert.deepEqual(store.calls, [])
  assert.equal(stale.state.syncs, 0)
  assert.equal(flow.flowMessage({ kind: "superseded" }), null)
})

test("an account switch during a restore stops confirmation for the previous account", async () => {
  let current = true
  const store = fakeStore({ restore: async id => { current = false; store.calls.push(["restore", id]) } })
  const run = deps(store, [proAccount], () => current)
  const result = await flow.restorePurchases(run.deps)
  assert.equal(result.kind, "superseded")
  assert.equal(run.state.syncs, 0)
  assert.equal(run.state.refreshed, 0)

  // Switching while the server check is in flight discards its answer instead of applying it.
  let late = true
  const inFlight = deps(fakeStore(), [proAccount], () => late)
  const slowSync = inFlight.deps.syncBilling
  inFlight.deps.syncBilling = async () => { const account = await slowSync(); late = false; return account }
  assert.equal((await flow.restorePurchases(inFlight.deps)).kind, "superseded")
  assert.equal(inFlight.state.refreshed, 0)
})

// --- Paywall loading: Restore does not wait for plans or for a slow lookup --------

function loaderRun({ store, getAccount, isCurrent = () => true }) {
  const reports = []
  return { reports, done: paywallLoad.loadPaywall({ store, getAccount, isCurrent, report: update => reports.push(update) }) }
}
const billingAccount = { ...freeAccount, app_user_id: "acct-1" }

test("the store is signed in before Restore opens, and plans that fail to load do not block it", async () => {
  const store = fakeStore({ loadOffers: async () => { throw new Error("offerings unavailable") } })
  const { reports, done } = loaderRun({ store, getAccount: async () => billingAccount })
  await done
  assert.deepEqual(store.calls, [["bind", "acct-1"]])
  assert.deepEqual(reports.map(r => Object.keys(r)[0]), ["account", "boundFor", "offers"])
  assert.equal(reports[1].boundFor, "acct-1")
  assert.deepEqual(reports[2].offers, [])
  assert.match(reports[2].error.message, /offerings unavailable/)
})

test("a store that cannot be signed in never reports the account as bound", async () => {
  const store = fakeStore({ bind: async () => { throw new Error("no sdk") } })
  const { reports, done } = loaderRun({ store, getAccount: async () => billingAccount })
  await done
  assert.ok(reports.every(r => r.boundFor === undefined))
  assert.deepEqual(reports.at(-1).offers, [])
  assert.match(reports.at(-1).error.message, /no sdk/)
})

test("a slow billing lookup that finishes after an account switch signs nobody in", async () => {
  let current = true
  let release
  const store = fakeStore()
  const { reports, done } = loaderRun({
    store,
    getAccount: () => new Promise(resolve => { release = () => resolve(billingAccount) }),
    isCurrent: () => current,
  })
  current = false // the account switched while the lookup was pending
  release()
  await done
  assert.deepEqual(store.calls, [])
  assert.deepEqual(reports, [])
})

test("an account switch while the SDK is being prepared reports nothing for the old account", async () => {
  let current = true
  const store = fakeStore({ bind: async id => { store.calls.push(["bind", id]); current = false } })
  const { reports, done } = loaderRun({ store, getAccount: async () => billingAccount, isCurrent: () => current })
  await done
  assert.deepEqual(reports.map(r => Object.keys(r)[0]), ["account"])
  assert.deepEqual(store.calls, [["bind", "acct-1"]])
})

test("a store that is not available reports no plans without signing in", async () => {
  const store = fakeStore()
  const { reports, done } = loaderRun({ store, getAccount: async () => ({ ...billingAccount, billing_available: false }) })
  await done
  assert.deepEqual(store.calls, [])
  assert.deepEqual(reports.at(-1), { offers: [] })
})

// --- Store: RevenueCat SDK handling -----------------------------------------------

function fakeSdk({ configured = false, offering } = {}) {
  const log = []
  return {
    log,
    configure: async options => { configured = true; log.push(["configure", options]) },
    logIn: async options => { log.push(["logIn", options]) },
    isConfigured: async () => ({ isConfigured: configured }),
    getOfferings: async () => ({ current: offering === undefined
      ? { annual: { product: { priceString: "£3.99" } }, lifetime: { product: { priceString: "£9.99" } } }
      : offering }),
    purchasePackage: async options => { log.push(["purchase", options.aPackage]) },
    restorePurchases: async () => { log.push(["restore"]) },
    getCustomerInfo: async () => ({ customerInfo: { managementURL: "https://apps.apple.com/account/subscriptions" } }),
  }
}

test("store signs the SDK in as the ShelfPick account and maps store prices", async () => {
  const sdk = fakeSdk()
  const store = storeModule.createProStore({ apiKey: "appl_test", loadSdk: async () => sdk })
  await store.bind("account-1")
  assert.deepEqual(sdk.log, [["configure", { apiKey: "appl_test", appUserID: "account-1" }]])
  const offers = await store.loadOffers()
  assert.deepEqual(offers.map(o => [o.id, o.price]), [["yearly", "£3.99"], ["lifetime", "£9.99"]])

  await store.bind("account-1")
  assert.equal(sdk.log.length, 1)

  await store.bind("account-2")
  assert.deepEqual(sdk.log[1], ["logIn", { appUserID: "account-2" }])
})

test("store uses logIn when the SDK is already configured", async () => {
  const sdk = fakeSdk({ configured: true })
  await storeModule.createProStore({ apiKey: "k", loadSdk: async () => sdk }).bind("account-1")
  assert.deepEqual(sdk.log, [["logIn", { appUserID: "account-1" }]])
})

test("store offers only plans present in the current offering", async () => {
  const sdk = fakeSdk({ offering: { annual: null, lifetime: { product: { priceString: "£9.99" } } } })
  const offers = await storeModule.createProStore({ apiKey: "k", loadSdk: async () => sdk }).loadOffers()
  assert.deepEqual(offers.map(o => o.id), ["lifetime"])
  const none = fakeSdk({ offering: null })
  assert.deepEqual(await storeModule.createProStore({ apiKey: "k", loadSdk: async () => none }).loadOffers(), [])
})

test("store maps cancellation and pending errors and rethrows the rest", async () => {
  const cases = [
    [{ code: "1" }, "cancelled"],
    [{ userCancelled: true }, "cancelled"],
    [{ code: "20" }, "pending"],
  ]
  for (const [error, expected] of cases) {
    const sdk = { ...fakeSdk(), purchasePackage: async () => { throw error } }
    const store = storeModule.createProStore({ apiKey: "k", loadSdk: async () => sdk })
    assert.equal(await store.purchase(yearly, "a"), expected)
  }
  const broken = { ...fakeSdk(), purchasePackage: async () => { throw new Error("network") } }
  await assert.rejects(storeModule.createProStore({ apiKey: "k", loadSdk: async () => broken }).purchase(yearly, "a"), /network/)
})

test("restore signs the SDK in as the intended account first and never runs under the previous one", async () => {
  const sdk = fakeSdk()
  const store = storeModule.createProStore({ apiKey: "k", loadSdk: async () => sdk })
  await store.bind("account-A")
  sdk.log.length = 0
  await store.restore("account-B")
  assert.deepEqual(sdk.log, [["logIn", { appUserID: "account-B" }], ["restore"]])
  sdk.log.length = 0
  await store.restore("account-B")
  assert.deepEqual(sdk.log, [["restore"]])
})

test("a slow sign-in for the first account cannot land after the second, and Restore waits for the right one", async () => {
  const sdk = fakeSdk({ configured: true })
  let releaseA
  sdk.logIn = options => new Promise(resolve => {
    const finish = () => { sdk.log.push(["logIn", options]); resolve() }
    if (options.appUserID === "account-A") releaseA = finish
    else finish()
  })
  const store = storeModule.createProStore({ apiKey: "k", loadSdk: async () => sdk })
  const first = store.bind("account-A") // still preparing when the account switches
  const second = store.bind("account-B")
  const restore = store.restore("account-B")
  await new Promise(resolve => setTimeout(resolve, 10))
  assert.deepEqual(sdk.log, [])
  releaseA()
  await Promise.all([first, second, restore])
  assert.deepEqual(sdk.log, [["logIn", { appUserID: "account-A" }], ["logIn", { appUserID: "account-B" }], ["restore"]])
})

test("restore works when plans cannot be loaded", async () => {
  const sdk = { ...fakeSdk(), getOfferings: async () => { throw new Error("offerings unavailable") } }
  const store = storeModule.createProStore({ apiKey: "k", loadSdk: async () => sdk })
  await store.bind("account-A")
  await assert.rejects(store.loadOffers(), /offerings unavailable/)
  await store.restore("account-A")
  assert.deepEqual(sdk.log, [["configure", { apiKey: "k", appUserID: "account-A" }], ["restore"]])
})

test("a sign-in that never answers does not block Restore forever", async () => {
  const sdk = { ...fakeSdk({ configured: true }), logIn: options => options.appUserID === "A" ? new Promise(() => {}) : Promise.resolve() }
  const store = storeModule.createProStore({ apiKey: "k", loadSdk: async () => sdk, prepareTimeoutMs: 30 })
  await assert.rejects(store.bind("A"), /taking too long/)
  await store.restore("B")
  assert.deepEqual(sdk.log, [["restore"]])
})

test("the SDK handed to the store can be awaited even when the plugin object cannot", async () => {
  // Like a Capacitor plugin: every property, "then" included, is a native call
  // that never answers, so resolving a promise with the plugin itself hangs.
  const plugin = new Proxy({}, { get: (_, name) => name === "isConfigured" ? async () => ({ isConfigured: true }) : () => new Promise(() => {}) })
  const sdk = await Promise.resolve().then(() => storeModule.sdkFromPlugin(plugin))
  assert.deepEqual(await sdk.isConfigured(), { isConfigured: true })
})

test("loading plans gives up after the timeout instead of hanging", async () => {
  const hung = { ...fakeSdk(), getOfferings: () => new Promise(() => {}) }
  const store = storeModule.createProStore({ apiKey: "k", loadSdk: async () => hung, prepareTimeoutMs: 20 })
  await assert.rejects(store.loadOffers(), /taking too long/)
})

test("a store error is described with its code and what the SDK said", () => {
  const describe = storeModule.describeStoreError
  assert.equal(
    describe({ code: "23", message: "There's a problem with your configuration.", underlyingErrorMessage: "None of the products could be fetched" }),
    "23: There's a problem with your configuration. – None of the products could be fetched",
  )
  assert.equal(describe({ code: 7, message: "Network error" }), "7: Network error")
  assert.equal(describe(new Error("The App Store is taking too long to respond.")), "The App Store is taking too long to respond.")
  assert.equal(describe("odd"), "odd")
  assert.equal(describe(undefined), "Unknown error")
  assert.equal(describe({ code: "9" }), "9: Unknown error")
})

test("a very long store error is cut to a short support line", () => {
  const line = storeModule.describeStoreError({ code: "1", message: "x".repeat(1000) })
  assert.ok(line.length <= 220)
  assert.ok(line.endsWith("…"))
})

test("store reads the subscription management link", async () => {
  const store = storeModule.createProStore({ apiKey: "k", loadSdk: async () => fakeSdk() })
  assert.equal(await store.managementUrl(), "https://apps.apple.com/account/subscriptions")
})

test("describeProStatus covers Free, lifetime, yearly and grants", () => {
  assert.equal(plans.describeProStatus(free).headline, "You’re on Free")
  assert.equal(plans.describeProStatus({ pro: true, source: "purchase", plan: "LIFETIME", expiresAt: null }).headline, "Pro Lifetime is active")
  assert.equal(plans.describeProStatus({ pro: true, source: "purchase", plan: "YEARLY", expiresAt: "not a date" }).detail.includes("the end of the current period"), true)
  assert.equal(plans.describeProStatus({ pro: true, source: "grant", plan: null, expiresAt: null }).headline, "Pro is active")
})
