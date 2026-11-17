import { lightImpact } from "../haptics"

export type AppView =
  | "tonight"
  | "shelf"
  | "plays"
  | "discover"
  | "stats"
  | "setup"

type Props = {
  view: AppView
  onChangeView: (view: AppView) => void
}

type NavIconName =
  | "tonight"
  | "shelf"
  | "plays"
  | "discover"
  | "stats"

function NavIcon({
  name,
}: {
  name: NavIconName
}) {
  if (name === "tonight") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M19 14.5A7.5 7.5 0 0 1 9.5 5a7.5 7.5 0 1 0 9.5 9.5Z" />
      </svg>
    )
  }

  if (name === "plays") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="4" y="4" width="16" height="16" rx="4" />
        <circle cx="9" cy="9" r="1" />
        <circle cx="15" cy="9" r="1" />
        <circle cx="12" cy="12" r="1" />
        <circle cx="9" cy="15" r="1" />
        <circle cx="15" cy="15" r="1" />
      </svg>
    )
  }

  if (name === "shelf") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M5 6.5h14v12H5z" />
        <path d="M8 6.5v12M16 6.5v12" />
      </svg>
    )
  }

  if (name === "discover") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 5.5a6.5 6.5 0 1 1 0 13a6.5 6.5 0 0 1 0-13Z" />
        <path d="m15.5 8.5-2.2 4.8-4.8 2.2 2.2-4.8 4.8-2.2Z" />
      </svg>
    )
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 19V11M10 19V7M15 19v-5M20 19V4" />
    </svg>
  )
}

const items: {
  view: Exclude<AppView, "setup">
  label: string
  icon: NavIconName
}[] = [
  { view: "tonight", label: "Tonight", icon: "tonight" },
  { view: "shelf", label: "Shelf", icon: "shelf" },
  { view: "plays", label: "Plays", icon: "plays" },
  { view: "discover", label: "Discover", icon: "discover" },
  { view: "stats", label: "Stats", icon: "stats" },
]

function AppNavigation({
  view,
  onChangeView,
}: Props) {
  return (
    <nav className="app-nav" aria-label="Primary">
      {items.map((item) => (
        <button
          type="button"
          key={item.view}
          className={
            view === item.view
              ? "nav-button active"
              : "nav-button"
          }
          aria-current={
            view === item.view
              ? "page"
              : undefined
          }
          onClick={() => {
            if (view !== item.view) void lightImpact()
            onChangeView(item.view)
          }}
        >
          <span className="nav-icon">
            <NavIcon name={item.icon} />
          </span>
          <span className="nav-label">
            {item.label}
          </span>
        </button>
      ))}
    </nav>
  )
}

export default AppNavigation
