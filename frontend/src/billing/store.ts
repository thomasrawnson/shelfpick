import { Capacitor } from "@capacitor/core"
import type { PurchasesPackage } from "@revenuecat/purchases-capacitor"

import type { PlanOffer } from "./plans"

// The App Store side of buying Pro, through RevenueCat. It only completes the
// purchase on the device: whether the account is Pro is decided by the server
// after it checks the purchase with RevenueCat.

export type PurchaseOutcome = "purchased" | "cancelled" | "pending"

export type ProStore = {
  // Signs the SDK in as this account and loads the store's plans and prices.
  prepare: (appUserId: string) => Promise<PlanOffer[]>
  purchase: (plan: PlanOffer) => Promise<PurchaseOutcome>
  restore: () => Promise<void>
  managementUrl: () => Promise<string | null>
}

type Sdk = {
  configure: (options: { apiKey: string; appUserID: string }) => Promise<void>
  logIn: (options: { appUserID: string }) => Promise<unknown>
  getOfferings: () => Promise<{ current: { lifetime: PurchasesPackage | null; annual: PurchasesPackage | null } | null }>
  purchasePackage: (options: { aPackage: PurchasesPackage }) => Promise<unknown>
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

export function createProStore({ apiKey, loadSdk, prepareTimeoutMs = PREPARE_TIMEOUT_MS }: Deps): ProStore {
  let configuredFor: string | null = null

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
    prepare(appUserId) {
      return withTimeout((async () => {
        const sdk = await sdkFor(appUserId)
        const offering = (await sdk.getOfferings()).current
        const offers: PlanOffer[] = []
        if (offering?.annual) offers.push({ id: "yearly", price: offering.annual.product.priceString, handle: offering.annual })
        if (offering?.lifetime) offers.push({ id: "lifetime", price: offering.lifetime.product.priceString, handle: offering.lifetime })
        return offers
      })(), prepareTimeoutMs)
    },

    async purchase(plan) {
      const sdk = await loadSdk()
      try {
        await sdk.purchasePackage({ aPackage: plan.handle as PurchasesPackage })
        return "purchased"
      } catch (error) {
        if (userCancelled(error)) return "cancelled"
        if (errorCode(error) === PAYMENT_PENDING) return "pending"
        throw error
      }
    },

    async restore() {
      const sdk = await loadSdk()
      await sdk.restorePurchases()
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
const developmentStore: ProStore = {
  prepare: async () => [
    { id: "yearly", price: "£3.99", handle: null },
    { id: "lifetime", price: "£9.99", handle: null },
  ],
  purchase: async () => "purchased",
  restore: async () => {},
  managementUrl: async () => null,
}

// Purchases exist only in the iOS app and only when its build has a RevenueCat
// public SDK key. Release builds without one (the PWA) have no store.
export const proStore: ProStore | null =
  apiKey && Capacitor.isNativePlatform()
    ? createProStore({ apiKey, loadSdk: loadRevenueCat })
    : import.meta.env.DEV ? developmentStore : null
