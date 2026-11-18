import { PRIVACY_POLICY_URL, TERMS_URL } from "../../public-legal-links"
import {
  APPLE_SUBSCRIPTIONS_URL,
  LAPSE_NOTE,
  PLAN_COPY,
  SUBSCRIPTION_TERMS,
  describeProStatus,
  type PlanId,
  type PlanOffer,
  type ProStatus,
} from "../../billing/plans"

export type PaywallMessage = { tone: "success" | "info" | "error"; text: string }

export type PaywallProps = {
  status: ProStatus
  // null while the store's plans load.
  offers: PlanOffer[] | null
  // False where purchases can't happen (the PWA, or a build without a store).
  storeAvailable: boolean
  // Purchases open only once the public Privacy Policy and Terms links are
  // approved for this build (VITE_PUBLIC_LEGAL_LINKS_ENABLED), because App
  // Review requires both beside the price.
  legalLinksEnabled: boolean
  busy: "restore" | PlanId | null
  message: PaywallMessage | null
  managementUrl: string | null
  onBuy: (plan: PlanOffer) => void
  onRestore: () => void
  // Reloads the store's plans after a failed or empty load.
  onReload: () => void
}

const ORDER: PlanId[] = ["yearly", "lifetime"]

function PlanCard({ offer, busy, disabled, onBuy }: {
  offer: PlanOffer; busy: boolean; disabled: boolean; onBuy: (plan: PlanOffer) => void
}) {
  const copy = PLAN_COPY[offer.id]
  const headingId = `paywall-plan-${offer.id}`
  return <article className="paywall-plan" aria-labelledby={headingId}>
    <h3 id={headingId}>{copy.name}</h3>
    <p className="paywall-price">
      <strong>{offer.price}</strong> <span>{copy.period}</span>
    </p>
    <p className="paywall-plan-summary">{copy.summary}</p>
    <button type="button" className="primary-button" disabled={disabled}
      aria-describedby={headingId}
      onClick={() => onBuy(offer)}>
      {busy ? "Working…" : copy.renews ? `Subscribe, ${offer.price} a year` : `Buy for ${offer.price}`}
    </button>
  </article>
}

function PaywallPanel(props: PaywallProps) {
  const { status, offers, storeAvailable, legalLinksEnabled, busy, message, managementUrl, onBuy, onRestore, onReload } = props
  const purchasable = storeAvailable && legalLinksEnabled
  const shown = describeProStatus(status)
  const sortedOffers = offers ? [...offers].sort((a, b) => ORDER.indexOf(a.id) - ORDER.indexOf(b.id)) : []
  const idle = busy === null

  return <section className="paywall" aria-labelledby="paywall-heading">
    <h2 id="paywall-heading">{status.pro ? "Your plan" : "Get ShelfPick Pro"}</h2>

    <div className={`pro-account-state${status.pro ? " is-pro" : ""}`} role="status">
      <strong>{shown.headline}</strong>
      <span>{shown.detail}</span>
    </div>

    {message && <p className={`paywall-message paywall-message-${message.tone}`}
      role={message.tone === "error" ? "alert" : "status"}>{message.text}</p>}

    {!status.pro && purchasable && (offers === null
      ? <p className="paywall-loading" role="status">Loading plans from the App Store…</p>
      : sortedOffers.length === 0
        ? <div className="paywall-actions">
          {!message && <p className="paywall-message paywall-message-info" role="status">
            Pro isn’t available to buy right now. Please try again.</p>}
          <button type="button" className="secondary-button" disabled={!idle} onClick={onReload}>Try again</button>
        </div>
        : <div className="paywall-plans">
          {sortedOffers.map(offer => <PlanCard key={offer.id} offer={offer} busy={busy === offer.id}
            disabled={!idle} onBuy={onBuy} />)}
        </div>)}

    {!status.pro && !storeAvailable && (
      <p className="paywall-message paywall-message-info" role="note">
        Pro is bought in the ShelfPick iPhone app. If you already have Pro, it applies here when you sign in.</p>
    )}

    {!status.pro && storeAvailable && !legalLinksEnabled && (
      <p className="paywall-message paywall-message-info" role="note">
        Pro purchases aren’t open yet. Free features stay available.</p>
    )}

    {storeAvailable && <div className="paywall-actions">
      <button type="button" className="secondary-button" disabled={!idle} onClick={onRestore}>
        {busy === "restore" ? "Restoring…" : "Restore purchases"}
      </button>
      {status.pro && status.plan === "YEARLY" && (
        <a className="paywall-link" href={managementUrl ?? APPLE_SUBSCRIPTIONS_URL}
          target="_blank" rel="noopener noreferrer">Manage subscription</a>
      )}
    </div>}

    <div className="paywall-terms">
      <p>{SUBSCRIPTION_TERMS}</p>
      <p>{LAPSE_NOTE}</p>
      {legalLinksEnabled && <p className="paywall-legal-links">
        <a href={PRIVACY_POLICY_URL} target="_blank" rel="noopener noreferrer">Privacy Policy</a>
        <a href={TERMS_URL} target="_blank" rel="noopener noreferrer">Terms of Use</a>
      </p>}
    </div>
  </section>
}

export default PaywallPanel
