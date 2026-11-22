import assert from "node:assert/strict"
import { after, before, test } from "node:test"
import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { MemoryRouter } from "react-router-dom"
import { createServer } from "vite"

let server
let SettingsSectionView

before(async () => {
  process.env.VITE_LEGAL_DRAFTS_ENABLED = "false"
  server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: "custom" })
  SettingsSectionView = (await server.ssrLoadModule("/src/components/SettingsSectionView.tsx")).default
})

after(async () => {
  await server?.close()
  delete process.env.VITE_LEGAL_DRAFTS_ENABLED
})

// SP-STORE-R02: the links never depend on the purchases flag, so a purchases-off build keeps them.
for (const purchases of ["off", "on"]) {
  test(`approved public links render in Settings with purchases ${purchases}`, async () => {
    const isolated = await createServer({
      define: { __SHELFPICK_PURCHASES__: JSON.stringify(purchases === "on") },
      server: { middlewareMode: true, hmr: false }, appType: "custom",
    })
    try {
      const View = (await isolated.ssrLoadModule("/src/components/SettingsSectionView.tsx")).default
      const flag = await isolated.ssrLoadModule("/src/purchases-flag.ts")
      assert.equal(flag.PURCHASES_ENABLED, purchases === "on")
      assert.equal(flag.PURCHASES_BUILD_MARKER, `shelfpick-purchases-${purchases}`)
      const markup = renderToStaticMarkup(React.createElement(MemoryRouter, null,
        React.createElement(View, {
          section: "help",
          user: { id: 1, email: "test@example.com", display_name: "Test", tier: "FREE" },
          onUserChange: () => {},
        })))
      assert.match(markup, /aria-label="Legal information"/)
      assert.match(markup, /href="https:\/\/plutonightlabs\.com\/shelfpick\/privacy\/"/)
      assert.match(markup, /href="https:\/\/plutonightlabs\.com\/shelfpick\/terms\/"/)
    } finally { await isolated.close() }
  })
}

test("approved public links render without any build flag", () => {
  const markup = renderToStaticMarkup(React.createElement(MemoryRouter, null,
    React.createElement(SettingsSectionView, {
      section: "help",
      user: { id: 1, email: "test@example.com", display_name: "Test", tier: "FREE" },
      onUserChange: () => {},
    })))
  assert.match(markup, /aria-label="Legal information"/)
  assert.match(markup, /href="https:\/\/plutonightlabs\.com\/shelfpick\/privacy\/"/)
  assert.match(markup, /href="https:\/\/plutonightlabs\.com\/shelfpick\/terms\/"/)
  assert.match(markup, /target="_blank" rel="noopener noreferrer"/)
  assert.doesNotMatch(markup, /Privacy Policy draft|Terms of Use draft/)
})
