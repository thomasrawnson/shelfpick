import type { BillingAccount } from "../api/client"
import type { PlanOffer } from "./plans"
import type { ProStore } from "./store"

// What happens after the App Store sheet closes. The store only says a
// purchase happened; Pro turns on when the server confirms it with RevenueCat.

export type FlowResult =
  | { kind: "pro"; account: BillingAccount }
  | { kind: "cancelled" }
  | { kind: "pending" }
  | { kind: "unconfirmed" }
  | { kind: "nothing-to-restore" }
  | { kind: "error"; message: string }

export type FlowDeps = {
  store: ProStore
  syncBilling: () => Promise<BillingAccount>
  // Re-reads the signed-in user so the whole app sees the new plan.
  refreshUser: () => Promise<void>
  wait?: (ms: number) => Promise<void>
}

const CONFIRM_ATTEMPTS = 4
// Longer than the server's minimum gap between purchase checks (2 s), so every attempt really asks RevenueCat.
const CONFIRM_DELAY_MS = 2500

const pause = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))

function messageOf(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback
}

// RevenueCat can take a moment to reflect a purchase, so check a few times.
async function confirmWithServer(deps: FlowDeps): Promise<BillingAccount | null> {
  const wait = deps.wait ?? pause
  for (let attempt = 0; attempt < CONFIRM_ATTEMPTS; attempt += 1) {
    const account = await deps.syncBilling()
    if (account.pro) {
      await deps.refreshUser()
      return account
    }
    if (attempt < CONFIRM_ATTEMPTS - 1) await wait(CONFIRM_DELAY_MS)
  }
  return null
}

export async function buyPlan(deps: FlowDeps, plan: PlanOffer): Promise<FlowResult> {
  let outcome
  try {
    outcome = await deps.store.purchase(plan)
  } catch (error) {
    return { kind: "error", message: messageOf(error, "The App Store couldn’t complete the purchase. You haven’t been charged.") }
  }
  if (outcome === "cancelled") return { kind: "cancelled" }
  if (outcome === "pending") return { kind: "pending" }
  try {
    const account = await confirmWithServer(deps)
    return account ? { kind: "pro", account } : { kind: "unconfirmed" }
  } catch (error) {
    return { kind: "error", message: messageOf(error, "Your purchase went through but ShelfPick couldn’t confirm it. Try Restore purchases.") }
  }
}

export async function restorePurchases(deps: FlowDeps): Promise<FlowResult> {
  try {
    await deps.store.restore()
  } catch (error) {
    return { kind: "error", message: messageOf(error, "The App Store couldn’t restore your purchases. Try again.") }
  }
  try {
    const account = await confirmWithServer(deps)
    return account ? { kind: "pro", account } : { kind: "nothing-to-restore" }
  } catch (error) {
    return { kind: "error", message: messageOf(error, "Couldn’t confirm your purchases. Try again.") }
  }
}

export function flowMessage(result: FlowResult): { tone: "success" | "info" | "error"; text: string } | null {
  switch (result.kind) {
    case "pro": return { tone: "success", text: "Pro is active on your account. Thank you for supporting ShelfPick." }
    case "cancelled": return null
    case "pending": return { tone: "info", text: "Your purchase is waiting for approval. Pro turns on once it is approved." }
    case "unconfirmed": return { tone: "info", text: "Your purchase went through, but ShelfPick hasn’t confirmed it yet. Wait a moment, then choose Restore purchases." }
    case "nothing-to-restore": return { tone: "info", text: "No Pro purchase was found for this Apple Account." }
    case "error": return { tone: "error", text: result.message }
  }
}
