# SP-SCORE-01 — independent scoresheet engine prototype

## Boundary and demo

`backend/prototypes/scoresheets/engine.py` is pure Python. It imports no router, repository, database or BG Stats code. Run `cd backend && .venv/bin/python -m prototypes.scoresheets.demo` to print three fictional examples. `backend/tests/test_scoresheet_prototype.py` tests the engine. There is no production navigation, API, migration or play-recording integration.

## Version-one data contract

Templates have `schema_version: 1`, stable `template_id`, immutable `version`, `bgg_id` (positive integer for a real game; `null` only for fictional/general examples), `mode` (`generic`, `rounds`, `categories`), `winner` (`high`, `low`, `none`), and `fields`. Round templates also have `max_rounds`. Optional template `variants` and `expansions` list stable IDs. A numeric field has an ID, `required`, optional group ID, fixed decimal `multiplier`, and optional variant/expansion selectors. Boolean fields act as flags. `when: {field: <boolean ID>, equals: true|false}` gates a numeric field. No arbitrary code or expression evaluator is allowed. The engine caps fields, entrants, rounds and numeric magnitude; uses decimal arithmetic; rejects non-finite, unknown, duplicate and inactive values.

A sheet pins `template_id` and exact `version`, optional `variant` and `expansions`, and a list of entrants. Entrants have stable IDs and `kind: player|team`. In a real integration, IDs would be mapped to existing user-scoped player IDs; the prototype's team ID represents a team total only and has no roster model. Generic/category entrants supply `cells`; rounds entrants supply an ordered `rounds` list of the same length. `null` denotes an unfinished round; an absent required field makes the sheet incomplete. Optional fields can be absent. Calculated `partial_total` is only a draft aid; `total` is null for an incomplete entrant, and no winners are assigned unless all entrants are complete. Ties return every best entrant ID. The winner policy has no tie-breaker rule; a production UI would need a reviewed manual override.

The v1 engine's category fields can be limited by variant or selected expansion. It returns group subtotals and per-field calculated points. Editing any round/cell recomputes from input, so no stale running totals are persisted. It is deterministic for a given template and sheet. Templates are never executed as Python/JavaScript. Unsupported schema versions and nonmatching template versions fail closed. Saved sheets must retain their original template version; future migrations should be explicit and opt-in, with golden test fixtures.

## Production path to assess later

Store approved templates as versioned, reviewed JSON in the repository initially; serve them as static assets by BGG ID/version. Keep private user templates in account-scoped storage only if an editor is approved. At save time, a backend service should resolve the exact template version, recalculate from bounded input, require complete scores for result assignment, and commit the detailed sheet plus existing `PlayParticipant.score/is_winner` values atomically. A new user-scoped table or JSON column would need an Alembic migration, retention/backup plan and read API; none is implemented here. Existing imports remain total-only and must not fabricate category detail. Historical plays, rankings and current API responses continue to read their existing participant fields. Any new endpoint should be additive, authorization-scoped and versioned.

The current Plays API accepts nullable float scores and explicit winner booleans. Before wiring the engine, decide decimal-to-float conversion and rounding policy, team-to-player result mapping, manual/coop/no-winner outcomes, score edits, draft recovery and conflict handling. Do not overwrite historical results when a template definition changes. Distinguish calculated result from a user's manual override in persistence and UI. Compare a redacted user-owned BG Stats export only for documented play-data compatibility, never as a source of redistributable definitions.

## Prototype limits

No rendered UI, keyboard/mobile/theme/accessibility validation, persistent drafts, team roster, BGG rule mapping, advanced round winner modes, manual subtotal/winner override, translations, rich formulas, user template editor or actual BG Stats detailed-sheet import/export. The demo intentionally uses fictional scoring rules and no BGG template data.
