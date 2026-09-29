// Run before React and styles paint. Explicit data-theme remains a host/preview override.
(() => {
  const root = document.documentElement
  if (root.hasAttribute("data-theme")) return
  const key = "shelfpick-theme"
  const preference = window.matchMedia("(prefers-color-scheme: dark)")
  const valid = value => value === "system" || value === "light" || value === "dark" || value === "black"
  let choice = "system"
  try {
    const stored = window.localStorage.getItem(key)
    if (valid(stored)) choice = stored
  } catch { /* Storage can be unavailable in private or restricted contexts. */ }

  const applyTheme = () => {
    const theme = choice === "system" ? (preference.matches ? "dark" : "light") : choice
    root.dataset.theme = theme
    const browserColor = theme === "black" ? "#000000" : theme === "dark" ? "#151816" : "#315C48"
    document.querySelectorAll('meta[name="theme-color"]').forEach(meta => {
      meta.setAttribute("content", browserColor)
    })
  }

  window.shelfPickTheme = {
    getPreference: () => choice,
    setPreference: value => {
      if (!valid(value)) return
      choice = value
      try { window.localStorage.setItem(key, value) } catch { /* Keep the current session usable. */ }
      applyTheme()
    },
  }
  applyTheme()
  preference.addEventListener("change", () => {
    if (choice === "system") applyTheme()
  })
})()
