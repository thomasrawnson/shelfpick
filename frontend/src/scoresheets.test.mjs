import assert from "node:assert/strict"
import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { after, before, test } from "node:test"
import { createServer } from "vite"

const sheetsDir = join(import.meta.dirname, "../../scoresheets")
const read = (...parts) => JSON.parse(readFileSync(join(sheetsDir, ...parts), "utf8"))
const templates = new Map(
  readdirSync(join(sheetsDir, "templates")).filter((name) => name.endsWith(".json"))
    .map((name) => read("templates", name)).map((template) => [template.bgg_id, template]),
)

let server
let engine
let math
let builder

before(async () => {
  server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: "custom" })
  engine = await server.ssrLoadModule("/src/scoresheets/engine.ts")
  math = await server.ssrLoadModule("/src/scoresheets/math-input.ts")
  builder = await server.ssrLoadModule("/src/scoresheets/builder.ts")
})

after(async () => { await server?.close() })

test("the preview engine reproduces every SCORE-00 fixture", () => {
  const fixtures = readdirSync(join(sheetsDir, "fixtures")).filter((name) => name.endsWith(".json"))
  assert.ok(fixtures.length >= 25)
  for (const name of fixtures) {
    const fixture = read("fixtures", name)
    const sheet = templates.get(fixture.bgg_id)
    const scored = engine.scorePlay(sheet, fixture.players.map((player) => player.scores))
    const names = fixture.players.map((player) => player.name)
    assert.deepEqual(Object.fromEntries(names.map((player, index) => [player, scored.totals[index]])), fixture.expected.totals, name)
    assert.deepEqual(scored.winners.map((index) => names[index]).sort(), [...fixture.expected.winner].sort(), name)
    if (fixture.expected.result_band) assert.equal(scored.resultBand, fixture.expected.result_band, name)
  }
})

const sheet = (extra = {}) => ({
  format_version: 1, bgg_id: 1, name: "T", supported_players: [1, 6], win_condition: "highest", rounds: null,
  categories: [
    { id: "points", label: "Points", help: "x", type: "number", points_per: 1, allow_negative: true, scope: "once" },
    { id: "coins", label: "Coins", help: "x", type: "count", points_per: 0, allow_negative: false, scope: "once" },
  ],
  tie_breakers: [], source: { rulebook_title: "x", edition_or_year: "x", checked_against_rulebook: false }, notes: "",
  ...extra,
})

test("ranks share ties, honour tie-breakers and lowest-wins", () => {
  assert.deepEqual(engine.scorePlay(sheet(), [{ points: 3 }, { points: 3 }, { points: 1 }]).ranks, [1, 1, 3])
  assert.deepEqual(engine.scorePlay(sheet({ tie_breakers: ["coins"] }), [{ points: 3, coins: 1 }, { points: 3, coins: 2 }]).ranks, [2, 1])
  assert.deepEqual(engine.scorePlay(sheet({ win_condition: "lowest" }), [{ points: -2 }, { points: 5 }]).winners, [0])
  const coop = engine.scorePlay(sheet({ win_condition: "cooperative", result_bands: [{ min_total: 0, label: "Ok" }] }), [{ points: 4 }])
  assert.deepEqual([coop.winners, coop.ranks, coop.resultBand], [[], null, "Ok"])
  const target = engine.scorePlay(sheet({ win_condition: "target", target_score: 10 }), [{ points: 9 }, { points: 4 }])
  assert.deepEqual([target.winners, target.ranks], [[], null])
})

test("per-round cells pad to the round count", () => {
  const rounds = sheet({ rounds: 3, categories: [{ id: "r", label: "R", help: "x", type: "number", points_per: 1, allow_negative: false, scope: "per_round" }] })
  const rows = engine.sheetRows(rounds, {})
  assert.deepEqual(rows.map((row) => row.label), ["R · round 1", "R · round 2", "R · round 3"])
  const filled = engine.withCell(rounds, {}, rows[1], 7, 3)
  assert.deepEqual(filled, { r: [0, 7, 0] })
  assert.deepEqual(engine.completeBreakdown(rounds, {}, {}), { r: [0, 0, 0] })
  assert.equal(engine.cellProblem(rounds.categories[0], -1), "This category can't be negative.")
})

test("the maths keyboard evaluates safely with precedence", () => {
  assert.equal(math.evaluateExpression("12+7*2"), 26)
  assert.equal(math.evaluateExpression("12+7×2"), 26)
  assert.equal(math.evaluateExpression("−3+10"), 7)
  assert.equal(math.evaluateExpression("5*-2"), -10)
  assert.equal(math.evaluateExpression("0.1+0.2"), 0.3)
  assert.equal(math.evaluateExpression("12+"), null)
  assert.equal(math.evaluateExpression("alert(1)"), null)
  assert.equal(math.evaluateExpression("2**3"), null)
  assert.equal(math.evaluateExpression("(1+2)"), null)
  assert.equal(math.evaluateExpression(""), null)
})

test("key presses build a valid expression", () => {
  const press = (keys) => keys.reduce((text, key) => math.applyKey(text, key), "")
  assert.equal(press(["1", "2", "+", "7", "*", "2"]), "12+7*2")
  assert.equal(press(["5", "+", "*"]), "5*")
  assert.equal(press(["5", "*", "-", "2"]), "5*-2")
  assert.equal(press(["+", "-", "3"]), "-3")
  assert.equal(press([".", "5", "."]), "0.5")
  assert.equal(press(["1", "2", "backspace"]), "1")
  assert.equal(math.speakExpression("12+7*2"), "12 plus 7 times 2")
  assert.equal(math.speakExpression("-3-2"), "minus 3 minus 2")
})

test("the builder makes a valid format-1 schema with stable ids", () => {
  const draft = builder.emptyDraft("Lantern Grove")
  draft.categories = [
    { ...builder.newCategory("Gems"), type: "count", pointsPer: "3" },
    { ...builder.newCategory("Gems"), perRound: true },
    { ...builder.newCategory("2nd place bonus"), type: "boolean", pointsPer: "5", perRound: true },
  ]
  draft.tieBreakers = [draft.categories[0].key]
  const built = builder.schemaFromDraft(draft, 42)
  assert.equal(built.ok, true)
  const { schema } = built
  assert.deepEqual(schema.categories.map((category) => category.id), ["gems", "gems_2", "c_2nd_place_bonus"])
  assert.equal(schema.categories[2].scope, "once")
  assert.deepEqual(schema.tie_breakers, ["gems", "shared"])
  assert.equal(schema.source.checked_against_rulebook, false)
  const again = builder.schemaFromDraft(builder.draftFromSchema(schema), 42)
  assert.deepEqual(again.schema, schema)

  assert.equal(builder.schemaFromDraft({ ...draft, name: " " }, 42).ok, false)
  assert.equal(builder.schemaFromDraft({ ...draft, winCondition: "target" }, 42).ok, false)
  const coop = builder.schemaFromDraft({ ...draft, winCondition: "cooperative" }, 42)
  assert.deepEqual(coop.schema.tie_breakers, [])
})
