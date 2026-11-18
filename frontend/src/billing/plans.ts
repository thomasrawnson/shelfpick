// Pro plans and the wording App Review requires beside a price.

export type PlanId = "lifetime" | "yearly"

export type PlanOffer = {
  id: PlanId
  // Localised price string from the App Store, e.g. "£9.99".
  price: string
  // Opaque handle the purchase layer needs to buy this plan.
  handle: unknown
}

export const PLAN_COPY: Record<PlanId, { name: string; period: string; renews: boolean; summary: string }> = {
  lifetime: {
    name: "Pro Lifetime",
    period: "one-time purchase",
    renews: false,
    summary: "Pay once and keep Pro on your account. No subscription.",
  },
  yearly: {
    name: "Pro Yearly",
    period: "per year, renews automatically",
    renews: true,
    summary: "Billed every year until you cancel. Cancel any time in your Apple Account.",
  },
}

export const SUBSCRIPTION_TERMS =
  "Pro Yearly is an auto-renewing subscription. Payment is charged to your Apple Account when you confirm the purchase. " +
  "It renews every year at the price shown unless you cancel at least 24 hours before the end of the current period, " +
  "and your account is charged for renewal within 24 hours before that period ends. " +
  "Manage or cancel it in Settings > Apple Account > Subscriptions. " +
  "Pro Lifetime is a one-time purchase and does not renew."

export const LAPSE_NOTE =
  "If Pro ends, nothing you made with it is deleted: your custom scoresheets, rankings and plays stay readable. " +
  "The Pro tools lock until you buy Pro again."

export const APPLE_SUBSCRIPTIONS_URL = "https://apps.apple.com/account/subscriptions"

export type ProStatus = {
  pro: boolean
  source: "purchase" | "grant" | null
  plan: string | null
  expiresAt: string | null
}

export function describeProStatus(status: ProStatus): { headline: string; detail: string } {
  if (!status.pro) return { headline: "You’re on Free", detail: "Free features stay available on your account." }
  if (status.source === "grant") return { headline: "Pro is active", detail: "Pro was added to your account by ShelfPick." }
  if (status.plan === "LIFETIME") return { headline: "Pro Lifetime is active", detail: "You own Pro. It never expires." }
  if (status.plan === "YEARLY" && status.expiresAt) {
    const date = new Date(status.expiresAt)
    const when = Number.isNaN(date.getTime())
      ? "the end of the current period"
      : date.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
    return { headline: "Pro Yearly is active", detail: `Current period ends on ${when}. Renews automatically unless cancelled.` }
  }
  return { headline: "Pro is active", detail: "All benefits below are available on your account." }
}
