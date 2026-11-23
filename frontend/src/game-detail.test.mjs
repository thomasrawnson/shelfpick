import assert from "node:assert/strict"
import { test } from "node:test"

import { displayTerms, shownTerms, TERM_LIMIT } from "./detail-terms.ts"
import { metaLine, minutesOrDash, playsLabel, scaled, winnersFirst } from "./game-detail-format.ts"

// SP-UI-05: display rules for the game detail screen.
test("Mechanics show six terms and the rest only when expanded", () => {
  const terms = ["a", "b", "c", "d", "e", "f", "g", "h"]
  assert.equal(TERM_LIMIT, 6)
  assert.deepEqual(shownTerms(terms, false), ["a", "b", "c", "d", "e", "f"])
  assert.deepEqual(shownTerms(terms, true), terms)
  assert.deepEqual(shownTerms(terms.slice(0, 6), false), terms.slice(0, 6))
})

test("the Tags import artefact is hidden from the display only, whatever its case", () => {
  assert.deepEqual(displayTerms(["Tags", "Drafting", " tags "]), ["Drafting"])
  assert.deepEqual(displayTerms(["Hand Management"]), ["Hand Management"])
})

test("ratings and weights show their scale, and a missing value is a dash", () => {
  assert.deepEqual(scaled(8.13, 10), { value: "8.1", scale: " / 10" })
  assert.deepEqual(scaled(2.2, 5), { value: "2.2", scale: " / 5" })
  assert.deepEqual(scaled(null, 10), { value: "—", scale: null })
  assert.deepEqual(scaled(undefined, 5), { value: "—", scale: null })
})

test("a missing or zero duration is a dash, never 0", () => {
  assert.equal(minutesOrDash(null), "—")
  assert.equal(minutesOrDash(0), "—")
  assert.equal(minutesOrDash(undefined), "—")
  assert.equal(minutesOrDash(47), "47")
})

test("one play is singular", () => {
  assert.equal(playsLabel(1), "play")
  assert.equal(playsLabel(0), "plays")
  assert.equal(playsLabel(14), "plays")
})

test("the meta line folds players and time into one line", () => {
  assert.equal(metaLine("2 players", 30), "2 players · 30 min")
  assert.equal(metaLine("1–4 players", null), "1–4 players")
  assert.equal(metaLine(null, 45), "45 min")
  assert.equal(metaLine(null, null), "")
})

test("winners and draws come first, each group keeps the logged order", () => {
  const people = [
    { name: "Bob", outcome: "loss" }, { name: "Ann", outcome: "win" }, { name: "Cleo", outcome: "unknown" }, { name: "Dev", outcome: "draw" },
  ]
  assert.deepEqual(winnersFirst(people).map((person) => person.name), ["Ann", "Dev", "Bob", "Cleo"])
})
