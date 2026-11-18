# Scoresheets

Versioned, hand-written scoresheet templates for ShelfPick. Content and data only; nothing here is imported by the app yet (SP-SCORE-01 will load it).

- [`SCHEMA.md`](SCHEMA.md): the format and scoring rules.
- `templates/<bgg_id>-<slug>.json`: one template per game.
- `fixtures/<bgg_id>.json`: a worked example per template (entries, expected totals and winner).
- `score.mjs`, `validate.mjs`, `lib/json-schema.mjs`: scoring engine, validator and a small dependency-free JSON Schema checker.
- [`PROPOSED-GAMES.md`](PROPOSED-GAMES.md), [`PROPOSED-GAMES-2.md`](PROPOSED-GAMES-2.md): the approved game lists.
- `play-samples/<bgg_id>.json`: anonymised totals from real plays (no names, dates or places), used to check winner rules.

## Check everything

```bash
node scoresheets/validate.mjs
node --test scoresheets/scoresheets.test.mjs
```

Both need only Node 22 or newer. The validator checks every template against `schema.v1.json`, runs semantic checks (unique ids, tie-breaker ids, player counts), then computes each fixture's totals and winner with `score.mjs` and compares them with the expected values.

## Add a template

1. Read the publisher's rulebook for a named edition. Take the scoring categories from it.
2. Write labels and help text in your own words. Do not copy another app's sheets, categories or wording.
3. Create `templates/<bgg_id>-<slug>.json` following `SCHEMA.md`. Set `source.rulebook_title` and `edition_or_year`, add the `url` you read, and set `checked_against_rulebook` to `true` only once you have compared it with that rulebook text.
4. Create `fixtures/<bgg_id>.json` with 2 to 4 players. Prefer an example from the rulebook (`provenance: "rulebook-example"`); otherwise calculate by hand and mark it `hand-calculated`. Work the expected totals out yourself, not by running the engine.
5. Run the two commands above. Include a tie in the fixture when the game has tie-breakers.
6. Express the game with the existing fields. If it cannot be expressed, raise a schema change rather than adding a game-specific special case.
