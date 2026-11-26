// Tip jar: three consumable in-app purchases through RevenueCat. Tips unlock nothing; Pro is separate.
import type { ProStore, StoreTip } from "./billing/store"

// The one place the tip product IDs live in the app. The server ignores the same IDs (TIP_PRODUCT_IDS in
// backend/services/billing_service.py); a backend test fails if the two lists differ. The store supplies
// the price, so none is stored here.
export const TIP_PRODUCTS = [
  { id: "tip.coffee", name: "Coffee" },
  { id: "tip.pint", name: "Pint" },
  { id: "tip.gamenight", name: "Game night" },
] as const

export type TipProductId = typeof TIP_PRODUCTS[number]["id"]
export const TIP_PRODUCT_IDS: readonly TipProductId[] = TIP_PRODUCTS.map((product) => product.id)

// A product as the sheet shows it: the name above and the store's own price string.
export type TipProduct = { id: TipProductId; name: string; price: string }

export type PurchaseResult =
  | { status: "purchased" }
  | { status: "pending" }
  | { status: "cancelled" }
  | { status: "failed"; message?: string }

// The purchase layer the tip jar uses.
export type PurchaseLayer = {
  loadProducts: (ids: readonly TipProductId[]) => Promise<TipProduct[]>
  purchase: (id: TipProductId) => Promise<PurchaseResult>
}

type TipLayerDeps = {
  store: Pick<ProStore, "loadTipProducts" | "purchaseTip">
  // The signed-in account's RevenueCat app user ID. Read again on Retry if it failed.
  getAppUserId: () => Promise<string>
  // False once the signed-in account has changed: nothing more is loaded or bought for it.
  isCurrent: () => boolean
}

const NOT_AVAILABLE = "That tip isn't available right now."

// The purchase layer on the RevenueCat store. Every load and purchase names the account, and the store signs
// the SDK in as it first, so a tip is only ever bought for the account that is signed in.
export function createTipLayer({ store, getAppUserId, isCurrent }: TipLayerDeps): PurchaseLayer {
  let appUserId: Promise<string> | null = null
  const currentAppUserId = () => {
    appUserId ??= getAppUserId().catch((error: unknown) => { appUserId = null; throw error })
    return appUserId
  }
  // Only products the store returned can be bought.
  let loaded = new Map<string, StoreTip>()

  return {
    async loadProducts(ids) {
      const id = await currentAppUserId()
      if (!isCurrent()) throw new Error("The signed-in account changed.")
      const found = await store.loadTipProducts(ids, id)
      if (!isCurrent()) throw new Error("The signed-in account changed.")
      loaded = new Map(found.map((tip) => [tip.id, tip]))
      return TIP_PRODUCTS
        .filter((product) => ids.includes(product.id) && loaded.has(product.id))
        .map((product) => ({ id: product.id, name: product.name, price: loaded.get(product.id)!.priceString }))
    },

    async purchase(id) {
      const tip = loaded.get(id)
      if (!tip || !isCurrent()) return { status: "failed", message: NOT_AVAILABLE }
      const boundAccount = await currentAppUserId()
      if (!isCurrent()) return { status: "failed", message: NOT_AVAILABLE }
      return { status: await store.purchaseTip(tip, boundAccount) }
    },
  }
}

// The layer for the tip jar, or null when there is nothing to buy: purchases are off in this build, or there is
// no store (the PWA).
export function tipLayerFor({ purchasesEnabled, store, ...deps }: Omit<TipLayerDeps, "store"> & {
  purchasesEnabled: boolean
  store: TipLayerDeps["store"] | null
}): PurchaseLayer | null {
  return purchasesEnabled && store !== null ? createTipLayer({ store, ...deps }) : null
}

const TIP_COUNT_KEY = "shelfpick-tip-count"

// Kept on this device only (owner decision, SP-SETTINGS-01).
export function tipCount(): number {
  try {
    const count = Number.parseInt(localStorage.getItem(TIP_COUNT_KEY) ?? "0", 10)
    return Number.isFinite(count) && count > 0 ? count : 0
  } catch {
    return 0
  }
}

export function recordTip(): number {
  const next = tipCount() + 1
  localStorage.setItem(TIP_COUNT_KEY, String(next))
  return next
}

export type TipOutcome =
  | { kind: "thanks"; count: number }
  | { kind: "pending" }
  | { kind: "cancelled" }
  | { kind: "failed"; message: string }

// Only a completed purchase counts. Cancelled, failed and pending ones leave
// the tip count alone.
export async function purchaseTip(layer: PurchaseLayer, id: TipProductId): Promise<TipOutcome> {
  let result: PurchaseResult
  try {
    result = await layer.purchase(id)
  } catch {
    result = { status: "failed" }
  }
  switch (result.status) {
    case "purchased": return { kind: "thanks", count: recordTip() }
    case "pending": return { kind: "pending" }
    case "cancelled": return { kind: "cancelled" }
    default: return { kind: "failed", message: result.message ?? "The purchase didn't go through. You haven't been charged." }
  }
}
