import { Link } from "react-router-dom"

import type { AuthUser } from "../auth"
import { APP_PATHS } from "../routes"
import { rememberSettingsEntry } from "../settings-focus"

type ComparisonFeature = { name: string; detail: string; free: boolean; pro: boolean }

const freeBenefits = [
  "Manage your Owned and Want to Play shelves",
  "Pick from your collection and log plays",
  "Browse Discover Hot and Top 100",
  "Plan a game night with the basic group picker",
]

const proBenefits = [
  "Get For You recommendations shaped by your shelf",
  "Use your play patterns and preferences to find a better fit",
  "Let guests vote from their phones on a Game Night shortlist",
]

const features: ComparisonFeature[] = [
  { name: "Collection", detail: "Owned and Want to Play", free: true, pro: true },
  { name: "Pick", detail: "Recommendations from your shelf", free: true, pro: true },
  { name: "Play tracking", detail: "Log and review your plays", free: true, pro: true },
  { name: "Discover", detail: "Hot and Top 100", free: true, pro: true },
  { name: "Game Night", detail: "Basic group picker", free: true, pro: true },
  { name: "Phone voting", detail: "Guest voting for Game Night", free: false, pro: true },
  { name: "For You", detail: "Personalised recommendations", free: false, pro: true },
]

function IncludedMark({ included }: { included: boolean }) {
  return <span className={included ? "pro-included" : "pro-not-included"}>
    <span aria-hidden="true">{included ? "✓" : "—"}</span>
    <span className="sr-only">{included ? "Included" : "Not included"}</span>
  </span>
}

function BenefitList({ items }: { items: string[] }) {
  return <ul className="pro-benefit-list">
    {items.map(item => <li key={item}>{item}</li>)}
  </ul>
}

function ProComparisonView({ user }: { user: AuthUser }) {
  const isPro = user.tier === "PRO"

  return <section className="screen pro-comparison-screen" aria-labelledby="pro-comparison-heading">
    <Link className="settings-back-link" to={APP_PATHS.settings} state={{ focusEntry: "pro" }}
      onClick={() => rememberSettingsEntry("pro")}>Back to Settings</Link>
    <header className="pro-comparison-heading">
      <h1 id="pro-comparison-heading">Free gives you the full shelf. Pro makes discovery personal.</h1>
      <p>ShelfPick is free to use. Pro will be a one-off payment when purchases become available.</p>
    </header>

    <div className="pro-plan-summary">
      <section className={`pro-plan-column${!isPro ? " current" : ""}`} aria-labelledby="free-plan-heading">
        <div className="pro-plan-title-row">
          <h2 id="free-plan-heading">Free</h2>
          {!isPro && <span className="pro-plan-state">Your plan</span>}
        </div>
        <p className="pro-plan-intro">Everything you need to manage your games and choose what to play.</p>
        <BenefitList items={freeBenefits} />
      </section>

      <section className={`pro-plan-column pro-plan-column-featured${isPro ? " current" : ""}`} aria-labelledby="pro-plan-heading">
        <div className="pro-plan-title-row">
          <h2 id="pro-plan-heading">Pro</h2>
          <span className="pro-plan-state">{isPro ? "Your plan" : "One-off unlock"}</span>
        </div>
        <p className="pro-plan-intro">Keep everything in Free, then add recommendations tuned to how you actually play.</p>
        <BenefitList items={proBenefits} />
        {isPro ? (
          <p className="pro-current-note">Pro is active on your account.</p>
        ) : (
          <div className="pro-unlock-pending">
            <button type="button" className="primary-button" disabled>Unlock ShelfPick Pro</button>
            <p>Purchases are not available yet. The one-off price will be shown before you pay.</p>
          </div>
        )}
      </section>
    </div>

    <section className="pro-comparison-details" aria-labelledby="comparison-details-heading">
      <div className="pro-section-heading">
        <h2 id="comparison-details-heading">What’s included today</h2>
        <p>Only features already available in ShelfPick are listed here.</p>
      </div>
      <div className="pro-matrix-wrap">
        <table className="pro-matrix">
          <caption className="sr-only">ShelfPick Free and Pro feature comparison</caption>
          <colgroup><col className="pro-matrix-feature-column" /><col /><col /></colgroup>
          <thead><tr>
            <th scope="col">Feature</th>
            <th scope="col" className={!isPro ? "current" : ""}>Free</th>
            <th scope="col" className={isPro ? "current" : ""}>Pro</th>
          </tr></thead>
          <tbody>
            {features.map(feature => <tr key={feature.name}>
              <th scope="row"><span>{feature.name}</span><small>{feature.detail}</small></th>
              <td className={!isPro ? "current" : ""}><IncludedMark included={feature.free} /></td>
              <td className={isPro ? "current" : ""}><IncludedMark included={feature.pro} /></td>
            </tr>)}
          </tbody>
        </table>
      </div>
    </section>
  </section>
}

export default ProComparisonView
