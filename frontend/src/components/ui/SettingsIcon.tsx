// Stroke icons on a 24px grid, shown in 28pt tinted tiles in Settings.
const ICON_PATHS = {
  sliders: "M4 7h10M18 7h2M4 17h4M12 17h8M16 5v4M10 15v4",
  moon: "M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z",
  sync: "M20 11a8 8 0 0 0-14.3-4.9L4 8M4 4v4h4M4 13a8 8 0 0 0 14.3 4.9L20 16M20 20v-4h-4",
  archive: "M4 7h16v3H4zM5 10v9h14v-9M10 14h4",
  dice: "M6 4h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2ZM9 9h.01M15 15h.01M12 12h.01",
  globe: "M12 3a9 9 0 1 0 0 18a9 9 0 0 0 0-18ZM3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3Z",
  play: "M4 7.5c0-1.4 1-2.5 2.4-2.6C8 4.8 10 4.7 12 4.7s4 .1 5.6.2c1.4.1 2.4 1.2 2.4 2.6v9c0 1.4-1 2.5-2.4 2.6-1.6.1-3.6.2-5.6.2s-4-.1-5.6-.2C5 19 4 17.9 4 16.5ZM10 9v6l5-3Z",
  sparkle: "M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8ZM18 16l.7 1.8 1.8.7-1.8.7L18 21l-.7-1.8-1.8-.7 1.8-.7Z",
  help: "M12 21a9 9 0 1 0 0-18a9 9 0 0 0 0 18ZM9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.4M12 17h.01",
  crown: "M4 8l4 4 4-7 4 7 4-4-2 11H6Z",
  heart: "M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z",
  star: "M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9Z",
  bulb: "M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3Z",
  bug: "M8 9h8v5a4 4 0 0 1-8 0ZM9 9V7a3 3 0 0 1 6 0v2M4 12h4M16 12h4M5 18l3-2M19 18l-3-2M5 6l3 2M19 6l-3 2",
  mail: "M4 6h16v12H4zM4 7l8 6 8-6",
  shield: "M12 3l7 3v5c0 4.5-3 8.3-7 10-4-1.7-7-5.5-7-10V6Z",
  coffee: "M5 9h11v5a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5ZM16 10h1.5a2.5 2.5 0 0 1 0 5H16M8 3v3M11 3v3",
  pint: "M6 4h12l-1.5 16h-9ZM6.4 8h11.2",
} as const

export type SettingsIconName = keyof typeof ICON_PATHS
export type SettingsTint = "gold" | "green" | "blue" | "red" | "neutral"

function SettingsIcon({ name, tint }: { name: SettingsIconName; tint: SettingsTint }) {
  return <span className={`settings-icon settings-icon-${tint}`} aria-hidden="true">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={ICON_PATHS[name]} /></svg>
  </span>
}

export default SettingsIcon
