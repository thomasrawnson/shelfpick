import { useCallback, useEffect, useRef, useState } from "react"

import { getBillingAccount, getMe, syncBilling, type BillingAccount } from "../../api/client"
import type { AuthUser } from "../../auth"
import { PURCHASES_BUILD_MARKER, PURCHASES_ENABLED } from "../../purchases-flag"
import { loadPaywall } from "../../billing/paywall-load"
import { buyPlan, flowMessage, restorePurchases, type FlowResult } from "../../billing/purchase-flow"
import type { PlanOffer, ProStatus } from "../../billing/plans"
import { describeStoreError, proStore as defaultStore, type ProStore } from "../../billing/store"
import PaywallPanel, { type PaywallMessage } from "./PaywallPanel"

type Props = {
  user: AuthUser
  onUserChange: (user: AuthUser) => void
  store?: ProStore | null
}

function statusOf(user: AuthUser, account: BillingAccount | null): ProStatus {
  const pro = user.tier === "PRO"
  return {
    pro,
    source: pro ? account?.source ?? null : null,
    plan: pro ? account?.plan ?? null : null,
    expiresAt: pro ? account?.expires_at ?? null : null,
  }
}

function ProPurchase({ user, onUserChange, store = defaultStore }: Props) {
  const [account, setAccount] = useState<BillingAccount | null>(null)
  const [offers, setOffers] = useState<PlanOffer[] | null>(null)
  // The billing account the store is signed in as. Restore opens only when it is this account.
  const [boundFor, setBoundFor] = useState<string | null>(null)
  const [busy, setBusy] = useState<"restore" | PlanOffer["id"] | null>(null)
  const [message, setMessage] = useState<PaywallMessage | null>(null)
  const [managementUrl, setManagementUrl] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  // False once the signed-in account changes (the paywall is keyed by user in ProComparisonView) or it closes.
  const current = useRef(true)
  useEffect(() => {
    current.current = true
    return () => { current.current = false }
  }, [])

  useEffect(() => {
    let active = true
    void loadPaywall({
      store,
      getAccount: getBillingAccount,
      isCurrent: () => active && current.current,
      report: update => {
        if (update.account) setAccount(update.account)
        if (update.boundFor) setBoundFor(update.boundFor)
        if (update.offers) setOffers(update.offers)
        if (update.managementUrl !== undefined) setManagementUrl(update.managementUrl)
        if (update.error !== undefined) {
          setMessage({
            tone: "error",
            text: `Couldn’t load plans from the App Store. Check your connection and try again. (${describeStoreError(update.error)})`,
          })
        }
      },
    })
    return () => { active = false }
  }, [store, attempt])

  const refreshUser = useCallback(async () => {
    const latest = await getMe()
    if (!current.current) return
    onUserChange(latest)
    const latestAccount = await getBillingAccount()
    if (current.current) setAccount(latestAccount)
  }, [onUserChange])

  async function run(action: PlanOffer["id"] | "restore", flow: () => Promise<FlowResult>) {
    setBusy(action)
    setMessage(null)
    const result = await flow()
    if (!current.current) return
    setMessage(flowMessage(result))
    setBusy(null)
  }

  const storeAvailable = store !== null && (account?.billing_available ?? true)
  const restoreReady = account !== null && boundFor === account.app_user_id
  const deps = store && account
    ? { store, appUserId: account.app_user_id, isCurrent: () => current.current, syncBilling, refreshUser }
    : null

  return <PaywallPanel
    status={statusOf(user, account)}
    offers={store === null ? [] : offers}
    storeAvailable={storeAvailable}
    restoreReady={restoreReady}
    purchasesEnabled={PURCHASES_ENABLED}
    buildMarker={PURCHASES_BUILD_MARKER}
    busy={busy}
    message={message}
    managementUrl={managementUrl}
    onBuy={plan => { if (deps) void run(plan.id, () => buyPlan(deps, plan)) }}
    onRestore={() => { if (deps) void run("restore", () => restorePurchases(deps)) }}
    onReload={() => { setOffers(null); setMessage(null); setAttempt(value => value + 1) }}
  />
}

export default ProPurchase
