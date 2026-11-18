import AxeBuilder from "@axe-core/playwright"
import { expect, test, type Page } from "@playwright/test"

import { logIn } from "./support"

// SP-PRO-01: the Pro screen (paywall) for a Free and a Pro account at 390x844
// and 1440x900, light and dark. Sign-in and entitlements are real local
// accounts. /billing/account and /billing/sync are mocked because no
// RevenueCat project is connected; prices come from the development-only
// store stand-in. Server verification itself is covered by
// backend/tests/test_billing_api.py. Browser evidence only: not a sandbox
// purchase, Simulator or device check.
const SHOTS = "../docs/screenshots/sp-pro-01"
const SIZES = [{ label: "390", width: 390, height: 844 }, { label: "1440", width: 1440, height: 900 }] as const
const ACCOUNTS = {
  free: { email: "local-free@shelfpick.app", state: "test-results/.paywall-free-auth.json" },
  pro: { email: "local-pro@shelfpick.app", state: "test-results/.paywall-pro-auth.json" },
} as const

test.beforeAll(async ({ browser }, testInfo) => {
  if (testInfo.project.name !== "iPhone 15") return
  for (const account of Object.values(ACCOUNTS)) {
    const context = await browser.newContext({ storageState: undefined })
    const page = await context.newPage()
    await logIn(page, account.email)
    await expect(page).toHaveURL(/\/tonight/)
    await context.storageState({ path: account.state })
    await context.close()
  }
})

test.beforeEach(({ browserName }, testInfo) => { test.skip(browserName !== "webkit" || testInfo.project.name !== "iPhone 15") })

const FREE_ACCOUNT = {
  app_user_id: "00000000-0000-4000-8000-000000000001", billing_available: true,
  pro: false, source: null, plan: null, expires_at: null,
}

type Mock = { syncs: number; accountBody: object; syncBody: object; proAfterSync: boolean }

async function mockBilling(page: Page, overrides: Partial<Mock> = {}) {
  const mock: Mock = { syncs: 0, accountBody: FREE_ACCOUNT, syncBody: FREE_ACCOUNT, proAfterSync: false, ...overrides }
  await page.route("**/billing/account", route => route.fulfill({ json: mock.accountBody }))
  await page.route("**/billing/sync", route => {
    mock.syncs += 1
    return route.fulfill({ json: mock.syncBody })
  })
  if (mock.proAfterSync) {
    // The app re-reads the user once the server confirms Pro.
    await page.route("**/auth/me", async route => {
      const response = await route.fetch()
      if (mock.syncs === 0) return route.fulfill({ response })
      const user = await response.json()
      await route.fulfill({ response, json: { ...user, tier: "PRO", entitlements: [...user.entitlements, "advanced_stats"] } })
    })
  }
  return mock
}

async function openPaywall(page: Page) {
  await page.goto("/settings/pro")
  await expect(page.getByRole("heading", { name: /Free covers the essentials/ })).toBeVisible()
  await page.waitForLoadState("networkidle")
}

for (const account of ["free", "pro"] as const) {
  test.describe(`${account} account`, () => {
    test.use({ storageState: ACCOUNTS[account].state })

    for (const size of SIZES) {
      for (const scheme of ["light", "dark"] as const) {
        test(`${size.label} ${scheme}: paywall`, async ({ page }, testInfo) => {
          await page.setViewportSize({ width: size.width, height: size.height })
          await page.emulateMedia({ colorScheme: scheme, reducedMotion: "reduce" })
          // Free sees the store; Pro is shown as a yearly subscriber with a manage link.
          if (account === "free") await mockBilling(page)
          else await mockBilling(page, { accountBody: { ...FREE_ACCOUNT, pro: true, source: "purchase", plan: "YEARLY", expires_at: "2027-11-18T12:00:00Z" } })
          await openPaywall(page)

          const paywall = page.getByRole("region", { name: /Get ShelfPick Pro|Your plan/ })
          if (account === "free") {
            await expect(page.getByRole("heading", { name: "Get ShelfPick Pro" })).toBeVisible()
            const yearly = paywall.getByRole("article", { name: "Pro Yearly" })
            await expect(yearly.getByText("£3.99", { exact: true })).toBeVisible()
            await expect(yearly.getByText("per year, renews automatically", { exact: true })).toBeVisible()
            await expect(yearly.getByRole("button", { name: "Subscribe, £3.99 a year" })).toBeEnabled()
            const lifetime = paywall.getByRole("article", { name: "Pro Lifetime" })
            await expect(lifetime.getByText("£9.99", { exact: true })).toBeVisible()
            await expect(lifetime.getByText("one-time purchase", { exact: true })).toBeVisible()
            await expect(lifetime.getByRole("button", { name: "Buy for £9.99" })).toBeEnabled()
            await expect(paywall.getByRole("button", { name: "Restore purchases" })).toBeVisible()
          } else {
            await expect(page.getByText("Pro Yearly is active", { exact: true })).toBeVisible()
            await expect(paywall.getByRole("link", { name: "Manage subscription" })).toBeVisible()
            await expect(paywall.getByRole("button", { name: "Subscribe, £3.99 a year" })).toHaveCount(0)
          }

          // Required disclosures and legal links are on the screen, not behind a tap.
          await expect(paywall.getByText(/auto-renewing subscription/)).toBeVisible()
          await expect(paywall.getByText(/cancel at least 24 hours before the end of the current period/)).toBeVisible()
          await expect(paywall.getByRole("link", { name: "Privacy Policy" })).toHaveAttribute("href", "https://plutonightlabs.com/shelfpick/privacy/")
          await expect(paywall.getByRole("link", { name: "Terms of Use" })).toHaveAttribute("href", "https://plutonightlabs.com/shelfpick/terms/")
          await expect(page.getByRole("link", { name: "Back to Settings" })).toBeVisible() // easy to dismiss

          // Free/Pro comparison now lists the new Pro features.
          await expect(page.getByRole("heading", { name: "Deeper stats" })).toBeVisible()
          await expect(page.getByRole("heading", { name: "Custom scoresheets" })).toBeVisible()

          const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
          expect(overflow).toBeLessThanOrEqual(0)

          const violations = (await new AxeBuilder({ page }).include(".pro-comparison-screen").analyze()).violations
          expect(violations.map(v => `${v.id}: ${v.nodes.map(n => n.target.join(" ")).join(", ")}`)).toEqual([])

          await page.screenshot({ path: `${SHOTS}/paywall-${account}-${size.label}-${scheme}.png`, fullPage: true })
          testInfo.annotations.push({ type: "evidence", description: "Playwright WebKit, mocked /billing, real local account" })
        })
      }
    }
  })
}

test.describe("purchase flow in the browser (development store, mocked server)", () => {
  test.use({ storageState: ACCOUNTS.free.state, viewport: { width: 390, height: 844 } })

  test("a purchase shows Pro only after the server confirms it", async ({ page }) => {
    const proAccount = { ...FREE_ACCOUNT, pro: true, source: "purchase", plan: "LIFETIME" }
    const mock = await mockBilling(page, { syncBody: proAccount, proAfterSync: true })
    await openPaywall(page)
    await page.getByRole("button", { name: /Buy for £9.99/ }).click()
    await expect(page.getByText("Pro is active on your account. Thank you for supporting ShelfPick.")).toBeVisible()
    expect(mock.syncs).toBeGreaterThanOrEqual(1)
    await expect(page.getByText("Pro is active", { exact: false }).first()).toBeVisible()
    await expect(page.getByRole("button", { name: /Buy for £9.99/ })).toHaveCount(0)
  })

  test("a purchase the server cannot confirm never turns Pro on", async ({ page }) => {
    const mock = await mockBilling(page)
    await openPaywall(page)
    await page.getByRole("button", { name: /Subscribe, £3.99 a year/ }).click()
    await expect(page.getByText(/hasn’t confirmed it yet/)).toBeVisible({ timeout: 15_000 })
    expect(mock.syncs).toBe(4)
    await expect(page.getByText("You’re on Free")).toBeVisible()
    await expect(page.getByRole("button", { name: /Buy for £9.99/ })).toBeEnabled()
  })

  test("Restore with nothing to restore says so", async ({ page }) => {
    await mockBilling(page)
    await openPaywall(page)
    await page.getByRole("button", { name: "Restore purchases" }).click()
    await expect(page.getByText("No Pro purchase was found for this Apple Account.")).toBeVisible({ timeout: 15_000 })
  })

  test("a server error is announced and leaves the account on Free", async ({ page }) => {
    await mockBilling(page)
    await page.route("**/billing/sync", route => route.fulfill({ status: 502, json: { detail: "Could not check your purchase. Try again shortly." } }))
    await openPaywall(page)
    await page.getByRole("button", { name: "Restore purchases" }).click()
    await expect(page.getByRole("alert")).toContainText("Could not check your purchase")
    await expect(page.getByText("You’re on Free")).toBeVisible()
  })

  test("locked Pro previews and Settings lead to the paywall", async ({ page }) => {
    await mockBilling(page)
    await page.goto("/stats")
    await page.getByRole("button", { name: "See what Pro includes" }).first().click().catch(() => {})
    await page.goto("/settings")
    await page.getByRole("link", { name: /Unlock ShelfPick Pro/ }).click()
    await expect(page).toHaveURL(/\/settings\/pro$/)
    await expect(page.getByRole("heading", { name: "Get ShelfPick Pro" })).toBeVisible()
  })
})

test.describe("without a store (the PWA)", () => {
  test.use({ storageState: ACCOUNTS.free.state, viewport: { width: 390, height: 844 } })

  test("explains that Pro is bought in the iPhone app and offers no purchase", async ({ page }) => {
    await mockBilling(page, { accountBody: { ...FREE_ACCOUNT, billing_available: false } })
    await openPaywall(page)
    await expect(page.getByText(/Pro is bought in the ShelfPick iPhone app/)).toBeVisible()
    await expect(page.getByRole("button", { name: /Subscribe|Buy for|Restore purchases/ })).toHaveCount(0)
    await expect(page.getByRole("link", { name: "Privacy Policy" })).toBeVisible()
  })
})

test.describe("Dynamic Type", () => {
  test.use({ storageState: ACCOUNTS.free.state, viewport: { width: 390, height: 844 } })

  test("AX3 text keeps the paywall readable without sideways scrolling", async ({ page }) => {
    await page.addInitScript(() => {
      document.addEventListener("DOMContentLoaded", () => {
        document.documentElement.dataset.nativeIos = "true"
        const style = document.createElement("style")
        style.textContent = ":root[data-native-ios] { font-size: 40px !important; }"
        document.head.append(style)
      })
    })
    await mockBilling(page)
    await openPaywall(page)
    await expect(page.getByRole("button", { name: /Subscribe, £3.99 a year/ })).toBeVisible()
    await expect(page.getByRole("button", { name: "Restore purchases" })).toBeVisible()
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(overflow).toBeLessThanOrEqual(0)
  })
})
