import assert from "node:assert/strict"
import { after, before, test } from "node:test"
import { createServer } from "vite"

let server
let scoresheets

before(async () => {
  server = await createServer({ server: { middlewareMode: true }, appType: "custom" })
  scoresheets = await server.ssrLoadModule("/src/scoresheets.ts")
})

after(async () => { await server?.close() })

function calculate(bggId, entries, expansions = []) {
  const template = scoresheets.getScoresheetTemplate(bggId)
  assert.ok(template)
  return scoresheets.calculateScoresheet(template, entries, expansions)
}

test("only the three approved exact BGG IDs resolve", () => {
  assert.equal(scoresheets.getScoresheetTemplate(266192)?.gameName, "Wingspan")
  assert.equal(scoresheets.getScoresheetTemplate(167791)?.gameName, "Terraforming Mars")
  assert.equal(scoresheets.getScoresheetTemplate(414317)?.gameName, "Harmonies")
  assert.equal(scoresheets.getScoresheetTemplate(13), null)
})

test("Wingspan totals categories and breaks a total tie with unused food", () => {
  const result = calculate(266192, [
    { birds: "50", bonus_cards: "8", end_round_goals: "10", eggs: "12", cached_food: "4", tucked_cards: "6", unused_food: "2" },
    { birds: "48", bonus_cards: "10", end_round_goals: "8", eggs: "15", cached_food: "2", tucked_cards: "7", unused_food: "3" },
  ])

  assert.deepEqual(result.totals, [90, 90])
  assert.deepEqual(result.winnerIndexes, [1])
  assert.equal(result.complete, true)
})

test("Wingspan Oceania adds Nectar only when selected", () => {
  const entry = { birds: "10", bonus_cards: "0", end_round_goals: "0", eggs: "0", cached_food: "0", tucked_cards: "0", nectar: "12" }

  assert.deepEqual(calculate(266192, [entry]).totals, [10])
  assert.deepEqual(calculate(266192, [entry], ["oceania"]).totals, [22])
})

test("Terraforming Mars applies M€ then unplayed-card tie-breakers", () => {
  const result = calculate(167791, [
    { terraform_rating: "60", milestones: "5", awards: "5", greenery: "8", cities: "10", cards: "12", money: "4", unplayed_cards: "3" },
    { terraform_rating: "58", milestones: "5", awards: "5", greenery: "10", cities: "10", cards: "12", money: "4", unplayed_cards: "5" },
  ])

  assert.deepEqual(result.totals, [100, 100])
  assert.deepEqual(result.winnerIndexes, [1])
})

test("Harmonies preserves a shared victory after the Animal-cube tie-breaker", () => {
  const entries = [
    { trees: "12", mountains: "10", fields: "8", buildings: "9", water: "11", animal_cards: "20", animal_cubes: "14" },
    { trees: "10", mountains: "12", fields: "8", buildings: "10", water: "10", animal_cards: "20", animal_cubes: "14" },
  ]
  const result = calculate(414317, entries)

  assert.deepEqual(result.totals, [70, 70])
  assert.deepEqual(result.winnerIndexes, [0, 1])
})

test("zero is valid while blanks, decimals and negatives remain incomplete", () => {
  const zero = calculate(414317, [{ trees: "0", mountains: "0", fields: "0", buildings: "0", water: "0", animal_cards: "0" }])
  const blank = calculate(414317, [{ trees: "", mountains: "0", fields: "0", buildings: "0", water: "0", animal_cards: "0" }])
  const invalid = calculate(414317, [{ trees: "1.5", mountains: "-1", fields: "0", buildings: "0", water: "0", animal_cards: "0" }])

  assert.deepEqual(zero, { complete: true, totals: [0], winnerIndexes: [], missingFieldIds: [], invalidFieldIds: [] })
  assert.equal(blank.complete, false)
  assert.deepEqual(blank.missingFieldIds, ["trees"])
  assert.equal(invalid.complete, false)
  assert.deepEqual(invalid.invalidFieldIds.sort(), ["mountains", "trees"])
})

test("a tied result stays incomplete until required tie-breakers are entered", () => {
  const result = calculate(266192, [
    { birds: "10", bonus_cards: "0", end_round_goals: "0", eggs: "0", cached_food: "0", tucked_cards: "0" },
    { birds: "10", bonus_cards: "0", end_round_goals: "0", eggs: "0", cached_food: "0", tucked_cards: "0" },
  ])

  assert.equal(result.complete, false)
  assert.deepEqual(result.totals, [10, 10])
  assert.deepEqual(result.missingFieldIds, ["unused_food"])
  assert.deepEqual(result.winnerIndexes, [])
})

test("calculation does not mutate submitted cells", () => {
  const entries = [{ trees: "1", mountains: "2", fields: "3", buildings: "4", water: "5", animal_cards: "6" }]
  const before = JSON.stringify(entries)

  calculate(414317, entries)

  assert.equal(JSON.stringify(entries), before)
})
