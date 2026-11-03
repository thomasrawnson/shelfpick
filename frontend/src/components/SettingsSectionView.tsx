import { useRef, useState, type FormEvent } from "react"
import { Link } from "react-router-dom"

import type { AuthUser } from "../auth"
import { APP_PATHS } from "../routes"
import { rememberSettingsEntry } from "../settings-focus"
import { getThemePreference, setThemePreference, type ThemePreference } from "../theme"
import ProfileSettings from "./ProfileSettings"
import SetupView from "./SetupView"
import { deleteAccount } from "../api/client"
import { clearToken } from "../auth"
import { LEGAL_DRAFTS_ENABLED } from "../legal-drafts"

type Section = "profile" | "preferences" | "appearance" | "collection-data" | "plays" | "help" | "about"
type Props = {
  section: Section
  user: AuthUser
  onUserChange: (user: AuthUser) => void
  onAccountDeleted?: () => void
}

const titles: Record<Section, string> = {
  profile: "Profile", preferences: "Preferences", appearance: "Appearance",
  "collection-data": "Collection & Data", plays: "Plays", help: "Help", about: "About",
}

function SettingsBackLink({ section }: { section: Section }) {
  return <Link className="settings-back-link" to={APP_PATHS.settings}
    state={{ focusEntry: section }} onClick={() => rememberSettingsEntry(section)}>Back to Settings</Link>
}

function AppearanceSettings() {
  const [theme, setTheme] = useState<ThemePreference>(getThemePreference)
  function chooseTheme(value: ThemePreference) {
    setThemePreference(value)
    setTheme(value)
  }
  const options: Array<{ value: ThemePreference; label: string }> = [
    { value: "system", label: "Use device setting" },
    { value: "light", label: "Light" },
    { value: "dark", label: "Dark" },
    { value: "black", label: "Black (experimental)" },
  ]
  return <fieldset className="settings-theme-list">
    <legend>Choose how ShelfPick looks on this device</legend>
    {options.map((option) => <label key={option.value} className="settings-theme-option">
      <span>{option.label}</span>
      <input type="radio" name="appearance" value={option.value} checked={theme === option.value} onChange={() => chooseTheme(option.value)} />
    </label>)}
  </fieldset>
}

function AccountDeletion({ onDeleted }: { onDeleted?: () => void }) {
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
    void deleteAccount(password).then(() => {
      clearToken()
      onDeleted?.()
    }).catch((failure) => {
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

function BggAttribution() {
  return <a className="bgg-attribution" href="https://boardgamegeek.com/" target="_blank" rel="noopener noreferrer">
    <img src="/branding/powered-by-bgg-rgb.svg" alt="Powered by BoardGameGeek" />
    <span className="sr-only"> (opens in a new tab)</span>
  </a>
}

function SettingsSectionView({ section, user, onUserChange, onAccountDeleted }: Props) {
  return <section className="screen settings-screen settings-detail-screen" aria-labelledby="settings-section-heading">
    <SettingsBackLink section={section} />
    <header className="settings-heading"><h1 id="settings-section-heading">{titles[section]}</h1></header>
    {section === "profile" && <><ProfileSettings user={user} onChange={onUserChange} mode="profile" /><AccountDeletion onDeleted={onAccountDeleted} /></>}
    {section === "preferences" && <ProfileSettings user={user} onChange={onUserChange} mode="preferences" />}
    {section === "appearance" && <AppearanceSettings />}
    {section === "collection-data" && <>
      <SetupView initialUsername={user.bgg_username} onUsernameChange={(username) => onUserChange({ ...user, bgg_username: username })} compact />
      <p className="settings-attribution">Collection information is imported from BoardGameGeek. BoardGameGeek is not affiliated with ShelfPick.</p>
      <BggAttribution />
    </>}
    {section === "plays" && <div className="settings-info-panel">
      <p>Review recorded plays, participants and game history in Insights.</p>
      <Link className="secondary-button settings-section-action" to={APP_PATHS.insights}>Open Insights</Link>
    </div>}
    {section === "help" && <div className="settings-info-panel">
      <h2>Using ShelfPick</h2>
      <p>Use Picker for a recommendation from your shelf, Collection to manage games, and Insights to review recorded plays.</p>
    </div>}
    {section === "about" && <div className="settings-info-panel">
      <h2>ShelfPick</h2>
      <p>A calm way to choose from your collection and keep track of what reaches the table.</p>
      <p className="settings-row-detail">Made by Pluto Night Labs</p>
      <BggAttribution />
      {LEGAL_DRAFTS_ENABLED && <nav className="settings-legal-links" aria-label="Draft legal documents">
        <Link to={APP_PATHS.privacyDraft}>Privacy Policy draft</Link>
        <Link to={APP_PATHS.termsDraft}>Terms of Use draft</Link>
      </nav>}
      <a className="secondary-button settings-section-action" href="https://plutonightlabs.com/"
        target="_blank" rel="noopener noreferrer">
        Pluto Night Labs<span className="sr-only"> (opens in a new tab)</span>
      </a>
    </div>}
  </section>
}

export default SettingsSectionView
