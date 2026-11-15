import AxeBuilder from "@axe-core/playwright"
import { expect, test, type Locator, type Page } from "@playwright/test"

import {
  API_ORIGIN,
  LOCAL_PASSWORD,
  accountOptionsLink,
  authForm,
  disposableEmail,
  logIn,
  logInToOnboarding,
  openAccountOptions,
  runLocalAccounts,
} from "./support"

const BGG_USERNAME = "e2e-shelf-check"

function deletionControls(page: Page) {
  return {
    heading: page.getByRole("heading", { name: "Delete account" }),
    warning: page.getByText("This permanently removes your ShelfPick account", { exact: false }),
    password: page.getByLabel("Confirm your password"),
    confirm: page.getByRole("checkbox", { name: "I understand this cannot be undone." }),
    submit: page.getByRole("button", { name: "Delete my account" }),
  }
}

type AxeFinding = { id: string; impact: string | null | undefined; targets: string[] }

// Known finding, kept explicit rather than hidden (Pluto accessibility
// standard): axe's WCAG 2.2 target-size rule measures the deletion
// confirmation checkbox itself (12x12 CSS px). Its wrapping <label> is a
// 44px-tall activation area, asserted separately in test f. If the finding
// disappears, the expectation fails so this exception is removed.
const KNOWN_DELETION_CHECKBOX_TARGET_SIZE: AxeFinding = {
  id: "target-size",
  impact: "serious",
  targets: ['input[type="checkbox"]'],
}

async function expectNoSeriousAxeViolations(page: Page, label: string, known: AxeFinding[] = []) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze()
  const blocking: AxeFinding[] = results.violations
    .filter((violation) => violation.impact === "serious" || violation.impact === "critical")
    .map((violation) => ({
      id: violation.id,
      impact: violation.impact,
      targets: violation.nodes.map((node) => node.target.join(" ")),
    }))
  expect(blocking, `${label}: serious/critical axe violations`).toEqual(known)
  for (const finding of known) {
    test.info().annotations.push({
      type: "known axe finding",
      description: `${label}: ${finding.id} (${finding.impact}) on ${finding.targets.join(", ")}`,
    })
  }
}

// Returns a short description of the focused element: role-ish tag plus its
// accessible text, used to assert keyboard order.
async function focusedName(page: Page): Promise<string> {
  return page.evaluate(() => {
    const element = document.activeElement as HTMLElement | null
    if (!element || element === document.body) return "body"
    const labelled = element.id
      ? document.querySelector(`label[for="${element.id}"]`)?.textContent
      : null
    const wrapping = element.closest("label")?.textContent
    const name = element.getAttribute("aria-label")
      ?? labelled
      ?? wrapping
      ?? element.textContent
      ?? ""
    return `${element.tagName.toLowerCase()}:${name.replace(/\s+/g, " ").trim()}`
  })
}

// WebKit follows Safari's default: plain Tab reaches only text fields.
// Option+Tab (Alt+Tab) is Safari's full keyboard navigation, covering links,
// buttons and checkboxes, so it is used to assert the complete order.
const NEXT_FOCUS_KEY = "Alt+Tab"

async function tabSequence(page: Page, count: number): Promise<string[]> {
  const sequence: string[] = []
  for (let index = 0; index < count; index += 1) {
    await page.keyboard.press(NEXT_FOCUS_KEY)
    sequence.push(await focusedName(page))
  }
  return sequence
}

async function resetFocusToDocumentStart(page: Page) {
  await page.evaluate(() => {
    (document.activeElement as HTMLElement | null)?.blur()
    window.scrollTo(0, 0)
  })
  // Clicking an inert point puts the sequential focus start at the top of the page.
  await page.mouse.click(1, 1)
}

async function expectNoHorizontalScroll(page: Page, label: string) {
  const metrics = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    bodyScrollWidth: document.body.scrollWidth,
  }))
  expect(metrics.scrollWidth, `${label}: document scrollWidth`).toBeLessThanOrEqual(metrics.clientWidth)
  expect(metrics.bodyScrollWidth, `${label}: body scrollWidth`).toBeLessThanOrEqual(metrics.clientWidth)
}

async function expectEveryControlReachable(page: Page, label: string) {
  const controls = page.locator(
    "main :is(a[href], button, input, select, textarea, [role=button], [tabindex]:not([tabindex='-1'])):visible",
  )
  const count = await controls.count()
  expect(count, `${label}: visible controls`).toBeGreaterThan(0)
  const viewport = page.viewportSize()!
  for (let index = 0; index < count; index += 1) {
    const control = controls.nth(index)
    const description = `${label}: control ${index} (${await control.evaluate((element) =>
      `${element.tagName.toLowerCase()} "${(element.getAttribute("aria-label") ?? element.textContent ?? element.id).trim().slice(0, 40)}"`)})`
    await control.scrollIntoViewIfNeeded()
    const box = await control.boundingBox()
    expect(box, `${description}: has a box`).not.toBeNull()
    expect(box!.x, `${description}: left edge`).toBeGreaterThanOrEqual(-0.5)
    expect(box!.x + box!.width, `${description}: right edge`).toBeLessThanOrEqual(viewport.width + 0.5)
    expect(box!.y, `${description}: top edge`).toBeGreaterThanOrEqual(-0.5)
    expect(box!.y + Math.min(box!.height, 24), `${description}: in viewport`).toBeLessThanOrEqual(viewport.height + 0.5)
    // Trial click runs Playwright's actionability checks (visible, stable,
    // enabled where applicable, receives events / not covered) without acting.
    if (await control.isEnabled()) await control.click({ trial: true })
  }
}

async function expectInsideVisualViewport(page: Page, field: Locator, label: string) {
  await field.focus()
  await field.scrollIntoViewIfNeeded()
  const box = await field.boundingBox()
  const visual = await page.evaluate(() => {
    const viewport = window.visualViewport
    return viewport
      ? { top: viewport.offsetTop, left: viewport.offsetLeft, width: viewport.width, height: viewport.height }
      : { top: 0, left: 0, width: window.innerWidth, height: window.innerHeight }
  })
  expect(box, `${label}: has a box`).not.toBeNull()
  expect(box!.y, `${label}: below visual viewport top`).toBeGreaterThanOrEqual(visual.top - 0.5)
  expect(box!.y + box!.height, `${label}: above visual viewport bottom`).toBeLessThanOrEqual(visual.top + visual.height + 0.5)
  expect(box!.x, `${label}: inside visual viewport left`).toBeGreaterThanOrEqual(visual.left - 0.5)
  expect(box!.x + box!.width, `${label}: inside visual viewport right`).toBeLessThanOrEqual(visual.left + visual.width + 0.5)
  const topmostIsField = await field.evaluate((element) => {
    const rect = element.getBoundingClientRect()
    const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2)
    return hit === element || element.contains(hit)
  })
  expect(topmostIsField, `${label}: not covered by another element`).toBe(true)
  await expect(field).toBeFocused()
}

test.describe("Onboarding account options", () => {
  test("a) Account options is visible and opens for an incomplete account", async ({ page }) => {
    await logInToOnboarding(page)
    await expect(accountOptionsLink(page)).toBeVisible()
    await openAccountOptions(page)
    await expect(page.getByRole("link", { name: "Back to onboarding" })).toBeVisible()
    await expect(page.getByRole("button", { name: "Log out" })).toBeVisible()
    await expect(deletionControls(page).heading).toBeVisible()
  })

  test("b) Back to onboarding restores the same step and field value", async ({ page }) => {
    await logInToOnboarding(page)
    await page.getByRole("button", { name: "Get started" }).click()
    await expect(page.getByText("Step 2 of 4", { exact: true })).toBeVisible()
    await page.getByLabel("BoardGameGeek username").fill(BGG_USERNAME)

    await openAccountOptions(page)
    await expect(page.getByLabel("BoardGameGeek username")).toBeHidden()

    await page.getByRole("link", { name: "Back to onboarding" }).click()
    await expect(page).toHaveURL(/\/onboarding$/)
    await expect(page.getByText("Step 2 of 4", { exact: true })).toBeVisible()
    await expect(page.getByRole("heading", { name: "Build your shelf" })).toBeVisible()
    await expect(page.getByLabel("BoardGameGeek username")).toHaveValue(BGG_USERNAME)
    await expect(accountOptionsLink(page)).toBeFocused()
  })

  test("c) Log out returns to sign-in and the account can sign back in", async ({ page }) => {
    await logInToOnboarding(page)
    await openAccountOptions(page)
    await page.getByRole("button", { name: "Log out" }).click()
    await expect(page).toHaveURL(/\/login$/)
    await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible()
    expect(await page.evaluate(() => Object.keys(localStorage).filter((key) => /token/i.test(key)))).toEqual([])

    await logInToOnboarding(page)
    await expect(accountOptionsLink(page)).toBeVisible()
  })

  test("d) Deletion shows password and warning; leaving it keeps the account", async ({ page }) => {
    await logInToOnboarding(page)
    await openAccountOptions(page)
    const deletion = deletionControls(page)
    await expect(deletion.heading).toBeVisible()
    await expect(deletion.warning).toBeVisible()
    await expect(deletion.password).toBeVisible()
    await expect(deletion.password).toHaveAttribute("type", "password")
    await expect(deletion.confirm).toBeVisible()
    await expect(deletion.submit).toBeDisabled()

    await deletion.password.fill(LOCAL_PASSWORD)
    await expect(deletion.submit).toBeDisabled()
    await deletion.confirm.check()
    await expect(deletion.submit).toBeEnabled()

    // The screen has no separate Cancel button; Back to onboarding is the
    // only way to abandon deletion, so it is exercised as the cancel path.
    await page.getByRole("link", { name: "Back to onboarding" }).click()
    await expect(page).toHaveURL(/\/onboarding$/)
    await expect(page.getByText("Step 1 of 4", { exact: true })).toBeVisible()

    await openAccountOptions(page)
    await expect(deletionControls(page).password).toHaveValue("")
    await page.getByRole("button", { name: "Log out" }).click()
    await expect(page).toHaveURL(/\/login$/)
    await logInToOnboarding(page)
  })

  test("e) A fresh account with incomplete onboarding can be deleted", async ({ page }, testInfo) => {
    const email = disposableEmail(testInfo.project.name)
    const password = `E2e disposable ${Date.now()}`

    await page.goto("/login")
    await page.getByRole("button", { name: "Register" }).click()
    await expect(page.getByRole("heading", { name: "Create your account" })).toBeVisible()
    const form = authForm(page)
    await form.getByRole("checkbox", { name: "I confirm I am at least 13 years old." }).check()
    await form.getByLabel("Name").fill("E2E Disposable")
    await form.getByLabel("Email").fill(email)
    await form.getByLabel("New password").fill(password)
    await form.getByRole("button", { name: "Create account" }).click()
    await expect(page.getByRole("status").filter({ hasText: /verify/i })).toBeVisible()

    // Locally issued token for the reserved e2e-disposable address, confirmed
    // through the normal verification endpoint. The /verify-email page is not
    // used here: under the Vite dev server, React StrictMode runs its confirm
    // effect twice and the second call reports the consumed token as invalid.
    const token = runLocalAccounts("verification-token", email)
    const confirmation = await page.request.post(`${API_ORIGIN}/auth/verification/confirm`, {
      data: { token },
    })
    expect(confirmation.status()).toBe(200)

    await logInToOnboarding(page, email, password)
    await openAccountOptions(page)
    const deletion = deletionControls(page)
    await deletion.password.fill(password)
    await deletion.confirm.check()
    await deletion.submit.click()

    await expect(page).toHaveURL(/\/login$/)
    await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible()

    await logIn(page, email, password)
    await expect(page.getByRole("alert").filter({ hasText: "Invalid email or password" })).toBeVisible()
    await expect(page).toHaveURL(/\/login$/)
  })

  test("f) Accessibility: axe, accessible names and keyboard order", async ({ page }) => {
    await logInToOnboarding(page)
    await expectNoSeriousAxeViolations(page, "Onboarding step 1")

    await resetFocusToDocumentStart(page)
    expect(await tabSequence(page, 2)).toEqual([
      "button:Get started",
      "a:Account options",
    ])

    await openAccountOptions(page)
    await expectNoSeriousAxeViolations(page, "Account options", [KNOWN_DELETION_CHECKBOX_TARGET_SIZE])

    await expect(page.getByRole("link", { name: "Back to onboarding", exact: true })).toBeVisible()
    await expect(page.getByRole("button", { name: "Log out", exact: true })).toBeVisible()
    // type=password has no ARIA role; its accessible name comes from <label for>.
    await expect(page.getByLabel("Confirm your password", { exact: true })).toBeVisible()
    const confirmation = page.getByRole("checkbox", { name: "I understand this cannot be undone.", exact: true })
    await expect(confirmation).toBeVisible()
    await expect(page.getByRole("button", { name: "Delete my account", exact: true })).toBeVisible()

    // Effective touch target for the known axe target-size finding: the
    // wrapping label is at least 44px tall and toggles the checkbox.
    const confirmationLabel = page.locator("label").filter({ has: confirmation })
    const labelBox = await confirmationLabel.boundingBox()
    expect(labelBox!.height, "confirmation label touch height").toBeGreaterThanOrEqual(44)
    await confirmationLabel.getByText("I understand this cannot be undone.").click()
    await expect(confirmation).toBeChecked()
    await confirmationLabel.getByText("I understand this cannot be undone.").click()
    await expect(confirmation).not.toBeChecked()

    await resetFocusToDocumentStart(page)
    expect(await tabSequence(page, 4)).toEqual([
      "a:Back to onboarding",
      "button:Log out",
      "input:Confirm your password",
      "input:I understand this cannot be undone.",
    ])

    // The submit button joins the tab order once deletion is armed.
    await page.getByLabel("Confirm your password").fill("not-submitted")
    await page.getByRole("checkbox", { name: "I understand this cannot be undone." }).focus()
    await page.keyboard.press("Space")
    await expect(page.getByRole("checkbox", { name: "I understand this cannot be undone." })).toBeChecked()
    await page.keyboard.press(NEXT_FOCUS_KEY)
    expect(await focusedName(page)).toBe("button:Delete my account")
    await expectNoSeriousAxeViolations(page, "Account options with deletion armed", [KNOWN_DELETION_CHECKBOX_TARGET_SIZE])
  })

  test("g) iPhone SE at 200% root font size keeps controls reachable", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "iPhone SE", "Small-screen enlarged-text check runs on iPhone SE only")
    await page.addInitScript(() => {
      document.addEventListener("DOMContentLoaded", () => {
        document.documentElement.style.fontSize = "200%"
      })
    })
    await logInToOnboarding(page)
    const rootSize = await page.evaluate(() => getComputedStyle(document.documentElement).fontSize)
    expect(rootSize).toBe("32px")
    testInfo.annotations.push({
      type: "body text size at 200% root",
      description: await page.evaluate(() =>
        getComputedStyle(document.querySelector(".onboarding-card p") ?? document.body).fontSize),
    })

    await expectNoHorizontalScroll(page, "Onboarding step 1")
    await expectEveryControlReachable(page, "Onboarding step 1")

    await page.getByRole("button", { name: "Get started" }).click()
    await expect(page.getByText("Step 2 of 4", { exact: true })).toBeVisible()
    await expectNoHorizontalScroll(page, "Onboarding step 2")
    await expectEveryControlReachable(page, "Onboarding step 2")

    await openAccountOptions(page)
    await expectNoHorizontalScroll(page, "Account options")
    await expectEveryControlReachable(page, "Account options")
    await expectInsideVisualViewport(page, page.getByLabel("Confirm your password"), "Focused deletion password")
  })
})
