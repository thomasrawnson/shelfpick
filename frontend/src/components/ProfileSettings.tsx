import { useState } from "react"
import { saveProfile } from "../api/client"
import type { AuthUser } from "../auth"
import type { PickerPlayStyle } from "../api/client"
import PlayerAvatar from "./ui/PlayerAvatar"

type Props = { user: AuthUser; onChange: (user: AuthUser) => void; mode?: "all" | "profile" | "preferences" }
const avatars = ["forest", "gold", "clay"] as const
const times = [30, 60, 90, 120, 0]
const playStyles: Array<{ value: PickerPlayStyle; label: string }> = [
  { value: "any", label: "No preference" },
  { value: "cooperative", label: "Cooperative" },
  { value: "competitive", label: "Competitive" },
]

function savedPlayStyleOrFallback(value: AuthUser["preferred_play_style"]): PickerPlayStyle {
  return value === "cooperative" || value === "competitive" ? value : "any"
}

function ProfileSettings({ user, onChange, mode = "all" }: Props) {
  const [name, setName] = useState(user.player_name)
  const [avatar, setAvatar] = useState(user.avatar_key)
  const [players, setPlayers] = useState(user.preferred_player_count)
  const [time, setTime] = useState(user.preferred_play_time)
  const [playStyle, setPlayStyle] = useState<PickerPlayStyle>(() => savedPlayStyleOrFallback(user.preferred_play_style))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [saved, setSaved] = useState(false)

  async function save() {
    setSaving(true)
    setError("")
    setSaved(false)
    try {
      const changes = mode === "preferences"
        ? {
            preferred_player_count: players,
            preferred_play_time: time,
            preferred_play_style: playStyle,
          }
        : {
            player_name: name.trim(),
            avatar_key: avatar,
            ...(mode === "all" ? {
              preferred_player_count: players,
              preferred_play_time: time,
              preferred_play_style: playStyle,
            } : {}),
          }
      onChange(await saveProfile(changes))
      setSaved(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save profile.")
    } finally {
      setSaving(false)
    }
  }

  const showProfile = mode !== "preferences"
  const showPreferences = mode !== "profile"

  return <section className="setup-card profile-settings" aria-label={mode === "preferences" ? "Recommendation preferences" : "Profile details"}>
    {mode === "all" && <><h2>Profile</h2><p>Your name, avatar and usual choices. Pick and Game Night can still be changed each time.</p></>}
    {showProfile && <>
    <label className="setup-label" htmlFor="profile-name">Player name</label>
    <input id="profile-name" className="setup-input" value={name} maxLength={100}
      onChange={(event) => setName(event.target.value)} />
    <fieldset className="onboarding-fieldset">
      <legend>Avatar</legend>
      <div className="onboarding-avatars">
        {avatars.map((choice) => <button key={choice} type="button"
          className={avatar === choice ? "onboarding-avatar-choice selected" : "onboarding-avatar-choice"}
          aria-label={choice + " avatar"} aria-pressed={avatar === choice}
          onClick={() => setAvatar(choice)}>
          <PlayerAvatar name={name || user.email} variant={choice} />
        </button>)}
      </div>
    </fieldset>
    </>}
    {showPreferences && <>
    <p className="settings-field-note settings-preferences-intro">Used when a new Picker session starts. You can still change each choice for one session.</p>
    <fieldset className="onboarding-fieldset">
      <legend>Usual player count</legend>
      <div className="onboarding-choices">
        {[1, 2, 3, 4, 5, 6].map((count) => <button key={count} type="button"
          className={players === count ? "onboarding-choice selected" : "onboarding-choice"}
          aria-pressed={players === count} onClick={() => setPlayers(count)}>
          {count === 6 ? "6+" : count}
        </button>)}
        <button type="button" className={players === null ? "onboarding-choice selected" : "onboarding-choice"}
          aria-pressed={players === null} onClick={() => setPlayers(null)}>No default</button>
      </div>
    </fieldset>
    <fieldset className="onboarding-fieldset">
      <legend>Preferred play style</legend>
      <div className="onboarding-choices">
        {playStyles.map((choice) => <button key={choice.value} type="button"
          className={playStyle === choice.value ? "onboarding-choice selected" : "onboarding-choice"}
          aria-pressed={playStyle === choice.value} onClick={() => setPlayStyle(choice.value)}>
          {choice.label}
        </button>)}
      </div>
    </fieldset>
    <fieldset className="onboarding-fieldset">
      <legend>Usual play time</legend>
      <div className="onboarding-choices">
        {times.map((value) => <button key={value} type="button"
          className={time === value ? "onboarding-choice selected" : "onboarding-choice"}
          aria-pressed={time === value} onClick={() => setTime(value)}>
          {value === 0 ? "Any / varies" : value + "m"}
        </button>)}
        <button type="button" className={time === null ? "onboarding-choice selected" : "onboarding-choice"}
          aria-pressed={time === null} onClick={() => setTime(null)}>No default</button>
      </div>
    </fieldset>
    </>}
    <button type="button" className="primary-button" disabled={saving || !name.trim()}
      onClick={() => void save()}>{saving ? "Saving..." : mode === "preferences" ? "Save preferences" : "Save profile"}</button>
    {saved && <p className="setup-success" role="status">{mode === "preferences" ? "Preferences saved." : "Profile saved."}</p>}
    {error && <p className="error-message" role="alert">{error}</p>}
  </section>
}

export default ProfileSettings
