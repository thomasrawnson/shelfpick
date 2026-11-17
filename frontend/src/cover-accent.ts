// Cover-derived accent colour. Sampled from the cover when the browser lets us read
// it (CORS); otherwise a deterministic palette colour from the game name. Accent
// TEXT colours are adjusted until they meet WCAG AA (4.5:1) on the surfaces they sit on.

export type Rgb = [number, number, number]

// Backgrounds the accent text can sit on: the lowest-contrast surface per theme.
export const LIGHT_SURFACES = ["#EEEAE0", "#FFFFFF", "#F6F3EB"]
export const DARK_SURFACES = ["#29302B", "#202521", "#151816", "#151A17"]

export const FALLBACK_PALETTE = [
  "#315C48", "#B7463C", "#356A7A", "#6B4E9B", "#A66D16", "#3F7655", "#2F4858", "#8A4F7D",
]

export function hexToRgb(hex: string): Rgb {
  const value = hex.replace("#", "")
  return [0, 2, 4].map(index => parseInt(value.slice(index, index + 2), 16)) as Rgb
}

export function rgbToHex([r, g, b]: Rgb): string {
  return `#${[r, g, b].map(channel => Math.round(Math.min(255, Math.max(0, channel))).toString(16).padStart(2, "0")).join("").toUpperCase()}`
}

function channel(value: number): number {
  const c = value / 255
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

export function luminance(rgb: Rgb): number {
  return 0.2126 * channel(rgb[0]) + 0.7152 * channel(rgb[1]) + 0.0722 * channel(rgb[2])
}

export function contrastRatio(a: string, b: string): number {
  const la = luminance(hexToRgb(a))
  const lb = luminance(hexToRgb(b))
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la]
  return (hi + 0.05) / (lo + 0.05)
}

function rgbToHsl([r, g, b]: Rgb): [number, number, number] {
  const rn = r / 255, gn = g / 255, bn = b / 255
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn)
  const l = (max + min) / 2
  if (max === min) return [0, 0, l]
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  const h = max === rn ? (gn - bn) / d + (gn < bn ? 6 : 0) : max === gn ? (bn - rn) / d + 2 : (rn - gn) / d + 4
  return [h * 60, s, l]
}

function hslToRgb(h: number, s: number, l: number): Rgb {
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = l - c / 2
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x]
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255]
}

// Moves lightness (keeping hue and a capped saturation) until every surface gives >= minRatio.
export function accessibleOn(hex: string, surfaces: string[], direction: "darker" | "lighter", minRatio = 4.5): string {
  const [h, s] = rgbToHsl(hexToRgb(hex))
  const saturation = Math.min(s, 0.75)
  let l = rgbToHsl(hexToRgb(hex))[2]
  for (let step = 0; step < 100; step += 1) {
    const candidate = rgbToHex(hslToRgb(h, saturation, l))
    if (surfaces.every(surface => contrastRatio(candidate, surface) >= minRatio)) return candidate
    l += direction === "darker" ? -0.01 : 0.01
    if (l < 0 || l > 1) break
  }
  return direction === "darker" ? "#1E2A24" : "#F4F1E8"
}

export function accentTextColors(hex: string): { light: string; dark: string } {
  return {
    light: accessibleOn(hex, LIGHT_SURFACES, "darker"),
    dark: accessibleOn(hex, DARK_SURFACES, "lighter"),
  }
}

export function fallbackAccent(name: string): string {
  let hash = 0
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  return FALLBACK_PALETTE[hash % FALLBACK_PALETTE.length]
}

// Most common saturated hue among sampled pixels; ignores near-white, near-black and grey.
export function dominantColor(pixels: Uint8ClampedArray | number[]): string | null {
  const buckets = new Map<number, { count: number; n: number; rgb: [number, number, number] }>()
  for (let i = 0; i + 3 < pixels.length; i += 4) {
    if (pixels[i + 3] < 200) continue
    const rgb: Rgb = [pixels[i], pixels[i + 1], pixels[i + 2]]
    const [h, s, l] = rgbToHsl(rgb)
    if (s < 0.25 || l < 0.15 || l > 0.9) continue
    const key = Math.floor(h / 20)
    const bucket = buckets.get(key) ?? { count: 0, n: 0, rgb: [0, 0, 0] }
    bucket.count += 1 + s
    bucket.n += 1
    bucket.rgb = [bucket.rgb[0] + rgb[0], bucket.rgb[1] + rgb[1], bucket.rgb[2] + rgb[2]]
    buckets.set(key, bucket)
  }
  let best: { count: number; n: number; rgb: Rgb } | null = null
  let bestCount = 0
  for (const bucket of buckets.values()) {
    if (bucket.count > bestCount) { best = bucket; bestCount = bucket.count }
  }
  if (!best) return null
  return rgbToHex([best.rgb[0] / best.n, best.rgb[1] / best.n, best.rgb[2] / best.n])
}

const cache = new Map<string, string>()

// Reads the cover through a small canvas. Resolves to the palette fallback when the
// image fails to load or the canvas is tainted by CORS.
export async function coverAccent(src: string | null | undefined, name: string): Promise<string> {
  const key = `${src ?? ""}|${name}`
  const cached = cache.get(key)
  if (cached) return cached
  let accent = fallbackAccent(name)
  if (src && typeof document !== "undefined") {
    try {
      const image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const element = new Image()
        element.crossOrigin = "anonymous"
        element.onload = () => resolve(element)
        element.onerror = reject
        element.src = src
      })
      const canvas = document.createElement("canvas")
      canvas.width = 24
      canvas.height = 24
      const context = canvas.getContext("2d", { willReadFrequently: true })
      if (context) {
        context.drawImage(image, 0, 0, 24, 24)
        accent = dominantColor(context.getImageData(0, 0, 24, 24).data) ?? accent
      }
    } catch {
      /* CORS or load failure: keep the palette colour. */
    }
  }
  cache.set(key, accent)
  return accent
}
