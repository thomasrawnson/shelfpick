export type ThemePreference = "system" | "light" | "dark" | "black"

declare global {
  interface Window {
    shelfPickTheme?: {
      getPreference: () => ThemePreference
      setPreference: (value: ThemePreference) => void
    }
  }
}

export function getThemePreference(): ThemePreference {
  return window.shelfPickTheme?.getPreference() ?? "system"
}

export function setThemePreference(value: ThemePreference): void {
  window.shelfPickTheme?.setPreference(value)
}
