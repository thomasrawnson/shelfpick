import type { AvatarId, AvatarMotif } from "../../avatar-catalog"

type Props = {
  name: string
  variant?: AvatarId
  className?: string
}

function AvatarMotifIcon({ motif }: { motif: AvatarMotif }) {
  if (motif === "forest") return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 5 13h4l-2 4h10l-2-4h4L12 3Z" /><path d="M12 17v4" /></svg>
  if (motif === "gold") return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 2.4 6.6L21 12l-6.6 2.4L12 21l-2.4-6.6L3 12l6.6-2.4L12 3Z" /></svg>
  if (motif === "clay") return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="5" width="14" height="14" rx="2" /><path d="M5 12h14M12 5v14" /></svg>
  if (motif === "dice") return <svg viewBox="0 0 24 24" aria-hidden="true">
    <rect x="4.5" y="4.5" width="15" height="15" rx="3" />
    <circle cx="9" cy="9" r="1.25" /><circle cx="15" cy="15" r="1.25" />
    <circle cx="15" cy="9" r="1.25" /><circle cx="9" cy="15" r="1.25" />
  </svg>
  if (motif === "meeple") return <svg viewBox="0 0 24 24" aria-hidden="true">
    <circle cx="12" cy="6.5" r="3" />
    <path d="M9.5 9.2 4.8 12l2 3.2 2.3-1.4-.9 5.7h7.6l-.9-5.7 2.3 1.4 2-3.2-4.7-2.8Z" />
  </svg>
  if (motif === "cards") return <svg viewBox="0 0 24 24" aria-hidden="true">
    <rect x="5" y="5" width="10" height="14" rx="2" transform="rotate(-8 10 12)" />
    <rect x="9" y="5" width="10" height="14" rx="2" transform="rotate(8 14 12)" />
  </svg>
  return null
}

function PlayerAvatar({ name, variant = "forest", className = "" }: Props) {
  const initials = name.trim().split(/\s+/).slice(0, 2)
    .map((part) => part[0]?.toLocaleUpperCase() ?? "").join("") || "?"
  const motif: AvatarMotif = variant

  return <span className={`player-avatar player-avatar-${variant} ${className}`}
    aria-hidden="true">
    {motif && <span className={`player-avatar-motif player-avatar-motif-${motif}`}>
      <AvatarMotifIcon motif={motif} />
    </span>}
    <span className="player-avatar-initials">{initials}</span>
  </span>
}

export default PlayerAvatar
