import assert from "node:assert/strict"
import { after, before, test } from "node:test"
import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { MemoryRouter } from "react-router-dom"
import { createServer } from "vite"

let server
let SettingsSectionView

before(async () => {
  process.env.VITE_PUBLIC_LEGAL_LINKS_ENABLED = "true"
  process.env.VITE_LEGAL_DRAFTS_ENABLED = "false"
  server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: "custom" })
  SettingsSectionView = (await server.ssrLoadModule("/src/components/SettingsSectionView.tsx")).default
})

after(async () => {
  await server?.close()
  delete process.env.VITE_PUBLIC_LEGAL_LINKS_ENABLED
  delete process.env.VITE_LEGAL_DRAFTS_ENABLED
})

test("approved public links render only when explicitly enabled in the build", () => {
  const markup = renderToStaticMarkup(React.createElement(MemoryRouter, null,
    React.createElement(SettingsSectionView, {
      section: "about",
      user: { id: 1, email: "test@example.com", display_name: "Test", tier: "FREE" },
      onUserChange: () => {},
    })))
  assert.match(markup, /aria-label="Legal information"/)
  assert.match(markup, /href="https:\/\/plutonightlabs\.com\/shelfpick\/privacy\/"/)
  assert.match(markup, /href="https:\/\/plutonightlabs\.com\/shelfpick\/terms\/"/)
  assert.match(markup, /target="_blank" rel="noopener noreferrer"/)
  assert.doesNotMatch(markup, /Privacy Policy draft|Terms of Use draft/)
})
