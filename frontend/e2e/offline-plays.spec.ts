import { execFileSync } from "node:child_process"
import path from "node:path"

import { expect, test, type Page } from "@playwright/test"

import { API_ORIGIN, BACKEND_DIR, LOCAL_PASSWORD, backendEnv, backendPython, logIn } from "./support"

// SP-NATIVE-01c: log plays with no connection, and sync them exactly once. Real local backend with
// the built-in scoresheets seeded; the connection is cut and restored with the browser context's
// offline switch. Light and dark at 390x844.
const EMAIL = "local-free@shelfpick.app"
const SHOTS = "../docs/screenshots/sp-native-01c"

test.use({ viewport: { width: 390, height: 844 } })

test.beforeAll(() => {
  execFileSync(backendPython(), [path.join(BACKEND_DIR, "../frontend/e2e/scoresheet_games.py")], {
    cwd: BACKEND_DIR,
    env: { ...backendEnv(), PYTHONPATH: BACKEND_DIR },
    encoding: "utf8",
  })
})

const sheet = (page: Page) => page.getByRole("dialog")
const keypad = (page: Page) => sheet(page).locator(".math-keyboard")

async function addPlayers(page: Page, names: string[]) {
  for (const name of names) {
    await sheet(page).getByLabel("Add player").fill(name)
    await sheet(page).getByLabel("Add player").press("Enter")
  }
}

async function enter(page: Page, row: string, player: string, expression: string) {
  await sheet(page).getByRole("button", { name: new RegExp(`^${row}, ${player}:`) }).click()
  await keypad(page).getByRole("button", { name: "Clear", exact: true }).click()
  for (const char of expression) await keypad(page).getByRole("button", { name: char, exact: true }).click()
  await keypad(page).getByRole("button", { name: "Done", exact: true }).click()
}

const tab = (page: Page, name: string) => page.getByRole("button", { name, exact: true })

function playWith(page: Page, name: string) {
  return page.locator(".recent-play-detail", { hasText: name })
}

async function openWingspan(page: Page) {
  await tab(page, "Shelf").click()
  await page.getByText("Wingspan").first().click()
  await expect(page.getByRole("button", { name: "Log a play" })).toBeVisible()
}

// What the server holds for Wingspan, through the signed-in session.
async function serverPlaysNamed(page: Page, name: string): Promise<number> {
  const token = await page.evaluate(() => localStorage.getItem("boardgamepicker_access_token"))
  const response = await page.request.get(`${API_ORIGIN}/games/266192/plays`, { headers: { Authorization: `Bearer ${token}` } })
  const history = await response.json() as { recent_plays: Array<{ participants: Array<{ name: string }> }> }
  return history.recent_plays.filter((play) => play.participants.some((participant) => participant.name === name)).length
}

// Delete play lives in the play's "…" menu and always asks first.
async function deletePlayWith(page: Page, name: string) {
  await playWith(page, name).getByRole("button", { name: /More options for the .* play/ }).click()
  await page.getByRole("menuitem", { name: "Delete play" }).click()
  await page.getByRole("alertdialog", { name: "Delete this play?" }).getByRole("button", { name: "Delete play" }).click()
  await expect(page.getByRole("alertdialog", { name: "Delete this play?" })).toHaveCount(0)
}

async function logThreePlayerSheetPlay(page: Page, ana: string, ben: string, cy: string) {
  await page.getByRole("button", { name: "Log a play" }).click()
  await addPlayers(page, [ana, ben, cy])
  await sheet(page).getByRole("button", { name: "Use scoresheet" }).click()
  await enter(page, "Birds", ana, "52")
  await enter(page, "Birds", ben, "48")
  await enter(page, "Birds", cy, "30")
}

for (const scheme of ["light", "dark"] as const) {
  test.describe(`Offline play logging (${scheme})`, () => {
    test.beforeEach(async ({ page }, testInfo) => {
      test.skip(testInfo.project.name !== "iPhone 15", "one phone-size project is enough")
      await page.emulateMedia({ colorScheme: scheme })
    })

    test("log a three-player scoresheet play offline, see it pending, then sync it exactly once", async ({ page, context }) => {
      await logIn(page, EMAIL, LOCAL_PASSWORD)
      await expect(page).not.toHaveURL(/\/login/)
      const stamp = Date.now().toString(36)
      const [ana, ben, cy] = [`Ana ${stamp}`, `Ben ${stamp}`, `Cy ${stamp}`]

      // Online first: opening the shelf, the game and the log sheet saves what they need.
      await openWingspan(page)
      await page.getByRole("button", { name: "Log a play" }).click()
      await expect(sheet(page).getByRole("button", { name: "Use scoresheet" })).toBeVisible()
      await sheet(page).getByRole("button", { name: "Cancel" }).click()
      await tab(page, "Plays").click()
      await expect(page.getByRole("heading", { name: "Plays", exact: true })).toBeVisible()

      const posts: number[] = []
      page.on("response", (response) => {
        if (response.request().method() === "POST" && new URL(response.url()).pathname === "/plays") posts.push(response.status())
      })

      await context.setOffline(true)

      // Screens that need the server say so, and point at what still works.
      for (const feature of ["Tonight", "Discover", "Stats"]) {
        await tab(page, feature).click()
        await expect(page.getByRole("heading", { name: `${feature} needs a connection` })).toBeVisible()
      }
      await page.waitForTimeout(400)
      await page.screenshot({ path: `${SHOTS}/needs-connection-${scheme}.png` })

      // The shelf is still there, from the saved copy, and says how old it is.
      await tab(page, "Shelf").click()
      await expect(page.getByText("Wingspan").first()).toBeVisible()
      await expect(page.getByText(/Offline · your shelf last updated/)).toBeVisible()
      await page.getByText("Wingspan").first().click()
      await expect(page.getByRole("button", { name: "Log a play" })).toBeVisible()

      await logThreePlayerSheetPlay(page, ana, ben, cy)
      await sheet(page).getByRole("button", { name: "Save play" }).click()
      await expect(sheet(page).getByText("Saved on this device")).toBeVisible()
      await expect(sheet(page).getByText("It will sync when you're back online.")).toBeVisible()
      await expect(sheet(page).getByRole("link", { name: "Send to BG Stats" })).toHaveCount(0)
      await page.screenshot({ path: `${SHOTS}/saved-on-device-${scheme}.png` })
      await sheet(page).getByRole("button", { name: "Done" }).click()

      // Pending in the game's history and in the banner; nothing reached the server.
      const pending = playWith(page, ana)
      await expect(pending.getByText("Pending sync")).toBeVisible()
      await expect(page.getByText("1 play waiting to sync")).toBeVisible()
      await expect(pending.locator(".history-player", { hasText: ben })).toContainText("48")
      await expect(pending.getByRole("link", { name: "Send to BG Stats" })).toHaveCount(0)
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
      await pending.scrollIntoViewIfNeeded()
      await page.waitForTimeout(300)
      await page.screenshot({ path: `${SHOTS}/pending-history-${scheme}.png` })
      expect(posts).toEqual([])

      // It also counts in Plays, labelled pending.
      await tab(page, "Plays").click()
      await expect(page.locator(".plays-card.has-pending")).toHaveCount(1)
      await expect(page.locator(".plays-card.has-pending")).toContainText("Wingspan")
      await expect(page.locator(".plays-card.has-pending")).toContainText("Pending sync")
      await expect(page.locator(".plays-card.has-pending")).toContainText(`Won by ${ana}`)
      await expect(page.locator(".plays-card.has-pending")).toBeVisible()
      await page.waitForTimeout(500)
      await page.screenshot({ path: `${SHOTS}/pending-plays-${scheme}.png` })

      // Back online: it syncs by itself, once.
      await context.setOffline(false)
      await expect(page.getByText("1 play waiting to sync")).toHaveCount(0)
      await expect.poll(() => posts.length).toBe(1)
      expect(posts[0]).toBe(201)
      await expect.poll(() => serverPlaysNamed(page, ana)).toBe(1)

      await openWingspan(page)
      await expect(playWith(page, ana)).toHaveCount(1)
      await expect(playWith(page, ana).getByText("Pending sync")).toHaveCount(0)
      await expect(playWith(page, ana).locator(".history-player", { hasText: ben })).toContainText("48")

      // Nothing is sent again, even after the app is opened afresh.
      await page.reload()
      await expect(page).not.toHaveURL(/\/login/)
      await page.waitForTimeout(500)
      expect(await serverPlaysNamed(page, ana)).toBe(1)
      expect(posts).toHaveLength(1)

      await openWingspan(page)
      await deletePlayWith(page, ana)
    })

    test("a queued play can be edited and deleted on the device before it syncs", async ({ page, context }) => {
      await logIn(page, EMAIL, LOCAL_PASSWORD)
      await expect(page).not.toHaveURL(/\/login/)
      const stamp = Date.now().toString(36)
      const [ana, ben, cy] = [`Ana ${stamp}`, `Ben ${stamp}`, `Cy ${stamp}`]
      await openWingspan(page)
      await page.getByRole("button", { name: "Log a play" }).click()
      await expect(sheet(page).getByRole("button", { name: "Use scoresheet" })).toBeVisible()
      await sheet(page).getByRole("button", { name: "Cancel" }).click()

      await context.setOffline(true)
      await logThreePlayerSheetPlay(page, ana, ben, cy)
      await sheet(page).getByRole("button", { name: "Save play" }).click()
      await expect(sheet(page).getByText("Saved on this device")).toBeVisible()
      await sheet(page).getByRole("button", { name: "Done" }).click()

      // Edit: Cy's Birds becomes 90, which changes who wins.
      await playWith(page, ana).getByRole("button", { name: "Edit" }).click()
      await expect(sheet(page).getByText("Edit play")).toBeVisible()
      await enter(page, "Birds", cy, "90")
      await sheet(page).getByRole("button", { name: "Save changes" }).click()
      await expect(sheet(page)).toBeHidden()
      await expect(playWith(page, ana).locator(".history-player", { hasText: cy })).toContainText("90")
      await expect(playWith(page, ana).getByText("Pending sync")).toBeVisible()
      await expect(page.getByText("1 play waiting to sync")).toBeVisible()

      // Delete it: it never reaches the server.
      await deletePlayWith(page, ana)
      await expect(playWith(page, ana)).toHaveCount(0)
      await expect(page.getByText(/waiting to sync/)).toHaveCount(0)

      await context.setOffline(false)
      await page.waitForTimeout(800)
      expect(await serverPlaysNamed(page, ana)).toBe(0)
    })

    // A play the server will not accept is kept, not lost or retried forever: Retry and a confirmed Discard.
    async function failedPlay(page: Page, context: import("@playwright/test").BrowserContext, ana: string, ben: string, cy: string) {
      await openWingspan(page)
      await page.getByRole("button", { name: "Log a play" }).click()
      await expect(sheet(page).getByRole("button", { name: "Use scoresheet" })).toBeVisible()
      await sheet(page).getByRole("button", { name: "Cancel" }).click()
      // A route answers even while the context is offline, so the refusal starts only when the connection returns.
      const state = { refuse: false }
      await page.route("**/plays", async (route) => {
        if (route.request().method() === "POST" && state.refuse) {
          await route.fulfill({ status: 400, contentType: "application/json", body: JSON.stringify({ detail: "That play can't be saved." }) })
        } else await route.continue()
      })
      await context.setOffline(true)
      await logThreePlayerSheetPlay(page, ana, ben, cy)
      await sheet(page).getByRole("button", { name: "Save play" }).click()
      await expect(sheet(page).getByText("Saved on this device")).toBeVisible()
      await sheet(page).getByRole("button", { name: "Done" }).click()
      state.refuse = true
      await context.setOffline(false)
      await expect(page.getByText("1 play couldn't be saved")).toBeVisible()
      await expect(playWith(page, ana).getByText("Couldn't sync")).toBeVisible()
      await expect(playWith(page, ana).getByText("That play can't be saved.")).toBeVisible()
      return state
    }

    test("a play the server refuses stays as failed; Discard asks first and Retry sends it once the server accepts", async ({ page, context }) => {
      await logIn(page, EMAIL, LOCAL_PASSWORD)
      await expect(page).not.toHaveURL(/\/login/)
      const stamp = Date.now().toString(36)
      const [ana, ben, cy] = [`Ana ${stamp}`, `Ben ${stamp}`, `Cy ${stamp}`]
      const state = await failedPlay(page, context, ana, ben, cy)
      await page.screenshot({ path: `${SHOTS}/failed-banner-${scheme}.png` })
      expect(await serverPlaysNamed(page, ana)).toBe(0)

      await playWith(page, ana).getByRole("button", { name: "Discard", exact: true }).click()
      await expect(playWith(page, ana).getByText("Discard this play? It was never saved.")).toBeVisible()
      await playWith(page, ana).getByRole("button", { name: "Cancel" }).click()
      await expect(playWith(page, ana).getByText("Couldn't sync")).toBeVisible()

      state.refuse = false
      await playWith(page, ana).getByRole("button", { name: "Retry" }).click()
      await expect(page.getByText(/couldn't be saved/)).toHaveCount(0)
      await expect.poll(() => serverPlaysNamed(page, ana)).toBe(1)
      await expect(playWith(page, ana).getByText("Couldn't sync")).toHaveCount(0)
      await deletePlayWith(page, ana)
    })

    test("discarding a failed play removes it for good and it never reaches the server", async ({ page, context }) => {
      await logIn(page, EMAIL, LOCAL_PASSWORD)
      await expect(page).not.toHaveURL(/\/login/)
      const stamp = Date.now().toString(36)
      const [ana, ben, cy] = [`Ana ${stamp}`, `Ben ${stamp}`, `Cy ${stamp}`]
      await failedPlay(page, context, ana, ben, cy)

      await playWith(page, ana).getByRole("button", { name: "Discard", exact: true }).click()
      await playWith(page, ana).getByRole("button", { name: "Discard play" }).click()
      await expect(playWith(page, ana)).toHaveCount(0)
      await expect(page.getByText(/couldn't be saved/)).toHaveCount(0)
      expect(await serverPlaysNamed(page, ana)).toBe(0)

      // Nothing comes back after the app is opened afresh.
      await page.reload()
      await expect(page).not.toHaveURL(/\/login/)
      await openWingspan(page)
      await expect(playWith(page, ana)).toHaveCount(0)
    })

    test("a reply lost after the server saved the play still ends with one play", async ({ page }) => {
      await logIn(page, EMAIL, LOCAL_PASSWORD)
      await expect(page).not.toHaveURL(/\/login/)
      const stamp = Date.now().toString(36)
      const [ana, ben, cy] = [`Ana ${stamp}`, `Ben ${stamp}`, `Cy ${stamp}`]
      await openWingspan(page)
      await page.getByRole("button", { name: "Log a play" }).click()
      await expect(sheet(page).getByRole("button", { name: "Use scoresheet" })).toBeVisible()
      await sheet(page).getByRole("button", { name: "Cancel" }).click()

      // The server receives and saves the play, then the connection drops before the reply arrives.
      let lose = true
      let reachedServer = 0
      await page.route("**/plays", async (route) => {
        if (route.request().method() !== "POST" || !lose) return route.continue()
        await route.fetch()
        reachedServer += 1
        await route.abort("connectionreset")
      })

      await logThreePlayerSheetPlay(page, ana, ben, cy)
      await sheet(page).getByRole("button", { name: "Save play" }).click()
      await expect(sheet(page).getByText("Saved on this device")).toBeVisible()
      // The server has the play although the app never saw the reply, and whatever resends follow
      // (the app retries on its own) still leave one play.
      expect(reachedServer).toBeGreaterThanOrEqual(1)
      expect(await serverPlaysNamed(page, ana)).toBe(1)
      await sheet(page).getByRole("button", { name: "Done" }).click()
      await expect(page.getByText("1 play waiting to sync")).toBeVisible()

      // The reply gets through this time: the server recognises the play and answers 200.
      lose = false
      await page.getByRole("button", { name: "Sync now" }).click()
      await expect(page.getByText(/waiting to sync/)).toHaveCount(0)
      expect(await serverPlaysNamed(page, ana)).toBe(1)
      await expect(playWith(page, ana)).toHaveCount(1)
      await expect(playWith(page, ana).getByText("Pending sync")).toHaveCount(0)

      await deletePlayWith(page, ana)
    })
  })
}
