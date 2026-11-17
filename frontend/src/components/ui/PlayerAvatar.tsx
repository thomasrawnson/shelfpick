import type { AvatarId } from "../../avatar-catalog"

type Props = {
  name: string
  variant?: AvatarId
  className?: string
}

// Initials on a solid coloured circle. The colour comes from the avatar id.
function PlayerAvatar({ name, variant = "forest", className = "" }: Props) {
  const initials = name.trim().split(/\s+/).slice(0, 2)
    .map((part) => part[0]?.toLocaleUpperCase() ?? "").join("") || "?"

  return <span className={`player-avatar player-avatar-${variant} ${className}`}
    aria-hidden="true">
    <span className="player-avatar-initials">{initials}</span>
  </span>
}

export default PlayerAvatar
