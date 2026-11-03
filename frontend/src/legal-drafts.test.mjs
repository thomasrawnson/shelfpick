import assert from "node:assert/strict"
import { after, before, test } from "node:test"
import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { MemoryRouter } from "react-router-dom"
import { createServer } from "vite"


let server
let LegalDraftView
let legalDraftsEnabled


before(async () => {
  server = await createServer({
    server: {
      middlewareMode: true,
      hmr: false,
    },
    appType: "custom",
  })
  LegalDraftView = (
    await server.ssrLoadModule(
      "/src/components/LegalDraftView.tsx",
    )
  ).default
  legalDraftsEnabled = (
    await server.ssrLoadModule(
      "/src/legal-drafts.ts",
    )
  ).legalDraftsEnabled
})


after(async () => {
  await server?.close()
})


function render(kind) {
  return renderToStaticMarkup(
    React.createElement(
      MemoryRouter,
      { initialEntries: [`/legal/${kind}-draft`] },
      React.createElement(LegalDraftView, {
        kind,
        backTo: "/login",
      }),
    ),
  )
}


test("legal draft enablement fails closed", () => {
  assert.equal(legalDraftsEnabled(undefined), false)
  assert.equal(legalDraftsEnabled("false"), false)
  assert.equal(legalDraftsEnabled("TRUE"), false)
  assert.equal(legalDraftsEnabled("true"), true)
})


test("privacy draft is explicit and contains every provisional period", () => {
  const markup = render("privacy")
  assert.match(markup, /DRAFT — NOT LEGALLY APPROVED/)
  assert.match(markup, /Pluto Night Labs Ltd/)
  assert.match(markup, /hello@plutonightlabs\.com/)
  for (const value of [
    "24 months",
    "30 days",
    "7 days",
    "12 months",
  ]) {
    assert.match(markup, new RegExp(value))
  }
  assert.match(markup, /automatic-deletion promises/)
  assert.match(markup, /href="\/legal\/terms-draft"/)
})


test("terms draft states the legal and commercial limits", () => {
  const markup = render("terms")
  assert.match(markup, /DRAFT — NOT LEGALLY APPROVED/)
  assert.match(markup, /Free-only/)
  assert.match(markup, /purchase and checkout are unavailable/)
  assert.match(markup, /commercial XML API application approval/)
  assert.match(markup, /No binding Terms of Use will be published/)
  assert.match(markup, /href="\/legal\/privacy-draft"/)
})
