import assert from "node:assert/strict"
import test from "node:test"

import {
  DARK_SURFACES, LIGHT_SURFACES, FALLBACK_PALETTE, accentTextColors, contrastRatio, dominantColor, fallbackAccent,
} from "./cover-accent.ts"

test("contrast ratio matches known values", () => {
  assert.equal(Math.round(contrastRatio("#000000", "#FFFFFF")), 21)
  assert.ok(Math.abs(contrastRatio("#777777", "#FFFFFF") - 4.48) < 0.05)
})

test("accent text meets AA on every light and dark surface for any hue", () => {
  const samples = [...FALLBACK_PALETTE, "#FFFF00", "#00FFFF", "#FF00FF", "#FFFFFF", "#000000", "#808080", "#C28B37", "#B7463C"]
  for (const hex of samples) {
    const { light, dark } = accentTextColors(hex)
    for (const surface of LIGHT_SURFACES) assert.ok(contrastRatio(light, surface) >= 4.5, `light ${hex}->${light} on ${surface}`)
    for (const surface of DARK_SURFACES) assert.ok(contrastRatio(dark, surface) >= 4.5, `dark ${hex}->${dark} on ${surface}`)
  }
})

test("fallback is deterministic and always from the palette", () => {
  assert.equal(fallbackAccent("Clockwork Market"), fallbackAccent("Clockwork Market"))
  assert.ok(FALLBACK_PALETTE.includes(fallbackAccent("Anything")))
})

test("dominant colour picks the saturated hue and ignores greys and white", () => {
  const px = []
  const add = (r, g, b, n) => { for (let i = 0; i < n; i += 1) px.push(r, g, b, 255) }
  add(255, 255, 255, 50)
  add(128, 128, 128, 50)
  add(30, 120, 200, 20)
  add(200, 40, 40, 5)
  const color = dominantColor(px)
  assert.ok(color)
  const [r, g, b] = [1, 3, 5].map(i => parseInt(color.slice(i, i + 2), 16))
  assert.ok(b > r && b > 150, `expected blue, got ${color}`)
  assert.equal(dominantColor([255, 255, 255, 255]), null)
})
