import { useRef, useState, type FormEvent } from "react"
import { Link } from "react-router-dom"

import type { AuthUser } from "../auth"
import { APP_PATHS } from "../routes"
import { rememberSettingsEntry } from "../settings-focus"
import { Analytics } from "../analytics"
import ProfileSettings from "./ProfileSettings"
import SetupView from "./SetupView"
import BggAttribution from "./ui/BggAttribution"
import { deleteAccount } from "../api/client"
import { APP_VERSION, SOCIAL_LINKS } from "../app-links"
import { LEGAL_DRAFTS_ENABLED } from "../legal-drafts"
import { PRIVACY_POLICY_URL, TERMS_URL, SUPPORT_EMAIL_URL } from "../public-legal-links"
import { deleteAccountAndClearSession } from "../account-deletion-session"

type Section = "profile" | "preferences" | "collection-data" | "import" | "whats-new" | "help"
type Props = {
  section: Section
  user: AuthUser
  onUserChange: (user: AuthUser) => void
  onAccountDeleted?: () => void
  onLogout?: () => Promise<void>
  onLogoutAll?: () => Promise<void>
}

const titles: Record<Section, string> = {
  profile: "Profile", preferences: "Picker defaults",
  "collection-data": "BoardGameGeek sync", import: "Import plays",
  "whats-new": "What's new", help: "Help",
}

function PlanPanel({ user }: { user: AuthUser }) {
  const isPro = user.tier === "PRO"
  return <div className="settings-info-panel settings-plan-panel">
    <h2>Plan</h2>
    <p>{isPro ? "ShelfPick Pro" : "ShelfPick Free"}</p>
    {!isPro && <Link className="secondary-button settings-section-action" to={APP_PATHS.settingsPro}>Compare plans</Link>}
  </div>
}

function SessionActions({ onLogout, onLogoutAll }: { onLogout: () => Promise<void>; onLogoutAll?: () => Promise<void> }) {
  const [error, setError] = useState("")
  const [loggingOutAll, setLoggingOutAll] = useState(false)
  return <div className="settings-session-actions">
    <button type="button" className="settings-logout" onClick={() => {
      setError("")
      void onLogout().catch((failure) => setError(failure instanceof Error ? failure.message : "Couldn't log out."))
    }}>Log out</button>
    {onLogoutAll && <button type="button" className="settings-logout" disabled={loggingOutAll} onClick={() => {
      setLoggingOutAll(true); setError("")
      void onLogoutAll().catch((failure) => {
        setError(failure instanceof Error ? failure.message : "Couldn't log out all sessions.")
        setLoggingOutAll(false)
      })
    }}>{loggingOutAll ? "Logging out…" : "Log out all devices"}</button>}
    {error && <p className="error-message" role="alert">{error}</p>}
  </div>
}

function SettingsBackLink({ section }: { section: Section }) {
  return <Link className="settings-back-link" to={APP_PATHS.settings}
    state={{ focusEntry: section }} onClick={() => rememberSettingsEntry(section)}>Back to Settings</Link>
}

function AnalyticsSetting() {
  const [enabled, setEnabled] = useState(Analytics.isEnabled)
  return <label className="settings-confirmation">
    <input type="checkbox" checked={enabled} onChange={(event) => {
      Analytics.setEnabled(event.target.checked)
      setEnabled(event.target.checked)
    }} />
    <span>Share anonymous usage analytics</span>
  </label>
}

export function AccountDeletion({ onDeleted }: { onDeleted?: () => void }) {
  const [password, setPassword] = useState("")
  const [confirmed, setConfirmed] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")
  const pending = useRef(false)

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending.current || !password || !confirmed) return
    pending.current = true
    setSubmitting(true)
    setError("")
    void deleteAccountAndClearSession(password, deleteAccount, onDeleted).catch((failure) => {
      pending.current = false
      setError(failure instanceof Error ? failure.message : "Couldn't delete account.")
      setSubmitting(false)
    })
  }

  return <form className="settings-info-panel account-deletion-panel" onSubmit={submit} aria-busy={submitting}>
    <h2>Delete account</h2>
    <p>This permanently removes your ShelfPick account, collection, wishlist, plays, players, preferences, rankings, timers, Picker history and hosted Game Night voting data. Shared game catalogue records remain.</p>
    <label htmlFor="delete-account-password">Confirm your password</label>
    <input id="delete-account-password" type="password" autoComplete="current-password" value={password} maxLength={128} required
      onChange={(event) => { setPassword(event.target.value); setError("") }} disabled={submitting} />
    <label className="settings-confirmation">
      <input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} disabled={submitting} />
      <span>I understand this cannot be undone.</span>
    </label>
    <button type="submit" className="settings-danger-button" disabled={!password || !confirmed || submitting}>
      {submitting ? "Deleting…" : "Delete my account"}
    </button>
    {error && <p className="error-message" role="alert">{error}</p>}
  </form>
}

function SettingsSectionView({ section, user, onUserChange, onAccountDeleted, onLogout, onLogoutAll }: Props) {
  return <section className="screen settings-screen settings-detail-screen" aria-labelledby="settings-section-heading">
    <SettingsBackLink section={section} />
    <header className="settings-heading"><h1 id="settings-section-heading">{titles[section]}</h1></header>
    {section === "profile" && <>
      <ProfileSettings user={user} onChange={onUserChange} mode="profile" />
      <PlanPanel user={user} />
      <AccountDeletion onDeleted={onAccountDeleted} />
      {onLogout && <SessionActions onLogout={onLogout} onLogoutAll={onLogoutAll} />}
    </>}
    {section === "preferences" && <ProfileSettings user={user} onChange={onUserChange} mode="preferences" />}
    {section === "collection-data" && <>
      <SetupView initialUsername={user.bgg_username} onUsernameChange={(username) => onUserChange({ ...user, bgg_username: username })} compact part="sync" />
      <p className="settings-attribution">Collection information is imported from BoardGameGeek. BoardGameGeek is not affiliated with ShelfPick.</p>
      <BggAttribution />
    </>}
    {section === "import" && <>
      <SetupView compact part="import" />
      <p className="settings-attribution">Your collection, plays and players are stored in your ShelfPick account, so they come back when you sign in on another device.</p>
    </>}
    {section === "whats-new" && <div className="settings-info-panel">
      <h2>Version {APP_VERSION}</h2>
      <ul className="settings-whats-new">
        <li>ShelfPick Pro, an optional upgrade (Yearly or Lifetime): deeper statistics, custom scoresheets, For You suggestions and the live game timer. Everything that was free stays free.</li>
        <li>Stats has new Trends, records and head-to-head views.</li>
        <li>Monthly and yearly recaps, with a cover collage you can share.</li>
        <li>Tonight puts Find a game and Start a group vote front and centre.</li>
      </ul>
    </div>}
    {section === "help" && <div className="settings-info-panel">
      <h2>Using ShelfPick</h2>
      <p>Use Tonight to find a game, Shelf to manage your games, Plays to log what you played, and Stats to look back.</p>
      <a className="secondary-button settings-section-action" href={SUPPORT_EMAIL_URL}>Contact support</a>
    </div>}
    {section === "help" && <div className="settings-info-panel">
      <h2>About ShelfPick</h2>
      <p>A calm way to choose from your collection and keep track of what reaches the table.</p>
      <p className="settings-row-detail">Version {APP_VERSION} · Made by Pluto Night Labs</p>
      <AnalyticsSetting />
      <p className="settings-row-detail">Off unless you choose to share. Anonymous counts of which features are used help improve ShelfPick. No account details, search text or notes are included. Turning this off stops anything more being sent.</p>
      <BggAttribution />
      {LEGAL_DRAFTS_ENABLED && <nav className="settings-legal-links" aria-label="Draft legal documents">
        <Link to={APP_PATHS.privacyDraft}>Privacy Policy draft</Link>
        <Link to={APP_PATHS.termsDraft}>Terms of Use draft</Link>
      </nav>}
      <nav className="settings-legal-links" aria-label="Legal information">
        <a href={PRIVACY_POLICY_URL} target="_blank" rel="noopener noreferrer">Privacy Policy<span className="sr-only"> (opens in a new tab)</span></a>
        <a href={TERMS_URL} target="_blank" rel="noopener noreferrer">Terms of Use<span className="sr-only"> (opens in a new tab)</span></a>
      </nav>
      <a className="secondary-button settings-section-action" href={SOCIAL_LINKS.website.url}
        target="_blank" rel="noopener noreferrer">
        Pluto Night Labs<span className="sr-only"> (opens in a new tab)</span>
      </a>
    </div>}
  </section>
}

export default SettingsSectionView
