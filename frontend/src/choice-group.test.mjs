import assert from "node:assert/strict"
import { after, before, test } from "node:test"
import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { createServer } from "vite"

// SP-UI-04: the one shared selected-state control behind every segmented control and chip row.
let server
let ChoiceGroup
let DiscoverView
let CollectionFilters

before(async () => {
  server = await createServer({ server: { middlewareMode: true }, appType: "custom" })
  ChoiceGroup = (await server.ssrLoadModule("/src/components/ui/ChoiceGroup.tsx")).default
  DiscoverView = (await server.ssrLoadModule("/src/components/DiscoverView.tsx")).default
  CollectionFilters = (await server.ssrLoadModule("/src/components/collection/CollectionFilters.tsx")).default
})

after(async () => { await server?.close() })

const OPTIONS = [{ value: "a", label: "Alpha" }, { value: "b", label: "Beta" }, { value: "c", label: "Gamma" }]

function render(props = {}) {
  return renderToStaticMarkup(React.createElement(ChoiceGroup, { value: "b", options: OPTIONS, ariaLabel: "Letters", onChange() {}, ...props }))
}

test("a choice group is one labelled group and exposes the selected option with aria-pressed", () => {
  const markup = render()
  assert.match(markup, /^<div class="choice-group segmented" role="group" aria-label="Letters">/)
  assert.equal((markup.match(/aria-pressed="true"/g) ?? []).length, 1)
  assert.equal((markup.match(/aria-pressed="false"/g) ?? []).length, 2)
  assert.match(markup, /class="choice selected" aria-pressed="true">Beta</)
  assert.match(markup, /class="choice" aria-pressed="false">Alpha</)
})

test("variants and a scrolling row only change the group's classes", () => {
  assert.match(render({ variant: "chips" }), /class="choice-group chips"/)
  assert.match(render({ scroll: true, className: "x" }), /class="choice-group segmented scrolls x"/)
})

test("an option can carry a trailing tag inside its button", () => {
  const markup = render({ options: [{ value: "a", label: "Alpha", trailing: React.createElement("span", { className: "pro-tag" }, "Pro") }], value: "z" })
  assert.match(markup, /<button[^>]*>Alpha<span class="pro-tag">Pro<\/span><\/button>/)
})

test("Discover's lists and Shelf's play filter use the shared control, not their own markup", () => {
  const discover = renderToStaticMarkup(React.createElement(DiscoverView, {
    personalized: false, onViewWishlist() {}, onUnlockPro() {}, onPersonalize() {},
  }))
  assert.match(discover, /class="choice-group segmented discover-modes" role="group" aria-label="Discover lists"/)
  assert.doesNotMatch(discover, /role="tab"|discover-tab|Hot now/)
  const shelf = renderToStaticMarkup(React.createElement(CollectionFilters, {
    search: "", sort: "name", playFilter: "never", onSearchChange() {}, onSortChange() {}, onPlayFilterChange() {},
  }))
  assert.match(shelf, /class="choice-group chips" role="group" aria-label="Filter collection"/)
  assert.match(shelf, /class="choice selected" aria-pressed="true">Unplayed</)
  // The search field has an accessible name and an icon; the sort menu is named too.
  assert.match(shelf, /<span class="sr-only">Search your games<\/span><svg/)
  assert.match(shelf, /aria-label="Sort games"/)
})
