import { useEffect, useRef } from "react"
import { Link, useLocation } from "react-router-dom"

import type { AuthUser } from "../auth"
import { APP_PATHS } from "../routes"
import { rememberSettingsEntry, takeRememberedSettingsEntry } from "../settings-focus"
import PlayerAvatar from "./ui/PlayerAvatar"

type SettingsEntry = { id: string; label: string; detail: string; to: string }

const groups: { title: string; entries: SettingsEntry[] }[] = [
  { title: "Your account", entries: [
    { id: "profile", label: "Profile", detail: "Name and avatar", to: APP_PATHS.settingsProfile },
    { id: "preferences", label: "Preferences", detail: "Usual players and play time", to: APP_PATHS.settingsPreferences },
  ] },
  { title: "Your ShelfPick", entries: [
    { id: "appearance", label: "Appearance", detail: "Theme", to: APP_PATHS.settingsAppearance },
    { id: "collection-data", label: "Collection & Data", detail: "BGG sync and play import", to: APP_PATHS.settingsCollectionData },
    { id: "plays", label: "Plays", detail: "View play history", to: APP_PATHS.settingsPlays },
    { id: "pro", label: "ShelfPick Pro", detail: "Compare plans", to: APP_PATHS.settingsPro },
  ] },
  { title: "Support", entries: [
    { id: "help", label: "Help", detail: "Using ShelfPick", to: APP_PATHS.settingsHelp },
    { id: "about", label: "About", detail: "App information", to: APP_PATHS.settingsAbout },
  ] },
]

function SettingsView({ user, onLogout }: { user: AuthUser; onLogout: () => void }) {
  const location = useLocation()
  const entryRefs = useRef<Record<string, HTMLAnchorElement | null>>({})

  useEffect(() => {
    const state = location.state as { focusEntry?: string } | null
    const rememberedEntry = takeRememberedSettingsEntry()
    const focusEntry = rememberedEntry ?? state?.focusEntry
    if (focusEntry) {
      entryRefs.current[focusEntry]?.focus()
    }
  }, [location.state])

  return <section className="screen settings-screen" aria-labelledby="settings-heading">
    <header className="settings-heading">
      <h1 id="settings-heading">Settings</h1>
    </header>

    {groups.map(({ title, entries }) => {
      const headingId = `settings-${title.toLowerCase().replace(/[^a-z]+/g, "-")}`
      return <section key={title} className="settings-section" aria-labelledby={headingId}>
        <h2 id={headingId}>{title}</h2>
        <div className="settings-list">
          {entries.map((entry) => <Link
            key={entry.id}
            ref={(node) => { entryRefs.current[entry.id] = node }}
            className="settings-row settings-row-link"
            to={entry.to}
            onClick={() => rememberSettingsEntry(entry.id, true)}
          >
            {entry.id === "profile" && <PlayerAvatar name={user.player_name} variant={user.avatar_key} />}
            <span className="settings-row-copy">
              <span className="settings-row-label">{entry.label}</span>
              <span className="settings-row-detail">{entry.id === "profile" ? user.player_name : entry.detail}</span>
            </span>
            <span className="settings-row-chevron" aria-hidden="true" />
          </Link>)}
        </div>
      </section>
    })}

    <button type="button" className="settings-logout" onClick={onLogout}>Log out</button>
  </section>
}

export default SettingsView
