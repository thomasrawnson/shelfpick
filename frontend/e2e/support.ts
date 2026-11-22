import { execFileSync } from "node:child_process"
import { existsSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { expect, type Page } from "@playwright/test"

const here = path.dirname(fileURLToPath(import.meta.url))

export const FRONTEND_DIR = path.resolve(here, "..")
export const BACKEND_DIR = path.resolve(FRONTEND_DIR, "../backend")

// Ports can move (E2E_API_PORT / E2E_WEB_PORT) when another local server holds the defaults.
export const API_PORT = process.env.E2E_API_PORT ?? "8000"
export const WEB_PORT = process.env.E2E_WEB_PORT ?? "5173"
export const API_ORIGIN = `http://127.0.0.1:${API_PORT}`
export const WEB_ORIGIN = `http://127.0.0.1:${WEB_PORT}`

// A recorded answer to the first-launch analytics choice, so its sheet does not cover the screen under test.
// Specs that exercise the choice itself start from { cookies: [], origins: [] } instead.
export const ANALYTICS_ANSWERED = {
  cookies: [],
  origins: [{ origin: WEB_ORIGIN, localStorage: [{ name: "shelfpick.analytics.enabled", value: "off" }] }],
}

// Local-only fixture credentials, documented in docs/local-free-pro-testing.md.
export const ONBOARDING_EMAIL = "local-onboarding@shelfpick.app"
export const LOCAL_PASSWORD = process.env.SHELFPICK_LOCAL_TEST_PASSWORD ?? "ShelfPickLocal123!"

export function backendPython(): string {
  const configured = process.env.SHELFPICK_BACKEND_PYTHON
  const python = configured ?? path.join(BACKEND_DIR, ".venv/bin/python")
  if (!existsSync(python)) {
    throw new Error(
      `Backend Python not found at ${python}. Create backend/.venv or set SHELFPICK_BACKEND_PYTHON.`,
    )
  }
  return python
}

// Every value is explicit so a developer's backend/.env cannot point the
// suite at another database or change registration and email behaviour.
export function backendEnv(): NodeJS.ProcessEnv {
  return {
    ...process.env,
    APP_ENV: "development",
    DATABASE_URL: process.env.E2E_DATABASE_URL
      ?? "postgresql+psycopg://boardgamepicker:boardgamepicker_dev@localhost:5433/shelfpick_dev",
    JWT_SECRET: process.env.E2E_JWT_SECRET ?? "local-e2e-only-jwt-secret-not-for-any-real-host",
    ACCESS_TOKEN_MINUTES: "60",
    CORS_ORIGINS: `${WEB_ORIGIN},http://localhost:${WEB_PORT}`,
    FRONTEND_URL: WEB_ORIGIN,
    PUBLIC_REGISTRATION_ENABLED: "true",
    BETA_INVITE_EMAILS: "",
    AI_PICKER_ENABLED: "false",
    GAME_NIGHT_PHONE_VOTING_ENABLED: process.env.E2E_PHONE_VOTING_ENABLED === "true" ? "true" : "false",
    RETENTION_CLEANUP_ENABLED: "false",
    RESEND_API_KEY: "",
    BGG_API_TOKEN: "",
  }
}

export function runLocalAccounts(...args: string[]): string {
  return execFileSync(backendPython(), ["-m", "scripts.local_test_accounts", ...args], {
    cwd: BACKEND_DIR,
    env: backendEnv(),
    encoding: "utf8",
  }).trim()
}

export function disposableEmail(projectName: string): string {
  const project = projectName.toLowerCase().replace(/[^a-z0-9]+/g, "-")
  const unique = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
  return `e2e-disposable-${project}-${unique}@shelfpick.app`
}

export function authForm(page: Page) {
  return page.locator("form.auth-form")
}

export async function logIn(page: Page, email = ONBOARDING_EMAIL, password = LOCAL_PASSWORD) {
  await page.goto("/login")
  await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible()
  const form = authForm(page)
  await form.getByLabel("Email").fill(email)
  await form.getByLabel("Password", { exact: true }).fill(password)
  await form.getByRole("button", { name: "Log in" }).click()
}

export async function logInToOnboarding(page: Page, email = ONBOARDING_EMAIL, password = LOCAL_PASSWORD) {
  await logIn(page, email, password)
  await expect(page).toHaveURL(/\/onboarding$/)
  await expect(page.getByText("Step 1 of 4", { exact: true })).toBeVisible()
}

export function accountOptionsLink(page: Page) {
  return page.getByRole("link", { name: "Account options", exact: true })
}

export async function openAccountOptions(page: Page) {
  await accountOptionsLink(page).click()
  await expect(page).toHaveURL(/\/onboarding\/account$/)
  await expect(page.getByRole("heading", { name: "Manage your account" })).toBeVisible()
}
