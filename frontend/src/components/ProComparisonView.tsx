import { Link } from "react-router-dom"

import type { AuthUser } from "../auth"
import { APP_PATHS } from "../routes"
import { rememberSettingsEntry } from "../settings-focus"
import BrandLogo from "./ui/BrandLogo"
import ProPurchase from "./pro/ProPurchase"

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
const guestAccess = { label: "No account needed", tone: "guest" } as const

const freeBenefits = [
  "Manage your Owned and Want to Play shelves",
  "Use the core Picker and keep personal rankings",
  "Log duration and location, then share branded play cards",
  "Plan a basic Game Night shortlist",
]

const proBenefits = [
  {
    title: "Deeper stats",
    summary: "Score records, head-to-head between two players, and filters by date, player, place and player count.",
    detail: "Trends, the heatmap, your H-index and your weekly streak stay free for everyone.",
  },
  {
    title: "Help my H-index",
    summary: "Let the Picker favour games that would raise your H-index, and see why in the result.",
    detail: "A small, bounded nudge. It never changes which games are eligible.",
  },
  {
    title: "Custom scoresheets",
    summary: "Build a scoresheet for any game, with categories per player and totals worked out for you.",
    detail: "Built-in scoresheets for popular games are free.",
  },
  {
    title: "More personal recommendations",
    summary: "For You suggests games shaped by how you collect, play and rank.",
    detail: "Personal-ranking influence in Picker applies to count-based sessions, not named-player groups.",
  },
  {
    title: "Live play timing",
    summary: "Start, pause and finish a play timer without leaving ShelfPick.",
    detail: "An in-app indicator brings you back to the timer. Lock-screen timers and notifications are not included.",
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
      { name: "Help my H-index", detail: "Picker favours games that raise it", free: proOnly, pro: included },
      { name: "Discover For You", detail: "Personalised recommendations", free: proOnly, pro: included },
    ],
  },
  {
    activity: "See your stats",
    features: [
      { name: "Trends and H-index", detail: "Plays per month, heatmap, streak", free: included, pro: included },
      { name: "Records and head-to-head", detail: "Per-game scores and two-player results", free: proOnly, pro: included },
      { name: "Stats filters", detail: "Date, player, location and player count", free: proOnly, pro: included },
    ],
  },
  {
    activity: "Record and share a play",
    features: [
      { name: "Manual play logging", detail: "Duration and optional location", free: included, pro: included },
      { name: "Branded play sharing", detail: "Private-by-default image export", free: included, pro: included },
      { name: "Built-in scoresheets", detail: "Category scoring for popular games", free: included, pro: included },
      { name: "Custom scoresheets", detail: "Build and edit your own", free: proOnly, pro: included },
      { name: "Live play timer", detail: "Timer controls and in-app indicator", free: proOnly, pro: included },
    ],
  },
  {
    activity: "Plan together",
    features: [
      { name: "Basic Game Night", detail: "Group shortlist and host selection", free: included, pro: included },
      { name: "Phone voting", detail: "Host a vote from guests’ phones", free: included, pro: included },
      {
        name: "Join a hosted vote",
        detail: "Guests join from a link, no account needed",
        free: guestAccess,
        pro: guestAccess,
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

function ProComparisonView({ user, onUserChange }: { user: AuthUser; onUserChange: (user: AuthUser) => void }) {
  const isPro = user.tier === "PRO"

  return <section className="screen pro-comparison-screen" aria-labelledby="pro-comparison-heading">
    <Link className="settings-back-link" to={APP_PATHS.settings} state={{ focusEntry: "pro" }}
      onClick={() => rememberSettingsEntry("pro")}>Back to Settings</Link>
    <header className="pro-comparison-heading">
      <BrandLogo className="pro-comparison-brand" />
      <p className="eyebrow">Free and Pro</p>
      <h1 id="pro-comparison-heading">Free covers the essentials. Pro makes ShelfPick more personal.</h1>
      <p>Your collection and everyday play stay free. Pro adds optional tools for stats, choosing and scoring.</p>
    </header>

    <ProPurchase user={user} onUserChange={onUserChange} />

    <section className="pro-value-section" aria-labelledby="pro-value-heading">
      <div className="pro-section-heading">
        <h2 id="pro-value-heading">What Pro adds</h2>
        <p>Five benefits available with Pro access.</p>
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
          {isPro && <span className="pro-plan-state">Your plan</span>}
        </div>
        <p className="pro-plan-intro">Keep everything in Free, then add the Pro benefits above.</p>
        {isPro && <p className="pro-current-note">Your Pro access is active.</p>}
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
