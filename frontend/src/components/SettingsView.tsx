import { useEffect, useId, useState, type ReactNode } from "react"
import { Link, useLocation } from "react-router-dom"

import type { AuthUser } from "../auth"
import { Analytics } from "../analytics"
import { APP_BUILD, APP_VERSION, CONTACT_URL, REVIEW_URL, SOCIAL_LINKS } from "../app-links"
import { lastBggSync, relativeSyncTime } from "../bgg-sync-time"
import type { FeedbackType } from "../feedback"
import { PRIVACY_POLICY_URL } from "../public-legal-links"
import { APP_PATHS } from "../routes"
import { rememberSettingsEntry, takeRememberedSettingsEntry } from "../settings-focus"
import { pickerDefaultsSummary } from "../settings-summary"
import { getThemePreference, setThemePreference, type ThemePreference } from "../theme"
import { tipCount, type PurchaseLayer } from "../tip-jar"
import { useTipLayer } from "../use-tip-layer"
import FeedbackSheet from "./FeedbackSheet"
import TipJarSheet from "./TipJarSheet"
import BggAttribution from "./ui/BggAttribution"
import PlayerAvatar from "./ui/PlayerAvatar"
import SettingsIcon, { type SettingsIconName, type SettingsTint } from "./ui/SettingsIcon"

type RowBase = { id: string; label: string; icon: SettingsIconName; tint: SettingsTint }
type InternalRow = RowBase & { to: string; value?: ReactNode; valueText?: string; labelNode?: ReactNode }
type ExternalRow = RowBase & { href: string; value?: string; opensIn?: string }
type ButtonRow = RowBase & { onClick: () => void; value?: ReactNode }

const THEME_OPTIONS: Array<{ value: ThemePreference; label: string }> = [
  { value: "dark", label: "Dark" },
  { value: "light", label: "Light" },
  { value: "system", label: "System" },
  { value: "black", label: "Black (experimental)" },
]

function SettingsGroup({ title, children }: { title: string; children: ReactNode }) {
  const headingId = `settings-${title.toLowerCase().replace(/[^a-z]+/g, "-")}`
  return <section className="settings-section" aria-labelledby={headingId}>
    <h2 id={headingId}>{title}</h2>
    <div className="settings-list">{children}</div>
  </section>
}

function Chevron() {
  return <span className="settings-row-chevron" aria-hidden="true" />
}

function ThemeRow() {
  const labelId = useId()
  const [theme, setTheme] = useState<ThemePreference>(getThemePreference)
  const current = THEME_OPTIONS.find((option) => option.value === theme) ?? THEME_OPTIONS[2]
  return <div className="settings-row settings-menu-row">
    <SettingsIcon name="moon" tint="neutral" />
    <span className="settings-row-body">
      <span className="settings-row-label" id={labelId}>Theme</span>
      <span className="settings-row-value" aria-hidden="true">{current.label.replace(" (experimental)", "")}</span>
      <svg className="settings-row-updown" aria-hidden="true" viewBox="0 0 10 14" fill="none" stroke="currentColor"
        strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M2 5l3-3 3 3M2 9l3 3 3-3" /></svg>
    </span>
    {/* The native menu covers the whole row, so a tap anywhere opens it. */}
    <select className="settings-row-select" aria-labelledby={labelId} value={theme} onChange={(event) => {
      const value = event.target.value as ThemePreference
      setThemePreference(value)
      setTheme(value)
      Analytics.track("settings_changed", { setting: "theme", value })
    }}>
      {THEME_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select>
  </div>
}

type Props = {
  user: AuthUser
  // Tests pass a stand-in (or null for "nothing to buy"); the app uses the RevenueCat layer for this account.
  purchases?: PurchaseLayer | null
}

function SettingsView({ user, purchases: injected }: Props) {
  const detected = useTipLayer(user.id)
  const purchases = injected === undefined ? detected : injected
  const location = useLocation()
  const [tips, setTips] = useState(tipCount)
  const [sheet, setSheet] = useState<"tips" | FeedbackType | null>(null)
  const [opener, setOpener] = useState<string | null>(null)
  const synced = lastBggSync()
  const isPro = user.tier === "PRO"

  useEffect(() => {
    const state = location.state as { focusEntry?: string } | null
    const focusEntry = takeRememberedSettingsEntry() ?? state?.focusEntry
    if (focusEntry) document.querySelector<HTMLElement>(`[data-settings-entry="${focusEntry}"]`)?.focus()
  }, [location.state])

  // WebKit doesn't focus a tapped button, so return focus to the row that
  // opened a sheet once the sheet has gone.
  useEffect(() => {
    if (sheet === null && opener) document.querySelector<HTMLElement>(`[data-settings-entry="${opener}"]`)?.focus()
  }, [sheet, opener])

  const openSheet = (id: "tips" | FeedbackType) => {
    setOpener(id)
    setSheet(id)
  }

  const remember = (id: string) => ({
    "data-settings-entry": id,
    onClick: () => rememberSettingsEntry(id, true),
  })

  const linkRow = (row: InternalRow) => <Link key={row.id} {...remember(row.id)} className="settings-row" to={row.to}
    aria-label={row.valueText ? `${row.label}, ${row.valueText}` : undefined}>
    <SettingsIcon name={row.icon} tint={row.tint} />
    <span className="settings-row-body">
      <span className="settings-row-label">{row.labelNode ?? row.label}</span>
      {row.value !== undefined && <span className="settings-row-value">{row.value}</span>}
      <Chevron />
    </span>
  </Link>

  const buttonRow = (row: ButtonRow) => <button key={row.id} type="button" className="settings-row"
    data-settings-entry={row.id} onClick={row.onClick}>
    <SettingsIcon name={row.icon} tint={row.tint} />
    <span className="settings-row-body">
      <span className="settings-row-label">{row.label}</span>
      {row.value !== undefined && <span className="settings-row-value">{row.value}</span>}
      <Chevron />
    </span>
  </button>

  const externalRow = (row: ExternalRow) => {
    const name = [row.label, row.value].filter(Boolean).join(", ")
    return <a key={row.id} className="settings-row" href={row.href}
      target="_blank" rel="noopener noreferrer" aria-label={`${name} (${row.opensIn ?? "opens outside ShelfPick"})`}>
      <SettingsIcon name={row.icon} tint={row.tint} />
      <span className="settings-row-body">
        <span className="settings-row-label">{row.label}</span>
        {row.value && <span className="settings-row-value">{row.value}</span>}
        <svg className="settings-row-external" aria-hidden="true" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7 17 17 7M9 7h8v8" /></svg>
      </span>
    </a>
  }

  const syncValue = user.bgg_username ? (synced ? `Synced ${relativeSyncTime(synced)}` : "Connected") : "Not set up"

  return <section className="screen settings-screen" aria-labelledby="settings-heading">
    <header className="settings-heading">
      <h1 id="settings-heading">Settings</h1>
    </header>

    <div className="settings-profile-card">
      <Link {...remember("profile")} className="settings-profile-link" to={APP_PATHS.settingsProfile}
        aria-label={`Account, plan and log out: ${user.player_name}${tips > 0 ? ", Supporter" : ""}`}>
        <PlayerAvatar name={user.player_name} variant={user.avatar_key} />
        <span className="settings-profile-copy">
          <span className="settings-profile-name">
            <span className="settings-row-label">{user.player_name}</span>
            {tips > 0 && <span className="settings-supporter">Supporter</span>}
          </span>
          <span className="settings-profile-subtitle">Account, plan and log out</span>
        </span>
        <Chevron />
      </Link>
      {isPro
        ? <span className="settings-plan-pill settings-plan-pro" role="img" aria-label="Plan: ShelfPick Pro">PRO</span>
        : <Link {...remember("pro")} className="settings-plan-pill" to={APP_PATHS.settingsPro}
          aria-label="Plan: Free. Compare plans">FREE</Link>}
    </div>

    {!isPro && <Link {...remember("upsell")} className="settings-upsell" to={APP_PATHS.settingsPro}>
      <SettingsIcon name="crown" tint="gold" />
      <span className="settings-profile-copy">
        <span className="settings-row-label">Unlock ShelfPick Pro</span>
        <span className="settings-profile-subtitle">See what Pro adds to your shelf</span>
      </span>
      <Chevron />
    </Link>}

    {isPro && <SettingsGroup title="ShelfPick Pro">
      {linkRow({ id: "pro-plan", label: "Your Pro plan", icon: "crown", tint: "gold", to: APP_PATHS.settingsPro, value: "Restore, manage" })}
    </SettingsGroup>}

    <SettingsGroup title="Appearance">
      <ThemeRow />
    </SettingsGroup>

    <SettingsGroup title="Players and picking">
      {linkRow({ id: "preferences", label: "Picker defaults", icon: "sliders", tint: "gold", to: APP_PATHS.settingsPreferences, value: pickerDefaultsSummary(user) })}
    </SettingsGroup>

    <SettingsGroup title="Collection">
      {linkRow({
        id: "collection-data", label: "BoardGameGeek sync", icon: "sync",
        // Break points inside the brand name for the largest text sizes.
        labelNode: <>Board<wbr />Game<wbr />Geek sync</>, tint: "green", to: APP_PATHS.settingsCollectionData,
        valueText: syncValue,
        value: <><span className={`settings-status-dot${user.bgg_username ? " is-on" : ""}`} aria-hidden="true" />{synced && user.bgg_username ? relativeSyncTime(synced) : syncValue}</>,
      })}
    </SettingsGroup>

    <SettingsGroup title="Data and backup">
      {linkRow({ id: "import", label: "Import plays", icon: "archive", tint: "blue", to: APP_PATHS.settingsImport, value: "BG Stats" })}
    </SettingsGroup>

    <SettingsGroup title="Support ShelfPick">
      {purchases && buttonRow({
        id: "tips", label: "Tip jar", icon: "heart", tint: "red", onClick: () => openSheet("tips"),
        value: tips > 0 ? `${tips} ${tips === 1 ? "tip" : "tips"}` : undefined,
      })}
      {externalRow({ id: "review", label: "Leave a review", icon: "star", tint: "gold", href: REVIEW_URL, opensIn: "opens the App Store" })}
    </SettingsGroup>

    <SettingsGroup title="Feedback">
      {buttonRow({ id: "feature", label: "Request a feature", icon: "bulb", tint: "gold", onClick: () => openSheet("feature") })}
      {buttonRow({ id: "problem", label: "Report a problem", icon: "bug", tint: "red", onClick: () => openSheet("problem") })}
      {linkRow({
        id: "whats-new", label: "What's new", icon: "sparkle", tint: "gold", to: APP_PATHS.settingsWhatsNew,
        valueText: `version ${APP_VERSION}`, value: <span className="settings-version-pill">{APP_VERSION}</span>,
      })}
    </SettingsGroup>

    <SettingsGroup title="Follow ShelfPick">
      {externalRow({ id: "website", label: "Website", icon: "globe", tint: "green", href: SOCIAL_LINKS.website.url, value: SOCIAL_LINKS.website.label })}
      {externalRow({ id: "youtube", label: "YouTube", icon: "play", tint: "red", href: SOCIAL_LINKS.youtube.url, value: SOCIAL_LINKS.youtube.label })}
    </SettingsGroup>

    <SettingsGroup title="About">
      {linkRow({ id: "help", label: "Help", icon: "help", tint: "blue", to: APP_PATHS.settingsHelp })}
      {externalRow({ id: "contact", label: "Contact", icon: "mail", tint: "blue", href: CONTACT_URL, value: "Email us", opensIn: "opens your email app" })}
      {externalRow({ id: "privacy", label: "Privacy policy", icon: "shield", tint: "neutral", href: PRIVACY_POLICY_URL })}
    </SettingsGroup>

    <footer className="settings-footer">
      <p>ShelfPick {APP_VERSION} ({APP_BUILD}) · Pluto Night Labs</p>
      <BggAttribution />
    </footer>

    {sheet === "tips" && purchases && <TipJarSheet layer={purchases} onTipped={setTips} onClose={() => setSheet(null)} />}
    {(sheet === "feature" || sheet === "problem") && <FeedbackSheet userId={user.id} initialType={sheet} onClose={() => setSheet(null)} />}
  </section>
}

export default SettingsView
