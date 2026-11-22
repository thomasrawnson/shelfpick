import { useEffect, useState } from "react"

import { getBillingAccount } from "./api/client"
import { proStore } from "./billing/store"
import { PURCHASES_ENABLED } from "./purchases-flag"
import { tipLayerFor, TIP_PRODUCT_IDS, type PurchaseLayer } from "./tip-jar"

// The tip jar's purchase layer for the signed-in account, or null when there is nothing to buy: the build
// does not sell anything, there is no native store (the PWA), or the tip products cannot be loaded. The
// products are fetched once here so the row only shows when a tip can be bought. If a later load in the
// open sheet fails, the sheet shows an error with Retry. Re-keyed per account by its caller.
export function useTipLayer(userId: number): PurchaseLayer | null {
  const [layer, setLayer] = useState<PurchaseLayer | null>(null)

  useEffect(() => {
    let current = true
    const candidate = tipLayerFor({
      purchasesEnabled: PURCHASES_ENABLED,
      store: proStore,
      getAppUserId: async () => (await getBillingAccount()).app_user_id,
      isCurrent: () => current,
    })
    if (candidate === null) return
    candidate.loadProducts(TIP_PRODUCT_IDS)
      .then((products) => { if (current && products.length > 0) setLayer(candidate) })
      .catch(() => { /* Nothing to buy right now: the row stays hidden. */ })
    return () => { current = false; setLayer(null) }
  }, [userId])

  return layer
}
