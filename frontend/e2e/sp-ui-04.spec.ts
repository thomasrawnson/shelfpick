import { expect, test, type Page } from "@playwright/test"

import { contrast, goldOffenders, paint, surfaceBehind } from "./colour"
import { ANALYTICS_ANSWERED, logIn } from "./support"
import { avatarCollisions, mockDiscover, mockShelf } from "./ui-fixtures"

// SP-UI-04: the shared selected state, Discover and Shelf at 390x844, light and dark, against the real local backend
// with the shelf and Discover feeds mocked (the account and sign-in are real).
const AUTH_STATE = "test-results/.sp-ui-04-auth.json"
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

// A gold avatar preset must not bring gold into the interface.
async function mockAccount(page: Page) {
  await page.route(/\/auth\/me$/, async (route) => {
    const response = await route.fetch()
    return route.fulfill({ response, json: { ...(await response.json()), avatar_key: "gold", player_name: "Tom Wales" } })
  })
}

async function open(page: Page, path: string, scheme: "light" | "dark") {
  await page.emulateMedia({ colorScheme: scheme, reducedMotion: "reduce" })
  await mockAccount(page)
  await mockShelf(page)
  await mockDiscover(page)
  await page.goto(path)
  await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible()
  await page.waitForLoadState("networkidle")
  await page.waitForFunction(() => !document.querySelector('[aria-busy="true"]'))
}

async function dangerColour(page: Page) {
  return page.evaluate(() => {
    const probe = document.createElement("i")
    probe.style.color = "var(--color-danger)"
    document.body.append(probe)
    const value = getComputedStyle(probe).color
    probe.remove()
    return value
  })
}

for (const scheme of ["light", "dark"] as const) {
  test.describe(`Discover (${scheme})`, () => {
    test("no Hot now badge; one labelled Want to Play button per card; the rest sit in an overflow menu", async ({ page }) => {
      await open(page, "/discover", scheme)
      await expect(page.getByText("Hot now")).toHaveCount(0)
      const cards = page.locator(".discover-card")
      expect(await cards.count()).toBeGreaterThan(3)
      for (const card of await cards.all()) {
        // Want to Play (or Saved) plus the overflow button, and nothing else to tap.
        await expect(card.getByRole("button")).toHaveCount(2)
        await expect(card.getByRole("button", { name: /Want to Play/ })).toHaveCount(1)
        await expect(card.getByRole("link")).toHaveCount(0)
      }
      for (const label of ["Why it’s trending", "BGG", "Hide"]) await expect(page.getByText(label, { exact: true })).toHaveCount(0)

      const first = cards.first()
      await first.getByRole("button", { name: /More options for Clockwork Market/ }).click()
      const menu = page.getByRole("menu", { name: /More options for Clockwork Market/ })
      await expect(menu.getByRole("menuitem")).toHaveText(["Why it’s trending", "View on BGG", "Hide"])
      await expect(menu.getByRole("menuitem", { name: "View on BGG" })).toHaveAttribute("href", /boardgamegeek\.com\/boardgame\/1000$/)
      // Escape closes the menu and gives focus back to its button.
      await page.keyboard.press("Escape")
      await expect(menu).toHaveCount(0)
      await expect(first.getByRole("button", { name: /More options for Clockwork Market/ })).toBeFocused()
    })

    test("Hide is only in the menu, is destructive, and shows an undo that restores the card", async ({ page }) => {
      await open(page, "/discover", scheme)
      const names = await page.locator(".discover-card h2").allTextContents()
      await page.getByRole("button", { name: /More options for Clockwork Market/ }).click()
      const hide = page.getByRole("menuitem", { name: "Hide" })
      expect(await hide.evaluate((element) => getComputedStyle(element).color)).toBe(await dangerColour(page))
      await hide.click()
      const toast = page.getByRole("status").filter({ hasText: "Hidden Clockwork Market" })
      await expect(toast).toBeVisible()
      await expect(page.locator(".discover-card h2", { hasText: "Clockwork Market" })).toHaveCount(0)
      await toast.getByRole("button", { name: "Undo" }).click()
      await expect(toast).toHaveCount(0)
      expect(await page.locator(".discover-card h2").allTextContents()).toEqual(names)
    })

    test("saving a game to Want to Play is a pressed toggle", async ({ page }) => {
      await open(page, "/discover", scheme)
      await page.route(/\/wishlist/, (route) => route.fulfill({ status: 200, json: {} }))
      const save = page.getByRole("button", { name: "Save Clockwork Market to Want to Play" })
      await expect(save).toHaveAttribute("aria-pressed", "false")
      await save.click()
      await expect(page.getByRole("button", { name: "Remove Clockwork Market from Want to Play" })).toHaveAttribute("aria-pressed", "true")
    })

    test("every interactive target on Discover is at least 44x44", async ({ page }) => {
      await open(page, "/discover", scheme)
      await page.getByRole("button", { name: /More options for Clockwork Market/ }).click()
      const small = await page.evaluate(() => Array.from(document.querySelectorAll<HTMLElement>("button, a[href], input, select, [role=menuitem]"))
        .filter((element) => getComputedStyle(element).visibility !== "hidden" && element.getClientRects().length > 0)
        .map((element) => ({ name: `${element.tagName.toLowerCase()} "${(element.getAttribute("aria-label") ?? element.textContent ?? "").trim().slice(0, 40)}"`, box: element.getBoundingClientRect() }))
        .filter(({ box }) => box.width < 44 || box.height < 44)
        .map(({ name, box }) => `${name} ${Math.round(box.width)}x${Math.round(box.height)}`))
      expect(small).toEqual([])
    })

    test("the Want to Play list is a quiet text link under the lists, not a header pill", async ({ page }) => {
      await open(page, "/discover", scheme)
      const link = page.getByRole("button", { name: "Want to Play", exact: true })
      const modes = page.getByRole("group", { name: "Discover lists" })
      const [linkBox, modesBox] = [await link.boundingBox(), await modes.boundingBox()]
      expect(linkBox!.y).toBeGreaterThanOrEqual(modesBox!.y + modesBox!.height)
      expect((await paint(page, ".discover-wishlist", "backgroundColor"))[3]).toBe(0)
      await link.click()
      await expect(page).toHaveURL(/\/shelf/)
    })

    test("For You carries a quiet neutral Pro tag, no gold anywhere, and the avatar covers nothing", async ({ page }) => {
      await open(page, "/discover", scheme)
      expect(await goldOffenders(page, [".discover-screen", ".app-top-bar", ".app-nav"])).toEqual([])
      expect(await avatarCollisions(page)).toEqual([])
      const tag = page.locator(".pro-tag")
      await expect(tag).toHaveText("Pro")
      expect((await paint(page, ".pro-tag", "backgroundColor"))[3]).toBe(0)
      expect(contrast(await paint(page, ".pro-tag", "color"), await surfaceBehind(page, ".pro-tag"))).toBeGreaterThanOrEqual(4.5)
    })
  })

  test.describe(`Shelf (${scheme})`, () => {
    test("the count and Add game share a row; the count is secondary text", async ({ page }) => {
      await open(page, "/shelf", scheme)
      const count = page.locator(".shelf-count")
      const add = page.getByRole("button", { name: "Add game" })
      await expect(count).toHaveText("9 games")
      const [countBox, addBox] = [await count.boundingBox(), await add.boundingBox()]
      expect(Math.abs((countBox!.y + countBox!.height / 2) - (addBox!.y + addBox!.height / 2))).toBeLessThanOrEqual(2)
      expect(addBox!.height).toBeGreaterThanOrEqual(44)
      const support = await page.evaluate(() => {
        const probe = document.createElement("i")
        probe.style.color = "var(--color-text-support)"
        document.body.append(probe)
        const value = getComputedStyle(probe).color
        probe.remove()
        return value
      })
      expect(await count.evaluate((element) => getComputedStyle(element).color)).toBe(support)
      await add.click()
      await expect(page.getByRole("search").or(page.getByLabel(/Search BoardGameGeek|Search for a game/i)).first()).toBeVisible()
    })

    test("search, sort and layout are one aligned 40pt row; search has an icon and a name", async ({ page }) => {
      await open(page, "/shelf", scheme)
      const search = page.getByRole("searchbox", { name: "Search your games" })
      const sort = page.getByRole("combobox", { name: "Sort games" })
      const layout = page.getByRole("button", { name: /Show as (list|grid)/ })
      const boxes = [await search.boundingBox(), await sort.boundingBox(), await layout.boundingBox()]
      const [searchBox, sortBox, layoutBox] = boxes
      for (const box of boxes) expect(Math.abs(box!.height - 40)).toBeLessThanOrEqual(1)
      expect(Math.max(...boxes.map((box) => box!.height)) - Math.min(...boxes.map((box) => box!.height))).toBeLessThanOrEqual(1)
      // One row: the controls share a top edge.
      expect(Math.abs(searchBox!.y - sortBox!.y)).toBeLessThanOrEqual(1)
      expect(Math.abs(sortBox!.y - layoutBox!.y)).toBeLessThanOrEqual(1)
      await expect(page.locator(".shelf-search svg")).toBeVisible()
      // The search field has a border, so it reads as a control on both themes.
      expect(await search.evaluate((element) => getComputedStyle(element).borderTopWidth)).toBe("1px")
      expect(await search.evaluate((element) => getComputedStyle(element).borderTopColor)).not.toBe("rgba(0, 0, 0, 0)")
    })

    test("grid and list thumbnails share one square cover-fit crop", async ({ page }) => {
      await open(page, "/shelf", scheme)
      const grid = await page.evaluate(() => Array.from(document.querySelectorAll<HTMLElement>(".collection-tile-cover")).map((cover) => {
        const box = cover.getBoundingClientRect()
        return { ratio: Math.round(box.width / box.height * 100) / 100, fit: getComputedStyle(cover.querySelector("img")!).objectFit }
      }))
      expect(grid.length).toBeGreaterThan(3)
      for (const tile of grid) expect(tile).toEqual({ ratio: 1, fit: "cover" })
      await page.getByRole("button", { name: "Show as list" }).click()
      const list = await page.evaluate(() => Array.from(document.querySelectorAll<HTMLElement>(".collection-thumb")).map((thumb) => {
        const box = thumb.getBoundingClientRect()
        return { ratio: Math.round(box.width / box.height * 100) / 100, fit: getComputedStyle(thumb.querySelector("img")!).objectFit }
      }))
      expect(list.length).toBeGreaterThan(3)
      for (const thumb of list) expect(thumb).toEqual({ ratio: 1, fit: "cover" })
    })

    test("play counts are plain secondary text in the grid and the list", async ({ page }) => {
      await open(page, "/shelf", scheme)
      for (const layout of ["grid", "list"] as const) {
        if (layout === "list") await page.getByRole("button", { name: "Show as list" }).click()
        const plays = page.locator(".collection-plays").first()
        await expect(plays).toHaveText(/^\d+ plays?$/)
        expect((await paint(page, ".collection-plays", "backgroundColor"))[3]).toBe(0)
        expect(await plays.evaluate((element) => getComputedStyle(element).borderTopWidth)).toBe("0px")
        expect(contrast(await paint(page, ".collection-plays", "color"), await surfaceBehind(page, ".collection-plays"))).toBeGreaterThanOrEqual(4.5)
      }
    })

    test("no gold on Shelf, and the avatar is neutral and covers nothing", async ({ page }) => {
      await open(page, "/shelf", scheme)
      expect(await goldOffenders(page, [".collection-screen", ".app-top-bar", ".app-nav"])).toEqual([])
      expect(await avatarCollisions(page)).toEqual([])
    })
  })

  test(`every segmented control and chip row is the shared component, with a clear selected state (${scheme})`, async ({ page }, testInfo) => {
    const report: string[] = []
    for (const path of ["/shelf", "/discover"]) {
      await open(page, path, scheme)
      // No hand-made segmented controls or chip rows beside the shared one.
      expect(await page.locator(".app-content").evaluate((root) => Array.from(root.querySelectorAll("[role=tablist], [role=tab], .segmented-control, .filter-tabs, .discover-tab, .stats-section-tab")).length)).toBe(0)
      const groups = page.locator(".choice-group")
      expect(await groups.count()).toBeGreaterThan(0)
      for (const group of await groups.all()) {
        const name = (await group.getAttribute("aria-label")) ?? ""
        await expect(group).toHaveAttribute("role", "group")
        expect(name, `${path}: a choice group needs a name`).not.toBe("")
        // Exactly one option is selected and says so; the others are not pressed.
        await expect(group.locator(".choice")).not.toHaveCount(0)
        await expect(group.locator(".choice.selected")).toHaveCount(1)
        await expect(group.locator(".choice[aria-pressed=true]")).toHaveCount(1)
        await expect(group.locator(".choice:not(.selected)[aria-pressed=false]")).toHaveCount((await group.locator(".choice").count()) - 1)

        const measured = await group.evaluate((element, source) => {
          const resolve = new Function(`return ${source}`)() as (value: string) => number[]
          const behind = (node: Element) => {
            for (let current: Element | null = node; current; current = current.parentElement) {
              const color = resolve(getComputedStyle(current).backgroundColor)
              if (color[3] > 0.9) return color
            }
            return resolve(getComputedStyle(document.body).backgroundColor)
          }
          const selected = element.querySelector(".choice.selected")!
          const other = element.querySelector(".choice:not(.selected)")!
          const ring = /rgba?\([^)]*\)/.exec(getComputedStyle(selected).boxShadow)![0]
          return {
            ring: resolve(ring),
            selectedText: resolve(getComputedStyle(selected).color),
            selectedFill: resolve(getComputedStyle(selected).backgroundColor),
            otherText: resolve(getComputedStyle(other).color),
            otherSurface: behind(other),
            otherFill: resolve(getComputedStyle(other).backgroundColor),
          }
        }, `(value) => {
          const canvas = document.createElement("canvas"); canvas.width = canvas.height = 1
          const context = canvas.getContext("2d"); context.clearRect(0, 0, 1, 1); context.fillStyle = value; context.fillRect(0, 0, 1, 1)
          const [r, g, b, a] = context.getImageData(0, 0, 1, 1).data
          return [r, g, b, a / 255]
        }`)
        // Unselected options have no fill of their own; selected is Forest text on a Forest-soft fill.
        expect(measured.otherFill[3], `${name}: unselected is transparent`).toBe(0)
        const edge = contrast(measured.ring, measured.otherSurface)
        const selectedText = contrast(measured.selectedText, measured.selectedFill)
        const otherText = contrast(measured.otherText, measured.otherSurface)
        report.push(`${name}: edge ${edge.toFixed(2)}, selected text ${selectedText.toFixed(2)}, unselected text ${otherText.toFixed(2)}`)
        expect(edge, `${name}: selected edge against the unselected surface`).toBeGreaterThanOrEqual(3)
        expect(selectedText, `${name}: selected text`).toBeGreaterThanOrEqual(4.5)
        expect(otherText, `${name}: unselected text`).toBeGreaterThanOrEqual(4.5)
      }
    }
    testInfo.annotations.push({ type: "contrast", description: `${scheme}: ${report.join("; ")}` })
  })
}
