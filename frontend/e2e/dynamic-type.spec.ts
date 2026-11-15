import { expect, test, type Page } from "@playwright/test"

import { logInToOnboarding, openAccountOptions } from "./support"

// iOS body text sizes for the accessibility Dynamic Type settings AX1, AX3
// and AX5 (accessibility-extra-extra-extra-large, the largest).
const ACCESSIBILITY_BODY_SIZES = [
  { name: "AX1", px: 28 },
  { name: "AX3", px: 40 },
  { name: "AX5", px: 53 },
]

// Emulates the native iOS path: main.tsx sets data-native-ios inside the
// Capacitor shell, and native-dynamic-type.css then sizes text from
// -apple-system-body. Desktop WebKit reports the macOS body size, so the
// root size is pinned to the iOS body size under test instead.
async function emulateNativeDynamicType(page: Page, bodyPx: number) {
  await page.addInitScript((size) => {
    document.addEventListener("DOMContentLoaded", () => {
      document.documentElement.dataset.nativeIos = "true"
      const style = document.createElement("style")
      style.dataset.e2e = "dynamic-type"
      style.textContent = `:root[data-native-ios] { font-size: ${size}px !important; }`
      document.head.append(style)
    })
  }, bodyPx)
}

// Returns every visible word (split on whitespace, hyphens and slashes) whose
// glyphs are laid out on more than one line, i.e. broken mid-word.
async function wordsBrokenAcrossLines(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const broken: string[] = []
    const root = document.querySelector("main")
    if (!root) return broken
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
    while (walker.nextNode()) {
      const node = walker.currentNode as Text
      const parent = node.parentElement
      if (!parent || !parent.checkVisibility({ visibilityProperty: true })) continue
      const pattern = /[^\s\-–—/]+/g
      let match: RegExpExecArray | null
      while ((match = pattern.exec(node.data))) {
        const range = document.createRange()
        range.setStart(node, match.index)
        range.setEnd(node, match.index + match[0].length)
        const lines = new Set(
          [...range.getClientRects()]
            .filter((rect) => rect.width > 0 && rect.height > 0)
            .map((rect) => Math.round(rect.top)),
        )
        if (lines.size > 1) broken.push(match[0])
      }
    }
    return broken
  })
}

async function expectWordsWhole(page: Page, label: string) {
  expect.soft(await wordsBrokenAcrossLines(page), `${label}: words broken across lines`).toEqual([])
  const overflow = await page.evaluate(() =>
    document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect.soft(overflow, `${label}: horizontal overflow (px)`).toBeLessThanOrEqual(0)
}

for (const size of ACCESSIBILITY_BODY_SIZES) test.describe(`Native Dynamic Type at ${size.name}`, () => {
  test(`h) ${size.name}: sign-in, onboarding and Account options keep words whole`, async ({ page }) => {
    await emulateNativeDynamicType(page, size.px)
    await page.goto("/login")
    const heading = page.getByRole("heading", { name: "Welcome back" })
    await expect(heading).toBeVisible()
    // Guard: the emulation must actually drive the native rem-based sizes.
    const rootSize = await page.evaluate(() => getComputedStyle(document.documentElement).fontSize)
    expect(rootSize).toBe(`${size.px}px`)
    await expectWordsWhole(page, "Sign-in")

    await page.getByRole("button", { name: "Register" }).click()
    await expect(page.getByRole("heading", { name: "Create your account" })).toBeVisible()
    await expectWordsWhole(page, "Register")

    await logInToOnboarding(page)
    await expectWordsWhole(page, "Onboarding step 1")
    await page.getByRole("button", { name: "Get started" }).click()
    await expect(page.getByText("Step 2 of 4", { exact: true })).toBeVisible()
    await expectWordsWhole(page, "Onboarding step 2")
    await page.getByRole("button", { name: "Continue" }).click()
    await expect(page.getByText("Step 3 of 4", { exact: true })).toBeVisible()
    await expectWordsWhole(page, "Onboarding step 3")
    await page.getByRole("button", { name: "Continue" }).click()
    await expect(page.getByText("Step 4 of 4", { exact: true })).toBeVisible()
    await expectWordsWhole(page, "Onboarding step 4")

    await openAccountOptions(page)
    await expectWordsWhole(page, "Account options")
  })
})
