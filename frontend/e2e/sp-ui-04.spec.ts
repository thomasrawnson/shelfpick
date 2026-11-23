import { expect, test, type Page } from "@playwright/test"

import { contrast, goldOffenders, paint, surfaceBehind } from "./colour"
import { ANALYTICS_ANSWERED, API_ORIGIN, logIn } from "./support"
import { avatarCollisions, mockDiscover, mockShelf, mockStatsFeed } from "./ui-fixtures"

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
  await mockStatsFeed(page, API_ORIGIN)
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

    test("no gold on Shelf (Owned, Want to Play and Ranking), and the avatar is neutral and covers nothing", async ({ page }) => {
      await open(page, "/shelf", scheme)
      expect(await goldOffenders(page, [".collection-screen", ".app-top-bar", ".app-nav"])).toEqual([])
      expect(await avatarCollisions(page)).toEqual([])
      const sections = page.getByRole("group", { name: "Collection section" })
      for (const name of ["Want to Play", "Ranking"]) {
        await sections.getByRole("button", { name, exact: true }).click()
        await page.waitForLoadState("networkidle")
        expect(await goldOffenders(page, [".collection-screen", ".app-top-bar"]), `${name}: gold`).toEqual([])
        expect(await avatarCollisions(page), `${name}: avatar overlap`).toEqual([])
      }
    })
  })

  test(`every segmented control and chip row is the shared component, with a clear selected state (${scheme})`, async ({ page }, testInfo) => {
    const report: string[] = []
    for (const path of ["/shelf", "/discover", "/stats", "/plays"]) {
      await open(page, path, scheme)
      // No hand-made segmented controls or chip rows beside the shared one.
      expect(await page.locator(".app-content").evaluate((root) => Array.from(root.querySelectorAll("[role=tablist], [role=tab], .segmented-control, .filter-tabs, .discover-tab, .stats-section-tab, .plays-range button")).length)).toBe(0)
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

// ---- Stats ----
const STATS_SECTIONS = ["Trends", "Collection", "Play", "Players", "Recaps"] as const

async function openSection(page: Page, name: string) {
  const tab = page.getByRole("group", { name: "Stats sections" }).getByRole("button", { name, exact: true })
  await tab.click()
  await expect(tab).toHaveAttribute("aria-pressed", "true")
  await page.waitForLoadState("networkidle")
  await page.waitForFunction(() => !document.querySelector('[aria-busy="true"]'))
}

// Bordered boxes (all four sides) that sit inside another bordered box.
function nestedCards(page: Page) {
  return page.evaluate(() => {
    const boxed = (element: Element) => {
      const style = getComputedStyle(element)
      return ["Top", "Right", "Bottom", "Left"].every((side) => parseFloat(style[`border${side}Width` as "borderTopWidth"]) > 0 && style[`border${side}Style` as "borderTopStyle"] !== "none")
        && !["INPUT", "SELECT", "BUTTON", "SUMMARY", "TEXTAREA"].includes(element.tagName)
        // A small tag (Pro) is not a card.
        && element.getBoundingClientRect().height > 40
    }
    const found: string[] = []
    for (const element of document.querySelectorAll(".insights-screen *")) {
      if (!boxed(element)) continue
      for (let parent = element.parentElement; parent && !parent.matches(".insights-screen"); parent = parent.parentElement) {
        if (boxed(parent)) { found.push(`${element.tagName.toLowerCase()}.${element.className} inside ${parent.tagName.toLowerCase()}.${parent.className}`); break }
      }
    }
    return found
  })
}

for (const scheme of ["light", "dark"] as const) {
  test.describe(`Stats (${scheme})`, () => {
    test("no duplicate Trends heading, left-aligned tiles with primary-text numbers, flat rows with chevrons", async ({ page }) => {
      await open(page, "/stats", scheme)
      await expect(page.getByRole("heading", { name: "Trends" })).toHaveCount(0)
      await expect(page.getByRole("group", { name: "Stats sections" }).getByRole("button", { name: "Trends", exact: true })).toHaveAttribute("aria-pressed", "true")
      await expect(page.getByRole("region", { name: "Trends" })).toBeVisible()

      const tile = page.locator(".stat-card").first()
      const tileBox = (await tile.boundingBox())!
      const number = (await tile.locator("strong").boundingBox())!
      const label = (await tile.locator("span").boundingBox())!
      expect(number.x - tileBox.x, "number sits at the tile's left padding").toBeLessThanOrEqual(20)
      expect(Math.abs(number.x - label.x), "number and label share a left edge").toBeLessThanOrEqual(1)
      expect(await tile.locator("small").evaluate((element) => getComputedStyle(element).textAlign)).toMatch(/left|start/)
      const primary = await page.evaluate(() => {
        const probe = document.createElement("i")
        probe.style.color = "var(--color-text-primary)"
        document.body.append(probe)
        const value = getComputedStyle(probe).color
        probe.remove()
        return value
      })
      for (const element of await page.locator(".stat-card strong").all()) {
        expect(await element.evaluate((node) => getComputedStyle(node).color)).toBe(primary)
      }

      // "Play these to reach N": flat rows between hairlines, a chevron each, nothing boxed inside the card.
      const rows = page.locator(".stats-raise-game")
      await expect(rows).toHaveCount(2)
      for (const row of await rows.all()) {
        expect((await row.evaluate((node) => { const style = getComputedStyle(node); return [style.backgroundColor, style.borderTopWidth, style.borderBottomWidth] }))).toEqual(["rgba(0, 0, 0, 0)", "0px", "0px"])
        await expect(row.locator("svg.stats-row-chevron")).toBeVisible()
      }
      expect(await page.locator(".stats-raise-list li + li").first().evaluate((node) => getComputedStyle(node).borderTopWidth)).toBe("1px")
      expect(await nestedCards(page)).toEqual([])
    })

    test("every section has no nested cards, no gold, and the avatar covers nothing", async ({ page }) => {
      await open(page, "/stats", scheme)
      for (const name of STATS_SECTIONS) {
        await openSection(page, name)
        expect(await nestedCards(page), `${name}: nested cards`).toEqual([])
        expect(await goldOffenders(page, [".insights-screen", ".app-top-bar", ".app-nav"]), `${name}: gold`).toEqual([])
        expect(await avatarCollisions(page), `${name}: avatar overlap`).toEqual([])
      }
    })

    test("the 12 / 24 month toggle is the shared control", async ({ page }) => {
      await open(page, "/stats", scheme)
      const toggle = page.getByRole("group", { name: "Months shown" })
      await expect(toggle.locator(".choice")).toHaveCount(2)
      await expect(toggle.getByRole("button", { name: "12 months" })).toHaveAttribute("aria-pressed", "true")
      await toggle.getByRole("button", { name: "24 months" }).click()
      await expect(toggle.getByRole("button", { name: "24 months" })).toHaveAttribute("aria-pressed", "true")
    })
  })

  // ---- Plays ----
  test.describe(`Plays (${scheme})`, () => {
    test("at least four rows are visible on the first screen; filters are one row of menus with chips beneath", async ({ page }) => {
      await open(page, "/plays", scheme)
      await expect(page.locator(".plays-card").first()).toBeVisible()
      const navTop = (await page.getByRole("navigation", { name: "Primary" }).boundingBox())!.y
      const visible = await page.locator(".plays-card").evaluateAll((cards, floor) => cards.filter((card) => {
        const box = card.getBoundingClientRect()
        return box.top >= 0 && box.bottom <= floor
      }).length, navTop)
      expect(visible, "plays rows fully visible above the tab bar").toBeGreaterThanOrEqual(4)

      const game = (await page.getByLabel("Game", { exact: true }).boundingBox())!
      const player = (await page.getByLabel("Player", { exact: true }).boundingBox())!
      const chips = (await page.getByRole("group", { name: "Date range" }).boundingBox())!
      expect(Math.abs(game.y - player.y)).toBeLessThanOrEqual(1)
      expect(Math.abs(game.height - 40)).toBeLessThanOrEqual(1)
      expect(Math.abs(game.height - player.height)).toBeLessThanOrEqual(1)
      expect(chips.y).toBeGreaterThanOrEqual(game.y + game.height)
      expect(await avatarCollisions(page)).toEqual([])
    })

    test("date chips are the shared control", async ({ page }) => {
      await open(page, "/plays", scheme)
      const range = page.getByRole("group", { name: "Date range" })
      await expect(range.locator(".choice")).toHaveCount(3)
      await expect(range.getByRole("button", { name: "All time" })).toHaveAttribute("aria-pressed", "true")
      await range.getByRole("button", { name: "30 days" }).click()
      await expect(range.getByRole("button", { name: "30 days" })).toHaveAttribute("aria-pressed", "true")
      await expect(range.getByRole("button", { name: "All time" })).toHaveAttribute("aria-pressed", "false")
    })

    test("every play row states its result, or says No result logged", async ({ page }) => {
      await open(page, "/plays", scheme)
      const lines = await page.locator(".plays-card-main span").allTextContents()
      expect(lines.length).toBeGreaterThan(5)
      for (const line of lines) expect(line).toMatch(/ · (Won by .+|Won together|Lost together|No result logged)$/)
      expect(lines.some((line) => line.endsWith("No result logged"))).toBe(true)
      expect(await goldOffenders(page, [".plays-screen", ".app-top-bar", ".app-nav"])).toEqual([])
    })
  })

  test(`every tab keeps the same title row, and the avatar covers no control (${scheme})`, async ({ page }) => {
    const rows: Record<string, { top: number; height: number; baseline: number }> = {}
    for (const [tab, path] of [["Shelf", "/shelf"], ["Plays", "/plays"], ["Discover", "/discover"], ["Stats", "/stats"], ["Tonight", "/tonight"]] as const) {
      await open(page, path, scheme)
      await page.waitForTimeout(200)
      expect(await avatarCollisions(page), `${tab}: avatar overlap`).toEqual([])
      expect(await goldOffenders(page, [".app-top-bar", ".app-nav"]), `${tab}: gold in the chrome`).toEqual([])
      rows[tab] = await page.evaluate(() => {
        const header = document.querySelector(".screen > header")!.getBoundingClientRect()
        // First line of the title row: the heading, or Tonight's label above its headline.
        const title = document.querySelector(".screen > header .tonight-label, .screen > header h1")!
        const range = document.createRange()
        range.selectNodeContents(title)
        const text = range.getBoundingClientRect()
        return { top: header.top, height: header.height, baseline: text.bottom }
      })
    }
    const four = ["Shelf", "Plays", "Discover", "Stats"].map((tab) => rows[tab])
    for (const row of four) {
      expect(Math.abs(row.top - four[0].top), `title row top ${JSON.stringify(rows)}`).toBeLessThanOrEqual(1)
      expect(Math.abs(row.height - four[0].height), `title row height ${JSON.stringify(rows)}`).toBeLessThanOrEqual(1)
      expect(Math.abs(row.baseline - four[0].baseline), `title baseline ${JSON.stringify(rows)}`).toBeLessThanOrEqual(1)
    }
    expect(Math.abs(rows.Tonight.top - four[0].top), "Tonight's header starts on the same line").toBeLessThanOrEqual(1)
  })
}

// ---- Dynamic Type: all five tabs ----
const AX = [{ name: "AX1", px: 28 }, { name: "AX3", px: 40 }, { name: "AX5", px: 53 }]

for (const size of AX) {
  test(`Dynamic Type ${size.name}: all five tabs keep labels whole, the title clear and controls inside the screen`, async ({ page }) => {
    await page.addInitScript((px) => {
      document.addEventListener("DOMContentLoaded", () => {
        document.documentElement.dataset.nativeIos = "true"
        const style = document.createElement("style")
        style.textContent = `:root[data-native-ios] { font-size: ${px}px !important; }`
        document.head.append(style)
      })
    }, size.px)
    for (const [tab, path] of [["Tonight", "/tonight"], ["Shelf", "/shelf"], ["Plays", "/plays"], ["Discover", "/discover"], ["Stats", "/stats"]] as const) {
      await open(page, path, "light")
      await page.waitForTimeout(250)
      const report = await page.evaluate(() => {
        const problems: string[] = []
        const clipped = (element: Element) => element.scrollWidth > element.clientWidth + 1 || element.scrollHeight > element.clientHeight + 1
        const overflow = document.documentElement.scrollWidth - document.documentElement.clientWidth
        if (overflow > 0) problems.push(`page scrolls sideways by ${overflow}px`)
        // The title is never clipped, whatever it wraps to.
        for (const heading of document.querySelectorAll(".app-content h1")) {
          const box = heading.getBoundingClientRect()
          if (clipped(heading) || box.right > window.innerWidth + 1) problems.push(`heading clipped: ${heading.textContent}`)
        }
        // Every option of a choice group shows its whole label.
        for (const choice of document.querySelectorAll(".choice")) {
          if (choice.scrollWidth > choice.clientWidth + 1) problems.push(`choice clipped: ${choice.textContent}`)
          const range = document.createRange()
          range.selectNodeContents(choice)
          const lines = new Set(Array.from(range.getClientRects()).filter((rect) => rect.width > 0).map((rect) => Math.round(rect.top)))
          for (const word of (choice.textContent ?? "").split(/\s+/).filter(Boolean)) {
            const walker = document.createTreeWalker(choice, NodeFilter.SHOW_TEXT)
            while (walker.nextNode()) {
              const node = walker.currentNode as Text
              const at = node.data.indexOf(word)
              if (at < 0) continue
              const wordRange = document.createRange()
              wordRange.setStart(node, at)
              wordRange.setEnd(node, at + word.length)
              if (new Set(Array.from(wordRange.getClientRects()).map((rect) => Math.round(rect.top))).size > 1) problems.push(`word broken: ${word}`)
            }
          }
          void lines
        }
        // The Shelf count and Add game each stay on one line (they wrap as units, not word by word).
        for (const unit of document.querySelectorAll(".shelf-count-row > *")) {
          const range = document.createRange()
          range.selectNodeContents(unit)
          if (new Set(Array.from(range.getClientRects()).map((rect) => Math.round(rect.top))).size > 1) problems.push(`wrapped: ${unit.textContent}`)
        }
        // Controls in the toolbar and filters stay inside the screen (a scrolling tab row may extend, not its container).
        for (const control of document.querySelectorAll(".shelf-toolbar > *, .plays-filters > *, .shelf-count-row > *, .discover-card .choice, .stat-card")) {
          const box = control.getBoundingClientRect()
          if (box.width > 0 && (box.left < -1 || box.right > window.innerWidth + 1)) problems.push(`outside screen: ${control.className}`)
        }
        return problems
      })
      expect(report, `${tab} at ${size.name}`).toEqual([])
      expect(await avatarCollisions(page), `${tab} at ${size.name}: avatar overlap`).toEqual([])
    }
  })
}

test("Dynamic Type AX5: the Stats tab row scrolls sideways instead of clipping, and reaches the last tab", async ({ page }) => {
  await page.addInitScript(() => {
    document.addEventListener("DOMContentLoaded", () => {
      document.documentElement.dataset.nativeIos = "true"
      const style = document.createElement("style")
      style.textContent = ":root[data-native-ios] { font-size: 53px !important; }"
      document.head.append(style)
    })
  })
  await open(page, "/stats", "light")
  const row = page.getByRole("group", { name: "Stats sections" })
  const scrolls = await row.evaluate((element) => ({ overflowX: getComputedStyle(element).overflowX, wider: element.scrollWidth > element.clientWidth }))
  expect(scrolls).toEqual({ overflowX: "auto", wider: true })
  const last = row.getByRole("button", { name: "Recaps", exact: true })
  await last.scrollIntoViewIfNeeded()
  await last.click()
  await expect(last).toHaveAttribute("aria-pressed", "true")
  // The chosen tab is brought into view and its label is whole.
  const inside = await last.evaluate((element) => {
    const box = element.getBoundingClientRect()
    const parent = element.parentElement!.getBoundingClientRect()
    return box.left >= parent.left - 1 && box.right <= parent.right + 1 && element.scrollWidth <= element.clientWidth + 1
  })
  expect(inside).toBe(true)
})

test("at the default text size all five Stats tabs fit without scrolling", async ({ page }) => {
  await open(page, "/stats", "light")
  const row = page.getByRole("group", { name: "Stats sections" })
  expect(await row.evaluate((element) => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(0)
  for (const name of STATS_SECTIONS) {
    const box = (await row.getByRole("button", { name, exact: true }).boundingBox())!
    expect(box.x + box.width, `${name} is inside the screen`).toBeLessThanOrEqual(390)
  }
})
