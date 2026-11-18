import { defineConfig, devices } from "@playwright/test"

import { API_ORIGIN, API_PORT, BACKEND_DIR, WEB_ORIGIN, WEB_PORT, backendEnv, backendPython } from "./e2e/support"

const reuseExistingServer = process.env.E2E_REUSE_SERVERS === "true"

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  // The suite shares one reset fixture account, so run serially.
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: true,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  use: {
    baseURL: WEB_ORIGIN,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "iPhone 15", use: { ...devices["iPhone 15"], browserName: "webkit" } },
    { name: "iPhone SE", use: { ...devices["iPhone SE"], browserName: "webkit" } },
  ],
  webServer: [
    {
      command: `"${backendPython()}" -m uvicorn api.main:app --host 127.0.0.1 --port ${API_PORT}`,
      cwd: BACKEND_DIR,
      env: backendEnv() as Record<string, string>,
      url: `${API_ORIGIN}/health`,
      reuseExistingServer,
      timeout: 60_000,
      stdout: "ignore",
      stderr: "pipe",
    },
    {
      command: `npm run dev -- --host 127.0.0.1 --port ${WEB_PORT} --strictPort`,
      env: { VITE_API_BASE_URL: API_ORIGIN, VITE_PUBLIC_LEGAL_LINKS_ENABLED: "true" },
      url: WEB_ORIGIN,
      reuseExistingServer,
      timeout: 60_000,
      stdout: "ignore",
      stderr: "pipe",
    },
  ],
})
