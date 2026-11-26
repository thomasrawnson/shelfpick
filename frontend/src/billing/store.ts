import { Capacitor } from "@capacitor/core"
import type { PurchasesPackage, PurchasesStoreProduct } from "@revenuecat/purchases-capacitor"

import { TIP_PRODUCT_IDS } from "../tip-jar"
import type { PlanOffer } from "./plans"

// The App Store side of buying Pro, through RevenueCat. It only completes the
// purchase on the device: whether the account is Pro is decided by the server
// after it checks the purchase with RevenueCat.

export type PurchaseOutcome = "purchased" | "cancelled" | "pending"

// A tip product from the store: its price as the store formats it, and the handle to buy it.
export type StoreTip = { id: string; priceString: string; handle: unknown }

export type ProStore = {
  // Signs the SDK in as this ShelfPick account. Restore only opens once this has succeeded.
  bind: (appUserId: string) => Promise<void>
  // The store's plans and prices. Needs no sign-in of its own, so Restore never waits on it.
  loadOffers: () => Promise<PlanOffer[]>
  // Purchases and restores name the account they are for. The store signs the SDK in as that
  // account first if it is not already, so neither can run against a previous account's identity.
  purchase: (plan: PlanOffer, appUserId: string) => Promise<PurchaseOutcome>
  restore: (appUserId: string) => Promise<void>
  // Tip jar: one-time products that unlock nothing. Both sign the SDK in as the account first.
  loadTipProducts: (ids: readonly string[], appUserId: string) => Promise<StoreTip[]>
  purchaseTip: (tip: StoreTip, appUserId: string) => Promise<PurchaseOutcome>
  managementUrl: () => Promise<string | null>
}

type Sdk = {
  configure: (options: { apiKey: string; appUserID: string }) => Promise<void>
  logIn: (options: { appUserID: string }) => Promise<unknown>
  getOfferings: () => Promise<{ current: { lifetime: PurchasesPackage | null; annual: PurchasesPackage | null } | null }>
  purchasePackage: (options: { aPackage: PurchasesPackage }) => Promise<unknown>
  getProducts: (options: { productIdentifiers: string[]; type?: "NON_SUBSCRIPTION" }) => Promise<{ products: PurchasesStoreProduct[] }>
  purchaseStoreProduct: (options: { product: PurchasesStoreProduct }) => Promise<unknown>
  restorePurchases: () => Promise<unknown>
  getCustomerInfo: () => Promise<{ customerInfo: { managementURL: string | null } }>
  isConfigured: () => Promise<{ isConfigured: boolean }>
}

type Deps = {
  apiKey: string
  loadSdk: () => Promise<Sdk>
  // How long loading plans may take before the paywall gives up and offers a retry.
  prepareTimeoutMs?: number
}

// Long enough for RevenueCat and StoreKit to answer on a slow connection and
// to report their own error, which a shorter wait hid (1.2 (15) showed only
// "taking too long"). Still bounded, so the paywall never loads forever.
const PREPARE_TIMEOUT_MS = 60_000

function withTimeout<T>(work: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("The App Store is taking too long to respond.")), ms)
    work.then(
      value => { clearTimeout(timer); resolve(value) },
      (error: unknown) => { clearTimeout(timer); reject(error) },
    )
  })
}

const USER_CANCELLED = "1"
const PAYMENT_PENDING = "20"

function errorCode(error: unknown): string | null {
  if (typeof error !== "object" || error === null) return null
  const code = (error as { code?: unknown }).code
  return typeof code === "string" || typeof code === "number" ? String(code) : null
}

const SUPPORT_DETAIL_MAX = 220

// A short, secret-free line for support when the store fails: the SDK error
// code and what the SDK said. Never includes keys or account details.
export function describeStoreError(error: unknown): string {
  const code = errorCode(error)
  const fields = typeof error === "object" && error !== null
    ? error as { message?: unknown; underlyingErrorMessage?: unknown }
    : {}
  const parts = [fields.message, fields.underlyingErrorMessage]
    .filter((part): part is string => typeof part === "string" && part.trim() !== "")
  const text = parts.length > 0 ? parts.join(" – ") : typeof error === "string" ? error : "Unknown error"
  const line = code === null ? text : `${code}: ${text}`
  return line.length > SUPPORT_DETAIL_MAX ? `${line.slice(0, SUPPORT_DETAIL_MAX - 1)}…` : line
}

function userCancelled(error: unknown): boolean {
  return errorCode(error) === USER_CANCELLED
    || (typeof error === "object" && error !== null && (error as { userCancelled?: unknown }).userCancelled === true)
}

// Runs a store purchase and maps the SDK's cancel and pending codes. Anything else is an error.
async function outcomeOf(purchase: () => Promise<unknown>): Promise<PurchaseOutcome> {
  try {
    await purchase()
    return "purchased"
  } catch (error) {
    if (userCancelled(error)) return "cancelled"
    if (errorCode(error) === PAYMENT_PENDING) return "pending"
    throw error
  }
}

export function createProStore({ apiKey, loadSdk, prepareTimeoutMs = PREPARE_TIMEOUT_MS }: Deps): ProStore {
  let configuredFor: string | null = null
  // Changing the SDK's identity and the calls that depend on it run one at a time, in order,
  // so a slow sign-in for one account can never land after a later account's. A call that never
  // answers holds the line for at most the prepare timeout, so Restore cannot wait forever behind it.
  let queue: Promise<unknown> = Promise.resolve()
  function inOrder<T>(work: () => Promise<T>): Promise<T> {
    const run = queue.then(work, work)
    queue = withTimeout(run, prepareTimeoutMs).catch(() => undefined)
    return run
  }

  async function sdkFor(appUserId: string): Promise<Sdk> {
    const sdk = await loadSdk()
    if (configuredFor === appUserId) return sdk
    const { isConfigured } = await sdk.isConfigured()
    if (isConfigured) await sdk.logIn({ appUserID: appUserId })
    else await sdk.configure({ apiKey, appUserID: appUserId })
    configuredFor = appUserId
    return sdk
  }

  return {
    bind(appUserId) {
      return withTimeout(inOrder(async () => { await sdkFor(appUserId) }), prepareTimeoutMs)
    },

    loadOffers() {
      return withTimeout((async () => {
        const sdk = await loadSdk()
        const offering = (await sdk.getOfferings()).current
        const offers: PlanOffer[] = []
        if (offering?.annual) offers.push({ id: "yearly", price: offering.annual.product.priceString, handle: offering.annual })
        if (offering?.lifetime) offers.push({ id: "lifetime", price: offering.lifetime.product.priceString, handle: offering.lifetime })
        return offers
      })(), prepareTimeoutMs)
    },

    purchase(plan, appUserId) {
      return inOrder(async () => {
        const sdk = await sdkFor(appUserId)
        return outcomeOf(() => sdk.purchasePackage({ aPackage: plan.handle as PurchasesPackage }))
      })
    },

    loadTipProducts(ids, appUserId) {
      return withTimeout(inOrder(async () => {
        const sdk = await sdkFor(appUserId)
        const { products } = await sdk.getProducts({ productIdentifiers: [...ids], type: "NON_SUBSCRIPTION" })
        return products
          .filter(product => ids.includes(product.identifier))
          .map(product => ({ id: product.identifier, priceString: product.priceString, handle: product }))
      }), prepareTimeoutMs)
    },

    purchaseTip(tip, appUserId) {
      return inOrder(async () => {
        const sdk = await sdkFor(appUserId)
        return outcomeOf(() => sdk.purchaseStoreProduct({ product: tip.handle as PurchasesStoreProduct }))
      })
    },

    restore(appUserId) {
      return inOrder(async () => {
        const sdk = await sdkFor(appUserId)
        await sdk.restorePurchases()
      })
    },

    async managementUrl() {
      const sdk = await loadSdk()
      return (await sdk.getCustomerInfo()).customerInfo.managementURL
    },
  }
}

const apiKey = (import.meta.env.VITE_REVENUECAT_IOS_API_KEY ?? "").trim()

// Capacitor plugin objects answer to every property name, including "then",
// so a promise that resolves with one waits forever for a native method that
// does not exist. That hung the paywall on TestFlight with no error. Hand the
// store a plain object of calls instead.
export function sdkFromPlugin(plugin: Sdk): Sdk {
  return {
    configure: options => plugin.configure(options),
    logIn: options => plugin.logIn(options),
    getOfferings: () => plugin.getOfferings(),
    purchasePackage: options => plugin.purchasePackage(options),
    getProducts: options => plugin.getProducts(options),
    purchaseStoreProduct: options => plugin.purchaseStoreProduct(options),
    restorePurchases: () => plugin.restorePurchases(),
    getCustomerInfo: () => plugin.getCustomerInfo(),
    isConfigured: () => plugin.isConfigured(),
  }
}

async function loadRevenueCat(): Promise<Sdk> {
  const { Purchases } = await import("@revenuecat/purchases-capacitor")
  return sdkFromPlugin(Purchases as unknown as Sdk)
}

// Local development only: fixed prices so the paywall can be built and tested
// in a browser. A "purchase" here still has to be confirmed by the server,
// which only trusts RevenueCat, so it never unlocks Pro by itself.
const DEV_TIP_PRICES: Record<(typeof TIP_PRODUCT_IDS)[number], string> = {
  "tip.coffee": "£1.99",
  "tip.pint": "£4.99",
  "tip.gamenight": "£9.99",
}

const developmentStore: ProStore = {
  bind: async () => {},
  loadOffers: async () => [
    { id: "yearly", price: "£3.99", handle: null },
    { id: "lifetime", price: "£9.99", handle: null },
  ],
  purchase: async () => "purchased",
  restore: async () => {},
  // The tip prices are the only hard-coded ones; the real store returns its own localised strings.
  loadTipProducts: async ids => TIP_PRODUCT_IDS
    .filter(id => ids.includes(id))
    .map(id => ({ id, priceString: DEV_TIP_PRICES[id], handle: null })),
  purchaseTip: () => new Promise(resolve => setTimeout(() => resolve("purchased"), 600)),
  managementUrl: async () => null,
}

// Purchases exist only in the iOS app and only when its build has a RevenueCat
// public SDK key. Release builds without one (the PWA) have no store.
export const proStore: ProStore | null =
  apiKey && Capacitor.isNativePlatform()
    ? createProStore({ apiKey, loadSdk: loadRevenueCat })
    : import.meta.env.DEV ? developmentStore : null
