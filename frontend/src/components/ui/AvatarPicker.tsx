import { AVATAR_CATALOG, type AvatarId } from "../../avatar-catalog"
import PlayerAvatar from "./PlayerAvatar"

type Props = {
  name: string
  value: AvatarId
  onChange: (avatar: AvatarId) => void
  disabled?: boolean
  inputName?: string
}

function AvatarPicker({ name, value, onChange, disabled = false, inputName = "avatar" }: Props) {
  return <fieldset className="onboarding-fieldset avatar-picker-fieldset" disabled={disabled}>
    <legend>Avatar</legend>
    <div className="avatar-choice-grid">
      {AVATAR_CATALOG.map((choice) => {
        const selected = value === choice.id
        return <label key={choice.id}
          className={selected ? "avatar-choice selected" : "avatar-choice"}>
          <input className="sr-only" type="radio" name={inputName} value={choice.id}
            checked={selected} onChange={() => onChange(choice.id)} />
          <PlayerAvatar name={name || "You"} variant={choice.id} />
          <span className="avatar-choice-copy">
            <span className="avatar-choice-label">{choice.label}</span>
            <span className="sr-only"> — {choice.description}</span>
          </span>
          <span className="avatar-choice-check" aria-hidden="true">✓</span>
        </label>
      })}
    </div>
  </fieldset>
}

export default AvatarPicker
