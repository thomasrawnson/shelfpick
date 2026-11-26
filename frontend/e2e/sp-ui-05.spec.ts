import { expect, test, type Page } from "@playwright/test"

import { goldOffenders } from "./colour"
import { ANALYTICS_ANSWERED, logIn } from "./support"
import { avatarCollisions, mockGameDetail } from "./ui-fixtures"

// SP-UI-05: the game detail screen at 390x844, light and dark, against the real local backend with the shelf and the
// game's history mocked (the account and sign-in are real). SP_UI_05_STAGE picks the screenshot folder.
const STAGE = process.env.SP_UI_05_STAGE ?? "after"
const SHOTS = `../docs/screenshots/sp-ui-05/${STAGE}`
const AUTH_STATE = "test-results/.sp-ui-05-auth.json"
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

async function openDetail(page: Page, scheme: "light" | "dark", options: Parameters<typeof mockGameDetail>[1] = {}) {
  await page.emulateMedia({ colorScheme: scheme, reducedMotion: "reduce" })
  await mockGameDetail(page, options)
  await page.goto("/shelf")
  await page.getByRole("button", { name: /^Clockwork Market/ }).click()
  await expect(page.getByRole("heading", { level: 1, name: "Clockwork Market" })).toBeVisible()
  await page.waitForLoadState("networkidle")
  await page.waitForFunction(() => !document.querySelector('[aria-busy="true"]'))
  await page.waitForTimeout(300)
}

for (const scheme of ["light", "dark"] as const) {
  test(`Screenshots: game detail ${STAGE} (${scheme})`, async ({ page }) => {
    await openDetail(page, scheme)
    await page.screenshot({ path: `${SHOTS}/detail-${scheme}.png` })
    await page.getByRole("heading", { name: "Recent plays" }).scrollIntoViewIfNeeded()
    await page.locator(".recent-plays").evaluate((element) => element.scrollIntoView({ block: "start" }))
    await page.waitForTimeout(200)
    await page.screenshot({ path: `${SHOTS}/detail-history-${scheme}.png` })
    if (STAGE === "before") return
    await page.locator(".recent-play-detail").first().getByRole("button", { name: /More options for the .* play/ }).click()
    await page.waitForTimeout(150)
    await page.screenshot({ path: `${SHOTS}/detail-play-menu-${scheme}.png` })
    await page.getByRole("menuitem", { name: "Delete play" }).click()
    await expect(page.getByRole("alertdialog")).toBeVisible()
    await page.screenshot({ path: `${SHOTS}/detail-delete-sheet-${scheme}.png` })
    await page.keyboard.press("Escape")
    await page.evaluate(() => document.querySelector(".app-phone")?.scrollTo(0, 0))
    await page.getByRole("button", { name: "More options for Clockwork Market" }).click()
    await page.getByRole("menuitem", { name: "Remove from collection" }).click()
    await expect(page.getByRole("alertdialog")).toBeVisible()
    await page.screenshot({ path: `${SHOTS}/detail-remove-sheet-${scheme}.png` })
  })
}

// Requests the page sends, so a destructive action can be shown not to have happened before it is confirmed.
function trackDeletes(page: Page) {
  const seen: string[] = []
  void page.route((url) => /\/(plays\/\d+|collection\/\d+)$/.test(url.pathname), (route) => {
    if (route.request().method() === "DELETE") {
      seen.push(new URL(route.request().url()).pathname)
      return route.fulfill({ json: { message: "ok" } })
    }
    return route.fallback()
  })
  return seen
}

for (const scheme of ["light", "dark"] as const) {
  test.describe(`Game detail (${scheme})`, () => {
    test("the cover, title, meta line and Log a play are all on the first screen", async ({ page }) => {
      await openDetail(page, scheme)
      const navTop = (await page.getByRole("navigation", { name: "Primary" }).boundingBox())!.y
      const boxes = {
        cover: await page.locator(".detail-cover").boundingBox(),
        title: await page.getByRole("heading", { level: 1, name: "Clockwork Market" }).boundingBox(),
        meta: await page.locator(".detail-meta").boundingBox(),
        log: await page.getByRole("button", { name: "Log a play" }).boundingBox(),
      }
      for (const [name, box] of Object.entries(boxes)) {
        expect(box, name).not.toBeNull()
        expect(box!.y, `${name} starts on the screen`).toBeGreaterThanOrEqual(0)
        expect(box!.y + box!.height, `${name} ends above the tab bar`).toBeLessThanOrEqual(navTop)
      }
      expect(boxes.cover!.height, "the cover is capped").toBeLessThanOrEqual(130)
      await expect(page.locator(".detail-meta")).toHaveText("2 players · 30 min")
      // Players is part of the meta line, not a section of its own.
      await expect(page.getByText("Players", { exact: true })).toHaveCount(0)
    })

    test("the hero is one left-aligned column of text; Back to shelf and the avatar share a row", async ({ page }) => {
      await openDetail(page, scheme)
      const left = async (selector: string) => Math.round((await page.locator(selector).first().boundingBox())!.x)
      expect(await left(".detail-cover")).toBe(await left(".detail-metric"))
      expect(await left(".detail-cover")).toBe(await left(".section-label"))
      expect(await page.locator(".detail-title h1").evaluate((element) => getComputedStyle(element).textAlign)).toMatch(/left|start/)
      const back = (await page.getByRole("button", { name: /Back to shelf/ }).boundingBox())!
      const avatar = (await page.getByRole("button", { name: /Open profile and settings/ }).boundingBox())!
      expect(Math.abs((back.y + back.height / 2) - (avatar.y + avatar.height / 2)), "nav row centre line").toBeLessThanOrEqual(3)
      expect(await avatarCollisions(page)).toEqual([])
    })

    test("each play: Rematch, Share play and Edit on one row, Delete play only behind the menu and a confirmation", async ({ page }) => {
      const deletes = trackDeletes(page)
      await openDetail(page, scheme)
      const play = page.locator(".recent-play-detail").first()
      await expect(play.getByRole("button", { name: "Delete play" })).toHaveCount(0)
      const row = play.locator(".recent-play-actions")
      const labels = await row.getByRole("button").evaluateAll((buttons) => buttons.map((button) => (button.getAttribute("aria-label") ?? button.textContent ?? "").trim()))
      expect(labels).toEqual(["Rematch", "Share play", "Edit", expect.stringMatching(/^More options for the .* play$/)])

      // Nothing is clipped, nothing wraps to a lone row, and the label does not touch its pill edges.
      const geometry = await row.evaluate((element) => Array.from(element.children).map((child) => {
        const box = child.getBoundingClientRect()
        return { text: child.textContent, top: Math.round(box.top), height: Math.round(box.height), width: Math.round(box.width), clipped: child.scrollWidth > child.clientWidth + 1, right: box.right }
      }))
      for (const item of geometry) {
        expect(item.clipped, `${item.text} clipped`).toBe(false)
        expect(item.height, `${item.text} target height`).toBeGreaterThanOrEqual(44)
        expect(item.right, `${item.text} inside the screen`).toBeLessThanOrEqual(390)
      }
      expect(new Set(geometry.map((item) => item.top)).size, "all actions on one row").toBe(1)
      const pill = await play.getByRole("button", { name: "Rematch" }).evaluate((button) => {
        const range = document.createRange()
        range.selectNodeContents(button)
        const text = range.getBoundingClientRect()
        const box = button.getBoundingClientRect()
        return { left: text.left - box.left, right: box.right - text.right }
      })
      expect(pill.left, "padding left of the label").toBeGreaterThanOrEqual(12)
      expect(pill.right, "padding right of the label").toBeGreaterThanOrEqual(12)

      // The menu holds Delete play; choosing it asks first and nothing is deleted yet.
      await play.getByRole("button", { name: /More options for the .* play/ }).click()
      const menu = page.getByRole("menu")
      await expect(menu.getByRole("menuitem")).toHaveText(["Send to BG Stats", "Delete play"])
      await menu.getByRole("menuitem", { name: "Delete play" }).click()
      const sheet = page.getByRole("alertdialog", { name: "Delete this play?" })
      await expect(sheet).toBeVisible()
      await expect(sheet).toContainText("Clockwork Market")
      await expect(sheet.getByRole("button", { name: "Cancel" })).toBeFocused()
      // Both buttons are on top of the tab bar, so they can be tapped.
      const covered = await sheet.getByRole("button").evaluateAll((buttons) => buttons.filter((button) => {
        const box = button.getBoundingClientRect()
        return document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2) !== button
      }).map((button) => button.textContent))
      expect(covered).toEqual([])
      expect(deletes).toEqual([])
      await page.keyboard.press("Escape")
      await expect(sheet).toHaveCount(0)
      expect(deletes).toEqual([])
      await expect(play.getByRole("button", { name: /More options for the .* play/ })).toBeFocused()

      await play.getByRole("button", { name: /More options for the .* play/ }).click()
      await page.getByRole("menuitem", { name: "Delete play" }).click()
      await page.getByRole("alertdialog", { name: "Delete this play?" }).getByRole("button", { name: "Delete play" }).click()
      await expect.poll(() => deletes).toEqual(["/plays/1"])
    })

    test("the collapse control is a labelled 44pt chevron with aria-expanded", async ({ page }) => {
      await openDetail(page, scheme)
      const play = page.locator(".recent-play-detail").first()
      const toggle = play.getByRole("button", { name: /^Collapse play on / })
      await expect(toggle).toHaveAttribute("aria-expanded", "true")
      const box = (await toggle.boundingBox())!
      expect(box.width).toBeGreaterThanOrEqual(44)
      expect(box.height).toBeGreaterThanOrEqual(44)
      await expect(toggle.locator("svg")).toHaveCount(1)
      expect(await toggle.textContent()).toBe("")
      await toggle.click()
      const collapsed = play.getByRole("button", { name: /^Expand play on / })
      await expect(collapsed).toHaveAttribute("aria-expanded", "false")
      await expect(play.getByRole("button", { name: "Rematch" })).toBeHidden()
      await collapsed.click()
      await expect(play.getByRole("button", { name: "Rematch" })).toBeVisible()
    })

    test("Mechanics shows six chips and Show all, and expands; the Tags artefact is hidden", async ({ page }) => {
      await openDetail(page, scheme)
      const mechanics = page.getByRole("region", { name: "Mechanics" })
      await expect(mechanics.locator("li")).toHaveCount(6)
      await expect(mechanics.getByText("Tags", { exact: true })).toHaveCount(0)
      const showAll = mechanics.getByRole("button", { name: "Show all 8" })
      await expect(showAll).toHaveAttribute("aria-expanded", "false")
      await showAll.click()
      await expect(mechanics.locator("li")).toHaveCount(8)
      await expect(mechanics.getByRole("button", { name: "Show fewer" })).toHaveAttribute("aria-expanded", "true")
      await mechanics.getByRole("button", { name: "Show fewer" }).click()
      await expect(mechanics.locator("li")).toHaveCount(6)
      // Two categories need no control, and the chips are plain text, not buttons.
      const categories = page.getByRole("region", { name: "Categories" })
      await expect(categories.locator("li")).toHaveCount(2)
      await expect(categories.getByRole("button")).toHaveCount(0)
      expect(await mechanics.locator("li").first().evaluate((element) => { const style = getComputedStyle(element); return [style.backgroundColor, style.borderTopWidth] })).toEqual(["rgba(0, 0, 0, 0)", "0px"])
    })

    test("flat facts with scales; missing durations show a dash and never 0; one play reads as 1 play", async ({ page }) => {
      await openDetail(page, scheme)
      const tiles = await page.locator(".detail-metrics .detail-metric").evaluateAll((nodes) => nodes.map((node) => (node.textContent ?? "").replace(/\s+/g, " ").trim()))
      expect(tiles).toEqual(["8.1 / 10Rating", "2.2 / 5Weight", "30Minutes", "3plays", "2.7Avg players", "47Avg mins"])
      const metric = page.locator(".detail-metric").first()
      expect(await metric.evaluate((node) => { const style = getComputedStyle(node); return [style.textAlign, style.borderTopWidth, style.backgroundColor] })).toEqual(["left", "0px", "rgba(0, 0, 0, 0)"])
      const primary = await page.evaluate(() => { const probe = document.createElement("i"); probe.style.color = "var(--color-text-primary)"; document.body.append(probe); const value = getComputedStyle(probe).color; probe.remove(); return value })
      for (const number of await page.locator(".detail-metric strong").all()) expect(await number.evaluate((node) => getComputedStyle(node).color)).toBe(primary)
    })

    test("a single play reads 1 play; no recorded averages show a dash", async ({ page }) => {
      await openDetail(page, scheme, { onePlay: true, noAverages: true })
      const history = page.locator(".game-history .detail-metric")
      await expect(history.nth(0)).toHaveText(/^1\s*play$/)
      await expect(history.nth(1)).toHaveText(/^—\s*Avg players$/)
      await expect(history.nth(2)).toHaveText(/^—\s*Avg mins$/)
      await expect(page.locator(".game-history").getByText(/^0$/)).toHaveCount(0)
    })

    test("a recorded average of 0 minutes also shows a dash", async ({ page }) => {
      await page.route(/\/games\/1000\/plays/, (route) => route.fulfill({ json: { bgg_id: 1000, play_count: 2, last_played_at: null, average_players: 2, average_duration_minutes: 0, recent_plays: [] } }))
      await page.emulateMedia({ colorScheme: scheme, reducedMotion: "reduce" })
      await mockGameDetail(page)
      await page.route(/\/games\/1000\/plays/, (route) => route.fulfill({ json: { bgg_id: 1000, play_count: 2, last_played_at: null, average_players: 2, average_duration_minutes: 0, recent_plays: [] } }))
      await page.goto("/shelf")
      await page.getByRole("button", { name: /^Clockwork Market/ }).click()
      await expect(page.locator(".game-history .detail-metric").nth(2)).toHaveText(/^—\s*Avg mins$/)
    })

    test("Remove from collection is in the nav-row menu and needs a confirmation sheet that names the game", async ({ page }) => {
      const deletes = trackDeletes(page)
      await openDetail(page, scheme)
      // No full-width red button, and no red divider, remains in the page body.
      expect(await page.locator(".game-detail-screen").evaluate((screen) => {
        const danger = getComputedStyle(document.documentElement).getPropertyValue("--color-danger")
        const probe = document.createElement("i")
        probe.style.color = "var(--color-danger)"
        document.body.append(probe)
        const red = getComputedStyle(probe).color
        probe.remove()
        void danger
        const width = screen.getBoundingClientRect().width
        return Array.from(screen.querySelectorAll("*")).filter((element) => {
          const style = getComputedStyle(element)
          const box = element.getBoundingClientRect()
          const painted = style.backgroundColor === red || style.borderTopColor === red && parseFloat(style.borderTopWidth) > 0 || style.borderBottomColor === red && parseFloat(style.borderBottomWidth) > 0
          return painted && box.width > width * 0.8
        }).length
      })).toBe(0)
      await expect(page.getByRole("button", { name: "Remove from collection" })).toHaveCount(0)

      await page.getByRole("button", { name: "More options for Clockwork Market" }).click()
      await page.getByRole("menuitem", { name: "Remove from collection" }).click()
      const sheet = page.getByRole("alertdialog", { name: "Remove Clockwork Market?" })
      await expect(sheet).toBeVisible()
      await expect(sheet).toContainText("Clockwork Market leaves your shelf")
      expect(deletes).toEqual([])
      await sheet.getByRole("button", { name: "Cancel" }).click()
      await expect(sheet).toHaveCount(0)
      expect(deletes).toEqual([])

      await page.getByRole("button", { name: "More options for Clockwork Market" }).click()
      await page.getByRole("menuitem", { name: "Remove from collection" }).click()
      await page.getByRole("alertdialog").getByRole("button", { name: "Remove from collection" }).click()
      await expect.poll(() => deletes).toEqual(["/collection/1000"])
    })

    test("winners come first with a check and the word Won; no gold; section labels share one style", async ({ page }) => {
      await openDetail(page, scheme)
      const play = page.locator(".recent-play-detail").first()
      const names = await play.locator(".history-player-name").allTextContents()
      expect(names.map((name) => name.split(" · ")[0])).toEqual(["Ann", "Bob", "Cleo"])
      const winner = play.locator(".history-player").first()
      await expect(winner.locator(".won")).toHaveText("Won")
      await expect(winner.locator(".won svg")).toHaveCount(1)
      await expect(play.locator(".history-player").nth(1).locator(".won")).toHaveCount(0)
      expect(await winner.evaluate((element) => { const style = getComputedStyle(element); return [style.borderTopWidth, style.outlineStyle, style.boxShadow] })).toEqual(["0px", "none", "none"])
      expect(await goldOffenders(page, [".game-detail-screen", ".app-top-bar", ".app-nav"])).toEqual([])
      const styles = await page.locator(".game-detail-screen .section-label").evaluateAll((labels) => labels.map((label) => {
        const style = getComputedStyle(label)
        return [style.fontSize, style.fontWeight, style.letterSpacing, style.textTransform, style.color].join("|")
      }))
      expect(styles.length).toBeGreaterThanOrEqual(4)
      expect(new Set(styles).size, "one label style").toBe(1)
      const texts = await page.locator(".game-detail-screen .section-label").allTextContents()
      expect(texts).toEqual(expect.arrayContaining(["Categories", "Mechanics", "Your history", "Recent plays"]))
    })

    test("every control on the page has an accessible name", async ({ page }) => {
      await openDetail(page, scheme)
      await page.getByRole("button", { name: "More options for Clockwork Market" }).click()
      const unnamed = await page.evaluate(() => Array.from(document.querySelectorAll<HTMLElement>(".game-detail-screen :is(button, a[href], [role=menuitem])"))
        .filter((element) => element.getClientRects().length > 0 && !(element.getAttribute("aria-label") ?? element.textContent ?? "").trim())
        .map((element) => element.outerHTML.slice(0, 80)))
      expect(unnamed).toEqual([])
    })
  })
}

const AX = [{ name: "AX1", px: 28 }, { name: "AX3", px: 40 }, { name: "AX5", px: 53 }]

for (const size of AX) {
  test(`Dynamic Type ${size.name}: the detail page keeps labels whole, the title clear and the actions reachable`, async ({ page }) => {
    await page.addInitScript((px) => {
      document.addEventListener("DOMContentLoaded", () => {
        document.documentElement.dataset.nativeIos = "true"
        const style = document.createElement("style")
        style.textContent = `:root[data-native-ios] { font-size: ${px}px !important; }`
        document.head.append(style)
      })
    }, size.px)
    await openDetail(page, "light")
    const report = await page.evaluate(() => {
      const problems: string[] = []
      const overflow = document.documentElement.scrollWidth - document.documentElement.clientWidth
      if (overflow > 0) problems.push(`page scrolls sideways by ${overflow}px`)
      const heading = document.querySelector(".game-detail-screen h1")!
      if (heading.scrollWidth > heading.clientWidth + 1 || heading.getBoundingClientRect().right > window.innerWidth + 1) problems.push("heading clipped")
      const whole = (element: Element) => {
        const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT)
        while (walker.nextNode()) {
          const node = walker.currentNode as Text
          for (const match of node.data.matchAll(/[^\s\-–—/]+/g)) {
            const range = document.createRange()
            range.setStart(node, match.index!)
            range.setEnd(node, match.index! + match[0].length)
            if (new Set(Array.from(range.getClientRects()).filter((rect) => rect.width > 0).map((rect) => Math.round(rect.top))).size > 1) return match[0]
          }
        }
        return null
      }
      for (const element of document.querySelectorAll(".recent-play-actions > *, .detail-nav > *, .section-label, .detail-metric, .text-action")) {
        const box = element.getBoundingClientRect()
        if (box.width > 0 && (box.left < -1 || box.right > window.innerWidth + 1)) problems.push(`outside the screen: ${element.textContent}`)
        if (element.scrollWidth > element.clientWidth + 1) problems.push(`clipped: ${element.textContent}`)
        const broken = whole(element)
        if (broken) problems.push(`word broken: ${broken}`)
      }
      return problems
    })
    expect(report).toEqual([])
    expect(await avatarCollisions(page)).toEqual([])
    // Delete play is still reachable behind the menu.
    await page.getByRole("button", { name: /More options for the .* play/ }).first().scrollIntoViewIfNeeded()
    await page.getByRole("button", { name: /More options for the .* play/ }).first().click()
    await expect(page.getByRole("menuitem", { name: "Delete play" })).toBeVisible()
  })
}
