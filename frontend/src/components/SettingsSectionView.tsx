import { useState } from "react"
import { Link } from "react-router-dom"

import type { AuthUser } from "../auth"
import { APP_PATHS } from "../routes"
import { rememberSettingsEntry } from "../settings-focus"
import { getThemePreference, setThemePreference, type ThemePreference } from "../theme"
import ProfileSettings from "./ProfileSettings"
import SetupView from "./SetupView"

type Section = "profile" | "preferences" | "appearance" | "collection-data" | "plays" | "help" | "about"
type Props = { section: Section; user: AuthUser; onUserChange: (user: AuthUser) => void }

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
  return <fieldset className="settings-theme-list">
    <legend>Choose how ShelfPick looks on this device</legend>
    {(["system", "light", "dark"] as const).map((value) => <label key={value} className="settings-theme-option">
      <span>{value === "system" ? "Use device setting" : value === "light" ? "Light" : "Dark"}</span>
      <input type="radio" name="appearance" value={value} checked={theme === value} onChange={() => chooseTheme(value)} />
    </label>)}
  </fieldset>
}

function SettingsSectionView({ section, user, onUserChange }: Props) {
  return <section className="screen settings-screen settings-detail-screen" aria-labelledby="settings-section-heading">
    <SettingsBackLink section={section} />
    <header className="settings-heading"><h1 id="settings-section-heading">{titles[section]}</h1></header>
    {section === "profile" && <ProfileSettings user={user} onChange={onUserChange} mode="profile" />}
    {section === "preferences" && <ProfileSettings user={user} onChange={onUserChange} mode="preferences" />}
    {section === "appearance" && <AppearanceSettings />}
    {section === "collection-data" && <>
      <SetupView initialUsername={user.bgg_username} onUsernameChange={(username) => onUserChange({ ...user, bgg_username: username })} compact />
      <p className="settings-attribution">Collection information is imported from BoardGameGeek. BoardGameGeek is not affiliated with ShelfPick.</p>
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
    </div>}
  </section>
}

export default SettingsSectionView
