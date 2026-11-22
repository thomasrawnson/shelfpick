import type { BillingAccount } from "../api/client"
import type { PlanOffer } from "./plans"
import type { ProStore } from "./store"

// What the paywall shows as it loads, in the order it becomes known. Restore needs only `boundFor`;
// the plans are a separate step, so a store that cannot list plans still lets someone restore.
export type PaywallLoad = {
  account?: BillingAccount
  // The billing account the store is signed in as. Restore opens once it matches the current account.
  boundFor?: string
  offers?: PlanOffer[]
  managementUrl?: string | null
  error?: unknown
}

type Deps = {
  store: ProStore | null
  getAccount: () => Promise<BillingAccount>
  // False once the signed-in account has changed or the paywall has closed: nothing more is reported or bound.
  isCurrent: () => boolean
  report: (update: PaywallLoad) => void
}

export async function loadPaywall({ store, getAccount, isCurrent, report }: Deps): Promise<void> {
  let account: BillingAccount | null = null
  try {
    account = await getAccount()
  } catch {
    // The plan still shows from the signed-in user; the store just won't load.
  }
  // A slow lookup that finishes after an account switch must not sign the SDK in as the old account.
  if (!isCurrent()) return
  if (account) report({ account })
  if (!store || !account?.billing_available) {
    report({ offers: [] })
    return
  }
  try {
    await store.bind(account.app_user_id)
  } catch (error) {
    if (isCurrent()) report({ offers: [], error })
    return
  }
  if (!isCurrent()) return
  report({ boundFor: account.app_user_id })
  try {
    const offers = await store.loadOffers()
    if (!isCurrent()) return
    report({ offers })
    const managementUrl = await store.managementUrl().catch(() => null)
    if (isCurrent()) report({ managementUrl })
  } catch (error) {
    if (isCurrent()) report({ offers: [], error })
  }
}
