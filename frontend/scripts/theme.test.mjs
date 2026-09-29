import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"
import vm from "node:vm"

const source = await readFile(new URL("../public/theme.js", import.meta.url), "utf8")

function initialize(dark, stored = null, explicitTheme = null) {
  const values = new Map(stored ? [["shelfpick-theme", stored]] : [])
  const root = {
    dataset: explicitTheme ? { theme: explicitTheme } : {},
    hasAttribute: () => Boolean(explicitTheme),
  }
  const meta = [{ content: "" }, { content: "" }]
  let listener
  const preference = {
    matches: dark,
    addEventListener(event, callback) { assert.equal(event, "change"); listener = callback },
  }
  const window = {
    localStorage: {
      getItem: key => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
    },
    matchMedia: query => {
      assert.equal(query, "(prefers-color-scheme: dark)")
      return preference
    },
  }
  vm.runInNewContext(source, {
    document: { documentElement: root, querySelectorAll: () => meta.map(item => ({ setAttribute: (_, value) => { item.content = value } })) },
    window,
  })
  return { root, preference, listener, window, values, meta }
}

test("system theme follows OS preference and updates browser theme colour", () => {
  for (const dark of [false, true]) {
    const { root, preference, listener, window, meta } = initialize(dark)
    assert.equal(window.shelfPickTheme.getPreference(), "system")
    assert.equal(root.dataset.theme, dark ? "dark" : "light")
    assert.equal(meta[0].content, dark ? "#151816" : "#315C48")
    preference.matches = !dark
    listener()
    assert.equal(root.dataset.theme, dark ? "light" : "dark")
  }
})

test("explicit themes stay selected regardless of OS and persist across refresh", () => {
  for (const theme of ["light", "dark", "black"]) {
    const current = initialize(theme === "dark")
    current.window.shelfPickTheme.setPreference(theme)
    assert.equal(current.root.dataset.theme, theme)
    current.preference.matches = theme !== "dark"
    current.listener()
    assert.equal(current.root.dataset.theme, theme)
    assert.equal(current.values.get("shelfpick-theme"), theme)
    const refreshed = initialize(theme !== "dark", current.values.get("shelfpick-theme"))
    assert.equal(refreshed.root.dataset.theme, theme)
    assert.equal(refreshed.meta[0].content, theme === "black" ? "#000000" : theme === "dark" ? "#151816" : "#315C48")
    refreshed.window.shelfPickTheme.setPreference("system")
    assert.equal(refreshed.root.dataset.theme, refreshed.preference.matches ? "dark" : "light")
  }
})

test("invalid stored preference falls back to system", () => {
  const { root, window } = initialize(true, "unknown")
  assert.equal(window.shelfPickTheme.getPreference(), "system")
  assert.equal(root.dataset.theme, "dark")
})

test("explicit host theme is preserved", () => {
  for (const theme of ["light", "dark", "black"]) {
    const { root, listener } = initialize(theme === "light", null, theme)
    assert.equal(root.dataset.theme, theme)
    assert.equal(listener, undefined)
  }
})
