import { useCallback, useEffect, useState } from "react"

import { getBillingAccount, getMe, syncBilling, type BillingAccount } from "../../api/client"
import type { AuthUser } from "../../auth"
import { PUBLIC_LEGAL_LINKS_ENABLED } from "../../public-legal-links"
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
  const [busy, setBusy] = useState<"restore" | PlanOffer["id"] | null>(null)
  const [message, setMessage] = useState<PaywallMessage | null>(null)
  const [managementUrl, setManagementUrl] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let active = true
    async function load() {
      let current: BillingAccount | null = null
      try {
        current = await getBillingAccount()
        if (active) setAccount(current)
      } catch {
        // The plan still shows from the signed-in user; the store just won't load.
      }
      if (!store || !current?.billing_available) {
        if (active) setOffers([])
        return
      }
      try {
        const loaded = await store.prepare(current.app_user_id)
        if (active) setOffers(loaded)
        const url = await store.managementUrl().catch(() => null)
        if (active) setManagementUrl(url)
      } catch (error) {
        if (active) {
          setOffers([])
          setMessage({
            tone: "error",
            text: `Couldn’t load plans from the App Store. Check your connection and try again. (${describeStoreError(error)})`,
          })
        }
      }
    }
    void load()
    return () => { active = false }
  }, [store, attempt])

  const refreshUser = useCallback(async () => {
    onUserChange(await getMe())
    setAccount(await getBillingAccount())
  }, [onUserChange])

  async function run(action: PlanOffer["id"] | "restore", flow: () => Promise<FlowResult>) {
    setBusy(action)
    setMessage(null)
    const result = await flow()
    setMessage(flowMessage(result))
    setBusy(null)
  }

  const storeAvailable = store !== null && (account?.billing_available ?? true)
  const deps = store ? { store, syncBilling, refreshUser } : null

  return <PaywallPanel
    status={statusOf(user, account)}
    offers={store === null ? [] : offers}
    storeAvailable={storeAvailable}
    legalLinksEnabled={PUBLIC_LEGAL_LINKS_ENABLED}
    busy={busy}
    message={message}
    managementUrl={managementUrl}
    onBuy={plan => { if (deps) void run(plan.id, () => buyPlan(deps, plan)) }}
    onRestore={() => { if (deps) void run("restore", () => restorePurchases(deps)) }}
    onReload={() => { setOffers(null); setMessage(null); setAttempt(value => value + 1) }}
  />
}

export default ProPurchase
