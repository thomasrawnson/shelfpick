import { useState } from "react"
import { saveProfile } from "../api/client"
import type { AuthUser } from "../auth"
import PlayerAvatar from "./ui/PlayerAvatar"

type Props = { user: AuthUser; onChange: (user: AuthUser) => void; mode?: "all" | "profile" | "preferences" }
const avatars = ["forest", "gold", "clay"] as const
const times = [30, 60, 90, 120, 0]

function ProfileSettings({ user, onChange, mode = "all" }: Props) {
  const [name, setName] = useState(user.player_name)
  const [avatar, setAvatar] = useState(user.avatar_key)
  const [players, setPlayers] = useState(user.preferred_player_count)
  const [time, setTime] = useState(user.preferred_play_time)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [saved, setSaved] = useState(false)

  async function save() {
    setSaving(true)
    setError("")
    setSaved(false)
    try {
      onChange(await saveProfile({
        player_name: name.trim(), avatar_key: avatar,
        preferred_player_count: players, preferred_play_time: time,
      }))
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
    {mode === "preferences" && <p className="settings-field-note">Picker and Game Night can still be changed each time.</p>}
    </>}
    <button type="button" className="primary-button" disabled={saving || !name.trim()}
      onClick={() => void save()}>{saving ? "Saving..." : mode === "preferences" ? "Save preferences" : "Save profile"}</button>
    {saved && <p className="setup-success" role="status">{mode === "preferences" ? "Preferences saved." : "Profile saved."}</p>}
    {error && <p className="error-message" role="alert">{error}</p>}
  </section>
}

export default ProfileSettings
