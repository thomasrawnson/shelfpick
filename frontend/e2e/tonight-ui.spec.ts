import { existsSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { expect, test, type Page } from "@playwright/test"

import { ANALYTICS_ANSWERED, logIn } from "./support"
import { contrast, goldOffenders, paint, surfaceBehind } from "./colour"
import { avatarCollisions, mockShelf } from "./ui-fixtures"

// SP-UI-03: the Tonight screen at 390x844, light and dark, against the real local backend with the
// shelf and the account profile mocked so the screen starts with no player count chosen.
const STAGE = process.env.SP_UI_03_STAGE ?? "after"
const SHOTS = `../docs/screenshots/sp-ui-03/${STAGE}`
const AUTH_STATE = "test-results/.tonight-ui-auth.json"
test.use({ storageState: AUTH_STATE, viewport: { width: 390, height: 844 } })

test.beforeAll(async ({ browser }, testInfo) => {
  if (testInfo.project.name !== "iPhone 15") return
  const context = await browser.newContext({ storageState: ANALYTICS_ANSWERED })
  const page = await context.newPage()
  await logIn(page, "local-free@shelfpick.app")
  await expect(page).toHaveURL(/\/tonight/)
  await context.storageState({ path: AUTH_STATE })
  await context.close()
})

test.beforeEach(({ browserName }, testInfo) => { test.skip(browserName !== "webkit" || testInfo.project.name !== "iPhone 15") })

async function mockTonight(page: Page) {
  await mockShelf(page)
  await page.route(/\/picker\/options/, (route) => route.fulfill({ json: { categories: [], mechanics: [] } }))
  // No saved group size, so Tonight starts with nothing chosen; a gold avatar shows the neutral fill.
  await page.route(/\/auth\/me$/, async (route) => {
    const response = await route.fetch()
    return route.fulfill({
      response,
      json: { ...(await response.json()), preferred_player_count: null, avatar_key: "gold", player_name: "Tom Wales" },
    })
  })
}

for (const scheme of ["light", "dark"] as const) {
  test(`Screenshots: Tonight ${STAGE} (${scheme})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: "reduce" })
    await mockTonight(page)
    await page.goto("/tonight")
    await expect(page.getByRole("heading", { name: "What should we play?" })).toBeVisible()
    await expect(page.getByText("Recently played")).toBeVisible()
    await page.waitForTimeout(400)
    await page.screenshot({ path: `${SHOTS}/tonight-empty-${scheme}.png` })
    await page.getByRole("button", { name: "3 players" }).click()
    await page.getByRole("button", { name: "Medium" }).click()
    await page.waitForTimeout(200)
    await page.screenshot({ path: `${SHOTS}/tonight-selected-${scheme}.png` })
  })
}

const FONT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../src/assets/fonts")

async function openTonight(page: Page, scheme: "light" | "dark") {
  await page.emulateMedia({ colorScheme: scheme, reducedMotion: "reduce" })
  await mockTonight(page)
  await page.goto("/tonight")
  await expect(page.getByRole("heading", { name: "What should we play?" })).toBeVisible()
}

for (const scheme of ["light", "dark"] as const) {
  test.describe(`Tonight (${scheme})`, () => {
    test("Find a game says why it is off, linked to the button, and the hint goes once a count is chosen", async ({ page }) => {
      await openTonight(page, scheme)
      const find = page.getByRole("button", { name: "Find a game" })
      const hint = page.getByText("Choose how many are playing")
      await expect(find).toBeDisabled()
      await expect(hint).toBeVisible()
      await expect(find).toHaveAccessibleDescription("Choose how many are playing")
      const [findBox, hintBox] = [await find.boundingBox(), await hint.boundingBox()]
      expect(hintBox!.y).toBeGreaterThan(findBox!.y + findBox!.height - 1)

      await page.getByRole("button", { name: "3 players" }).click()
      await expect(find).toBeEnabled()
      await expect(hint).toHaveCount(0)
      await expect(find).not.toHaveAttribute("aria-describedby", /.+/)
    })

    test("the chosen count and complexity show a check and expose their pressed state", async ({ page }) => {
      await openTonight(page, scheme)
      const three = page.getByRole("button", { name: "3 players" })
      const medium = page.getByRole("button", { name: "Medium" })
      await expect(three).toHaveAttribute("aria-pressed", "false")
      await expect(three.locator(".tonight-check")).toHaveCount(0)
      await three.click()
      await medium.click()
      for (const chosen of [three, medium]) {
        await expect(chosen).toHaveAttribute("aria-pressed", "true")
        await expect(chosen.locator(".tonight-check")).toBeVisible()
      }
      // Only one of each is chosen, and the others have no mark.
      await expect(page.getByRole("button", { name: "2 players" })).toHaveAttribute("aria-pressed", "false")
      await expect(page.getByRole("button", { name: "Any" })).toHaveAttribute("aria-pressed", "false")
      await expect(page.locator(".tonight-screen .tonight-check")).toHaveCount(2)
      // The fill differs from an unchosen one, so the state is not colour-only (the check is the other signal).
      expect(await paint(page, ".tonight-choice.selected", "backgroundColor")).not.toEqual(await paint(page, ".tonight-choice:not(.selected)", "backgroundColor"))
    })

    test("exactly one filled primary button; the group vote is a quiet text action", async ({ page }) => {
      await openTonight(page, scheme)
      await page.getByRole("button", { name: "3 players" }).click()
      await expect(page.locator(".tonight-screen .primary-button")).toHaveCount(1)
      await expect(page.locator(".tonight-screen .secondary-button, .tonight-screen .ghost-button")).toHaveCount(0)

      await expect(page.getByRole("button", { name: "Find a game" })).toBeEnabled()
      const brand = await page.evaluate(() => {
        const probe = document.createElement("i")
        probe.style.backgroundColor = "var(--color-brand-primary)"
        document.body.append(probe)
        const value = getComputedStyle(probe).backgroundColor
        probe.remove()
        return value
      })
      // The fill follows the enabled state through a short transition, so read it until it settles.
      await expect.poll(async () => {
        const [r, g, b, a] = await paint(page, ".tonight-screen .primary-button", "backgroundColor")
        return a === 1 ? `rgb(${r}, ${g}, ${b})` : "transparent"
      }).toBe(brand)

      const vote = page.getByRole("button", { name: "Start a group vote" })
      await expect(vote).toBeVisible()
      expect((await paint(page, ".tonight-text-action", "backgroundColor"))[3]).toBe(0)
      expect(await vote.evaluate((element) => getComputedStyle(element).borderTopWidth)).toBe("0px")
      // Only options and the primary button are filled: the two list rows are not.
      for (const row of [".tonight-row", ".tonight-fine-tune > summary"]) {
        expect((await paint(page, row, "backgroundColor"))[3]).toBe(0)
      }
    })

    test("no gold on Tonight, and accent text meets WCAG AA", async ({ page }, testInfo) => {
      await openTonight(page, scheme)
      const report: string[] = []
      // The hint is only there while no count is chosen.
      const hintRatio = contrast(await paint(page, ".tonight-hint", "color"), await surfaceBehind(page, ".tonight-hint"))
      report.push(`hint: ${hintRatio.toFixed(2)}:1`)
      expect(hintRatio, "hint contrast").toBeGreaterThanOrEqual(4.5)
      await page.getByRole("button", { name: "3 players" }).click()
      await page.getByRole("button", { name: "Medium" }).click()

      const offenders = await goldOffenders(page, [".tonight-screen", ".app-top-bar"])
      expect(offenders).toEqual([])

      // Accent (Forest) text and the label tones, against the surface each sits on.
      const checks: Array<[string, string, number]> = [
        [".tonight-choice.selected strong", "selected choice", 4.5],
        [".tonight-text-action", "Start a group vote", 4.5],
        [".tonight-label", "section label", 4.5],
        [".tonight-row span", "Choose players by name", 4.5],
        [".tonight-recent-name", "recent title", 4.5],
      ]
      for (const [selector, name, minimum] of checks) {
        const ratio = contrast(await paint(page, selector, "color"), await surfaceBehind(page, selector))
        report.push(`${name}: ${ratio.toFixed(2)}:1`)
        expect(ratio, `${name} contrast`).toBeGreaterThanOrEqual(minimum)
      }
      testInfo.annotations.push({ type: "contrast", description: `${scheme}: ${report.join("; ")}` })
    })

    test("the avatar is at least 44x44, neutral, and covers no control", async ({ page }) => {
      await openTonight(page, scheme)
      const avatar = page.getByRole("button", { name: /Open profile and settings for Tom Wales/ })
      const box = await avatar.boundingBox()
      expect(box!.width).toBeGreaterThanOrEqual(44)
      expect(box!.height).toBeGreaterThanOrEqual(44)
      expect(await avatarCollisions(page)).toEqual([])

      const raised = await page.evaluate(() => {
        const probe = document.createElement("i")
        probe.style.backgroundColor = "var(--color-surface-raised)"
        document.body.append(probe)
        const value = getComputedStyle(probe).backgroundColor
        probe.remove()
        return value
      })
      const fill = await paint(page, ".app-top-bar .player-avatar", "backgroundColor")
      expect(`rgb(${fill[0]}, ${fill[1]}, ${fill[2]})`).toBe(raised)
      await page.screenshot({ path: `${SHOTS}/tonight-avatar-${scheme}.png`, clip: { x: 230, y: 0, width: 160, height: 90 } })
    })

    test("the four section labels share one style", async ({ page }) => {
      await openTonight(page, scheme)
      await expect(page.getByText("Recently played")).toBeVisible()
      const styles = await page.evaluate(() => {
        const labels = ["Tonight", "Who is playing?", "Complexity", "Recently played"]
        return labels.map((text) => {
          const element = [...document.querySelectorAll(".tonight-screen .tonight-label, .tonight-recent .tonight-label")]
            .find((candidate) => candidate.textContent?.trim() === text)!
          const style = getComputedStyle(element)
          return [style.fontFamily, style.fontSize, style.fontWeight, style.letterSpacing, style.textTransform, style.color, style.lineHeight].join(" | ")
        })
      })
      expect(new Set(styles).size).toBe(1)
      expect(styles[0]).toContain("uppercase")
    })

    test("the right edge of Recently played fades", async ({ page }) => {
      await openTonight(page, scheme)
      await expect(page.getByText("Recently played")).toBeVisible()
      const mask = await page.locator(".tonight-recent-scroll").evaluate((element) => getComputedStyle(element).maskImage || getComputedStyle(element).webkitMaskImage)
      expect(mask).toContain("linear-gradient")
    })
  })
}

test("Fraunces on the headline and DM Sans elsewhere, loaded from the bundle with no external font request", async ({ page }) => {
  const requests: Array<{ url: string; type: string }> = []
  page.on("request", (request) => requests.push({ url: request.url(), type: request.resourceType() }))
  await openTonight(page, "light")
  await page.evaluate(() => document.fonts.ready)

  const fonts = await page.evaluate(() => [...document.fonts].filter((face) => /Fraunces|DM Sans/.test(face.family)).map((face) => `${face.family}:${face.status}`))
  expect(fonts.sort()).toEqual(["DM Sans:loaded", "Fraunces:loaded"])

  const families = await page.evaluate(() => {
    const family = (selector: string) => getComputedStyle(document.querySelector(selector)!).fontFamily
    const weight = getComputedStyle(document.querySelector(".tonight-header h1")!).fontWeight
    return {
      headline: family(".tonight-header h1"),
      weight,
      label: family(".tonight-label"),
      chip: family(".tonight-choice strong"),
      button: family(".tonight-actions .primary-button"),
      row: family(".tonight-row"),
    }
  })
  expect(families.headline).toMatch(/^Fraunces/)
  expect(families.weight).toBe("600")
  for (const other of [families.label, families.chip, families.button, families.row]) expect(other).toMatch(/^"?DM Sans"?/)

  const fontFiles = requests.filter((request) => request.type === "font").map((request) => new URL(request.url))
  const mine = fontFiles.filter((url) => /Fraunces|DMSans/i.test(url.pathname))
  expect(mine.length).toBe(2)
  for (const url of mine) expect(url.origin).toBe(new URL(page.url()).origin)
  // Nothing for these two families is asked of Google Fonts (the older Lora and Nunito Sans still are).
  expect(requests.filter((request) => /fonts\.(googleapis|gstatic)\.com/.test(request.url) && /Fraunces|DM\+Sans|DM%20Sans/i.test(request.url))).toEqual([])

  for (const file of ["Fraunces-latin-wght.woff2", "DMSans-latin-wght.woff2", "Fraunces-OFL.txt", "DMSans-OFL.txt"]) {
    expect(existsSync(path.join(FONT_DIR, file)), file).toBe(true)
  }
})

// Native iOS Dynamic Type at the accessibility sizes: the same emulation dynamic-type.spec.ts uses.
for (const size of [{ name: "AX1", px: 28 }, { name: "AX3", px: 40 }, { name: "AX5", px: 53 }]) {
  test(`Tonight at ${size.name}: chips wrap two rows of three, no clipped or broken words, headline fits`, async ({ page }) => {
    await page.addInitScript((bodyPx) => {
      document.addEventListener("DOMContentLoaded", () => {
        document.documentElement.dataset.nativeIos = "true"
        const style = document.createElement("style")
        style.textContent = `:root[data-native-ios] { font-size: ${bodyPx}px !important; }`
        document.head.append(style)
      })
    }, size.px)
    await openTonight(page, "light")
    await expect(page.getByText("Recently played")).toBeVisible()
    await page.waitForTimeout(300)

    const grid = await page.locator(".tonight-count-grid").evaluate((element) => {
      const columns = getComputedStyle(element).gridTemplateColumns.split(" ").length
      const tops = new Set([...element.children].map((child) => Math.round(child.getBoundingClientRect().top)))
      return { columns, rows: tops.size }
    })
    expect(grid).toEqual({ columns: 3, rows: 2 })

    const problems = await page.evaluate(() => {
      const found: string[] = []
      const root = document.querySelector(".tonight-screen")!
      // Words split over two lines.
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
      while (walker.nextNode()) {
        const node = walker.currentNode as Text
        if (!node.parentElement?.checkVisibility({ visibilityProperty: true }) || node.parentElement.closest(".tonight-recent")) continue
        for (const match of node.data.matchAll(/[^\s\-–—/]+/g)) {
          const range = document.createRange()
          range.setStart(node, match.index!)
          range.setEnd(node, match.index! + match[0].length)
          const lines = new Set([...range.getClientRects()].filter((rect) => rect.width > 0).map((rect) => Math.round(rect.top)))
          if (lines.size > 1) found.push(`broken word: ${match[0]}`)
        }
      }
      // Text wider than its box (clipped), headline included.
      for (const element of root.querySelectorAll<HTMLElement>("h1, .tonight-label, .tonight-choice, .tonight-row, .tonight-text-action, .primary-button, .tonight-hint")) {
        if (element.scrollWidth > element.clientWidth + 1) found.push(`clipped: ${element.tagName.toLowerCase()}.${element.className} "${element.textContent?.trim().slice(0, 24)}"`)
      }
      if (document.documentElement.scrollWidth > document.documentElement.clientWidth) found.push("horizontal overflow")
      const headline = document.querySelector(".tonight-header h1")!.getBoundingClientRect()
      if (headline.right > document.documentElement.clientWidth) found.push("headline past the screen edge")
      return found
    })
    expect(problems).toEqual([])
    expect(await avatarCollisions(page)).toEqual([])
    await page.screenshot({ path: `${SHOTS}/tonight-${size.name}.png` })
  })
}
