// Tip jar: three consumable in-app purchases. Tips unlock nothing; Pro is separate.

export const TIP_PRODUCTS = [
  { id: "tip.coffee", name: "Coffee", price: "£1.99" },
  { id: "tip.pint", name: "Pint", price: "£4.99" },
  { id: "tip.gamenight", name: "Game night", price: "£9.99" },
] as const

export type TipProductId = typeof TIP_PRODUCTS[number]["id"]
export type TipProduct = { id: TipProductId; name: string; price: string }

export type PurchaseResult =
  | { status: "purchased" }
  | { status: "pending" }
  | { status: "cancelled" }
  | { status: "failed"; message?: string }

// The purchase layer the tip jar uses. A StoreKit tip layer is not built yet (SP-PRO-01 sells Pro only).
export type PurchaseLayer = {
  loadProducts: (ids: readonly TipProductId[]) => Promise<TipProduct[]>
  purchase: (id: TipProductId) => Promise<PurchaseResult>
}

function createDevPurchaseLayer(): PurchaseLayer {
  return {
    loadProducts: async (ids) => TIP_PRODUCTS.filter((product) => ids.includes(product.id)),
    purchase: () => new Promise((resolve) => setTimeout(() => resolve({ status: "purchased" }), 600)),
  }
}

// No StoreKit layer exists yet, so the tip jar is hidden in release builds and
// runs against a stand-in during local development only.
export const purchaseLayer: PurchaseLayer | null = import.meta.env.DEV ? createDevPurchaseLayer() : null

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
