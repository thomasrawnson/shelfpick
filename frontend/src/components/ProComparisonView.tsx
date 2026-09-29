import { Link } from "react-router-dom"

import type { AuthUser } from "../auth"
import { APP_PATHS } from "../routes"
import { rememberSettingsEntry } from "../settings-focus"
import BrandLogo from "./ui/BrandLogo"

type AccessTone = "included" | "pro" | "unavailable" | "guest"
type ComparisonFeature = {
  name: string
  detail: string
  free: { label: string; tone: AccessTone }
  pro: { label: string; tone: AccessTone }
}
type FeatureGroup = { activity: string; features: ComparisonFeature[] }

const included = { label: "Included", tone: "included" } as const
const proOnly = { label: "Not included", tone: "pro" } as const

const freeBenefits = [
  "Manage your Owned and Want to Play shelves",
  "Use the core Picker and keep personal rankings",
  "Log duration and location, then share branded play cards",
  "Plan a basic Game Night shortlist",
]

const proBenefits = [
  {
    title: "More personal recommendations",
    summary: "Get suggestions shaped by how you collect, play and rank games.",
    detail: "For You uses available recommendation sources. Personal-ranking influence in Picker currently applies to count-based sessions, not named-player groups.",
  },
  {
    title: "Live play timing",
    summary: "Start, pause and finish a play timer without leaving ShelfPick.",
    detail: "An in-app indicator brings you back to the timer while you move around the app. Lock-screen timers and notifications are not included.",
  },
  {
    title: "Game Night voting from players’ phones",
    summary: "Open voting for your shortlist and let players join by QR code or link.",
    detail: "Creating the voting session needs Pro. Guests join in their browser without an account or Pro.",
  },
]

const featureGroups: FeatureGroup[] = [
  {
    activity: "Build your shelf",
    features: [
      { name: "Collection", detail: "Owned and Want to Play", free: included, pro: included },
      { name: "Personal rankings", detail: "Compare and rank your games", free: included, pro: included },
    ],
  },
  {
    activity: "Choose a game",
    features: [
      { name: "Core Picker", detail: "Recommendations from your shelf", free: included, pro: included },
      { name: "Picker ranking influence", detail: "Count-based sessions only", free: proOnly, pro: included },
      { name: "Discover Hot", detail: "Current popular games", free: included, pro: included },
      {
        name: "Discover Top 100",
        detail: "Free by policy; ranked source is currently blocked",
        free: { label: "Unavailable", tone: "unavailable" },
        pro: { label: "Unavailable", tone: "unavailable" },
      },
      { name: "Discover For You", detail: "Personalised recommendations", free: proOnly, pro: included },
    ],
  },
  {
    activity: "Record and share a play",
    features: [
      { name: "Manual play logging", detail: "Duration and optional location", free: included, pro: included },
      { name: "Branded play sharing", detail: "Private-by-default image export", free: included, pro: included },
      { name: "Live play timer", detail: "Timer controls and in-app indicator", free: proOnly, pro: included },
    ],
  },
  {
    activity: "Plan together",
    features: [
      { name: "Basic Game Night", detail: "Group shortlist and host selection", free: included, pro: included },
      { name: "Open phone voting", detail: "Host QR code and join link", free: proOnly, pro: included },
      {
        name: "Join a hosted vote",
        detail: "Guest browser access",
        free: { label: "No plan needed", tone: "guest" },
        pro: { label: "No plan needed", tone: "guest" },
      },
    ],
  },
]

function AccessMark({ label, tone }: { label: string; tone: AccessTone }) {
  const symbol = tone === "included" ? "✓" : tone === "unavailable" ? "!" : tone === "guest" ? "↗" : "—"
  return <span className={`pro-access-mark pro-access-${tone}`}>
    <span aria-hidden="true">{symbol}</span>
    <span>{label}</span>
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
      <BrandLogo className="pro-comparison-brand" />
      <p className="eyebrow">Free and Pro</p>
      <h1 id="pro-comparison-heading">Free covers the essentials. Pro makes ShelfPick more personal.</h1>
      <p>Your collection and everyday play stay free. Pro adds three optional upgrades for choosing, timing and deciding together.</p>
      <div className={`pro-account-state${isPro ? " is-pro" : ""}`} role="status">
        <strong>{isPro ? "Pro is active" : "You’re on Free"}</strong>
        <span>{isPro ? "All benefits below are available on your account." : "All Free features below are available on your account."}</span>
      </div>
    </header>

    <section className="pro-value-section" aria-labelledby="pro-value-heading">
      <div className="pro-section-heading">
        <h2 id="pro-value-heading">What Pro adds</h2>
        <p>Three benefits already implemented in ShelfPick.</p>
      </div>
      <div className="pro-value-grid">
        {proBenefits.map((benefit, index) => <article className="pro-value-card" key={benefit.title}>
          <span className="pro-value-number" aria-hidden="true">{index + 1}</span>
          <h3>{benefit.title}</h3>
          <p className="pro-value-summary">{benefit.summary}</p>
          <p className="pro-value-detail">{benefit.detail}</p>
        </article>)}
      </div>
    </section>

    <div className="pro-plan-summary">
      <section className={`pro-plan-column${!isPro ? " current" : ""}`} aria-labelledby="free-plan-heading">
        <div className="pro-plan-title-row">
          <h2 id="free-plan-heading">Free</h2>
          {!isPro && <span className="pro-plan-state">Your plan</span>}
        </div>
        <p className="pro-plan-intro">Everything you need to keep a shelf, choose a game and record what you played.</p>
        <BenefitList items={freeBenefits} />
      </section>

      <section className={`pro-plan-column pro-plan-column-featured${isPro ? " current" : ""}`} aria-labelledby="pro-plan-heading">
        <div className="pro-plan-title-row">
          <h2 id="pro-plan-heading">Pro</h2>
          <span className="pro-plan-state">{isPro ? "Your plan" : "One-off unlock"}</span>
        </div>
        <p className="pro-plan-intro">Keep everything in Free, then add all three Pro benefits above.</p>
        {isPro ? (
          <p className="pro-current-note">Your Pro access is active.</p>
        ) : (
          <div className="pro-unlock-pending" role="note">
            <strong>Purchases are not available yet.</strong>
            <p>Pro is planned as a one-off unlock, not a subscription. No price or Buy action is shown until checkout is configured and working.</p>
          </div>
        )}
      </section>
    </div>

    <section className="pro-comparison-details" aria-labelledby="comparison-details-heading">
      <div className="pro-section-heading">
        <h2 id="comparison-details-heading">Compare by activity</h2>
        <p>Available features and current limitations, grouped around what you want to do.</p>
      </div>
      <div className="pro-matrix-wrap">
        <table className="pro-matrix">
          <caption className="sr-only">ShelfPick Free and Pro feature comparison</caption>
          <colgroup><col className="pro-matrix-feature-column" /><col /><col /></colgroup>
          <thead><tr>
            <th scope="col">Activity</th>
            <th scope="col" className={!isPro ? "current" : ""}>Free</th>
            <th scope="col" className={isPro ? "current" : ""}>Pro</th>
          </tr></thead>
          {featureGroups.map(group => <tbody key={group.activity}>
            <tr className="pro-matrix-group"><th colSpan={3} scope="colgroup">{group.activity}</th></tr>
            {group.features.map(feature => <tr key={feature.name}>
              <th scope="row"><span>{feature.name}</span><small>{feature.detail}</small></th>
              <td className={!isPro ? "current" : ""}><AccessMark {...feature.free} /></td>
              <td className={isPro ? "current" : ""}><AccessMark {...feature.pro} /></td>
            </tr>)}
          </tbody>)}
        </table>
      </div>
    </section>
  </section>
}

export default ProComparisonView
