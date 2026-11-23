import type { Page } from "@playwright/test"

type Rgba = [number, number, number, number]

// Colour helpers for the UI specs. Colours are read the way the page paints them (color-mix included) by drawing
// them on a canvas, so a computed value is always plain RGBA.
const RESOLVE = `(value) => {
  const canvas = document.createElement("canvas")
  canvas.width = canvas.height = 1
  const context = canvas.getContext("2d")
  context.clearRect(0, 0, 1, 1)
  context.fillStyle = value
  context.fillRect(0, 0, 1, 1)
  const [r, g, b, a] = context.getImageData(0, 0, 1, 1).data
  return [r, g, b, a / 255]
}`

export async function paint(page: Page, selector: string, property: "color" | "backgroundColor" | "borderTopColor"): Promise<Rgba> {
  return page.locator(selector).first().evaluate((element, args) => {
    const resolve = new Function(`return ${args.resolve}`)() as (value: string) => Rgba
    return resolve(getComputedStyle(element)[args.prop])
  }, { prop: property, resolve: RESOLVE })
}

// The surface a piece of text sits on: its own fill, else the nearest ancestor that has one.
export async function surfaceBehind(page: Page, selector: string): Promise<Rgba> {
  return page.locator(selector).first().evaluate((element, source) => {
    const resolve = new Function(`return ${source}`)() as (value: string) => Rgba
    for (let node: Element | null = element; node; node = node.parentElement) {
      const color = resolve(getComputedStyle(node).backgroundColor)
      if (color[3] > 0.9) return color
    }
    return resolve(getComputedStyle(document.body).backgroundColor)
  }, RESOLVE)
}

function luminance([r, g, b]: number[]) {
  const channel = (value: number) => { const v = value / 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

export function contrast(a: number[], b: number[]) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

// The computed values of the gold tokens in the current theme.
export function goldValues(page: Page) {
  return page.evaluate(() => {
    const probe = document.createElement("i")
    const values: string[] = []
    for (const token of ["--color-brand-accent", "--color-brand-accent-hover", "--color-accent-text", "--color-brand-accent-soft"]) {
      probe.style.color = `var(${token})`
      document.body.append(probe)
      values.push(getComputedStyle(probe).color)
    }
    probe.remove()
    return values
  })
}

// Elements under the given roots that paint with a gold token (text, fill, border, icon).
export function goldOffenders(page: Page, roots: string[]) {
  return goldValues(page).then((gold) => page.evaluate(({ values, selectors }) => {
    const found: string[] = []
    for (const selector of selectors) {
      for (const root of document.querySelectorAll(selector)) {
        for (const element of [root, ...root.querySelectorAll("*")]) {
          const style = getComputedStyle(element)
          for (const prop of ["color", "backgroundColor", "borderTopColor", "borderBottomColor", "fill", "stroke"] as const) {
            if (values.includes(style[prop])) found.push(`${element.tagName.toLowerCase()}.${element.className} ${prop}`)
          }
        }
      }
    }
    return found
  }, { values: gold, selectors: roots }))
}
