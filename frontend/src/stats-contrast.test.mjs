import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

import { contrastRatio, hexToRgb, rgbToHex } from "./cover-accent.ts"

// SP-STATS-01: chart marks, heatmap levels and chart text meet WCAG on the
// surfaces they sit on, in every theme. Values come from the CSS itself.
const tokens = await readFile(new URL("./styles/tokens.css", import.meta.url), "utf8")
const stats = await readFile(new URL("./styles/stats.css", import.meta.url), "utf8")

function block(selector) {
  const start = tokens.indexOf(`${selector} {`)
  assert.notEqual(start, -1, selector)
  const body = tokens.slice(start, tokens.indexOf("\n}", start))
  return Object.fromEntries([...body.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map(match => [match[1], match[2].trim()]))
}

const base = block(":root")
const themes = {
  light: base,
  dark: { ...base, ...block(':root[data-theme="dark"]') },
  black: { ...base, ...block(':root[data-theme="black"]') },
}

function mix(a, percent, b) {
  const [ra, rb] = [hexToRgb(a), hexToRgb(b)]
  return rgbToHex(ra.map((channel, index) => channel * (percent / 100) + rb[index] * (1 - percent / 100)))
}

function resolve(theme, value) {
  const variable = value.match(/^var\((--[\w-]+)\)$/)
  if (variable) return resolve(theme, theme[variable[1]])
  const colorMix = value.match(/^color-mix\(in srgb, (.+?) (\d+)%, (.+)\)$/)
  if (colorMix) return mix(resolve(theme, colorMix[1]), Number(colorMix[2]), resolve(theme, colorMix[3]))
  assert.match(value, /^#[0-9A-Fa-f]{6}$/, `unresolved ${value}`)
  return value
}

const heatLevels = Object.fromEntries(
  [...stats.matchAll(/--stats-heat-(\d):\s*([^;]+);/g)].map(match => [match[1], match[2].trim()]),
)

for (const [name, theme] of Object.entries(themes)) {
  const surface = resolve(theme, "var(--color-surface)")
  const raised = resolve(theme, "var(--color-surface-raised)")

  test(`${name}: chart marks and every heatmap level reach 3:1 on the card`, () => {
    assert.equal(Object.keys(heatLevels).length, 4)
    const mark = resolve(theme, "var(--color-brand-primary)")
    assert.ok(contrastRatio(mark, surface) >= 3, `bars ${contrastRatio(mark, surface).toFixed(2)}`)
    for (const [level, value] of Object.entries(heatLevels)) {
      const colour = resolve(theme, value)
      assert.ok(contrastRatio(colour, surface) >= 3, `${name} heat ${level} ${colour} ${contrastRatio(colour, surface).toFixed(2)}`)
    }
  })

  test(`${name}: heatmap levels are distinguishable from each other`, () => {
    const colours = Object.values(heatLevels).map(value => resolve(theme, value))
    assert.equal(new Set(colours).size, 4)
  })

  test(`${name}: chart text and stat text reach 4.5:1`, () => {
    const pairs = [
      ["axis labels", "var(--color-text-support)", surface],
      ["axis labels on raised", "var(--color-text-support)", raised],
      ["table text", "var(--color-text-primary)", surface],
      ["score numerals", "var(--color-accent-text)", surface],
      ["score numerals on raised", "var(--color-accent-text)", raised],
    ]
    for (const [label, foreground, background] of pairs) {
      const ratio = contrastRatio(resolve(theme, foreground), background)
      assert.ok(ratio >= 4.5, `${name} ${label} ${ratio.toFixed(2)}`)
    }
  })
}
