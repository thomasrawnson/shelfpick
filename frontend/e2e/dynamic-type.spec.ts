import { expect, test, type Page } from "@playwright/test"

import { logIn, logInToOnboarding, openAccountOptions } from "./support"

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
async function wordsBrokenAcrossLines(page: Page, rootSelector = "main"): Promise<string[]> {
  return page.evaluate((selector) => {
    const broken: string[] = []
    const root = document.querySelector(selector)
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
  }, rootSelector)
}

async function expectWordsWhole(page: Page, label: string, rootSelector = "main") {
  expect.soft(await wordsBrokenAcrossLines(page, rootSelector), `${label}: words broken across lines`).toEqual([])
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

// SP-YIR-01: every Year in Review slide keeps words whole at the AX sizes.
// The Year recap response is mocked; the story is portalled outside <main>.
const STORY_RECAP = {
  year: 2026, total_plays: 87, unique_games: 23, total_duration_minutes: 4310, duration_plays: 61,
  top_games: [
    { bgg_id: 1, name: "Clockwork Market", play_count: 14 },
    { bgg_id: 2, name: "Lantern Grove", play_count: 11 },
    { bgg_id: 3, name: "Harbour Council", play_count: 9 },
    { bgg_id: 4, name: "Tiny Orchard", play_count: 7 },
    { bgg_id: 5, name: "Night Courier", play_count: 5 },
  ],
  new_games_count: 9, new_games: [{ bgg_id: 4, name: "Tiny Orchard", play_count: 7 }],
  plays_by_month: [4, 5, 6, 7, 9, 8, 6, 5, 12, 11, 8, 6], busiest_month: 9,
  plays_by_weekday: [3, 4, 5, 6, 12, 40, 17], busiest_weekday: 6,
  longest_play: { bgg_id: 1, name: "Clockwork Market", duration_minutes: 195, played_on: "2026-03-14" },
  co_players: [{ name: "Ann", play_count: 41 }],
}

for (const size of ACCESSIBILITY_BODY_SIZES) test.describe(`Year in Review story at ${size.name}`, () => {
  test(`${size.name}: every slide keeps words whole and controls reachable`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "iPhone 15")
    await emulateNativeDynamicType(page, size.px)
    await page.route("**/insights/year-recap**", route => route.fulfill({ json: STORY_RECAP }))
    await logIn(page, "local-free@shelfpick.app")
    await expect(page).toHaveURL(/\/picker/)
    await page.goto("/insights")
    await page.getByRole("tab", { name: "Recaps" }).or(page.getByRole("button", { name: "Recaps" })).first().click()
    await page.getByRole("button", { name: "View my year" }).click()
    const story = page.getByRole("dialog", { name: /Year in Review$/ })
    await expect(story).toBeVisible()
    for (let index = 0; index < 8; index += 1) {
      await expectWordsWhole(page, `Story slide ${index + 1}`, ".year-story")
      const next = story.getByRole("button", { name: "Next", exact: true })
      if (index < 7) {
        await expect(next).toBeInViewport()
        await next.click()
      }
    }
    await expect(story.getByRole("button", { name: "Share my year" })).toBeInViewport()
  })
})
