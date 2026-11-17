# Scoresheet format, version 1

Machine-readable definition: [`schema.v1.json`](schema.v1.json) (JSON Schema draft 2020-12).
Worked-example fixtures: [`fixture.schema.v1.json`](fixture.schema.v1.json).
The reference scoring engine is [`score.mjs`](score.mjs); SP-SCORE-01 should reproduce its behaviour.

## Template fields

| Field | Type | Meaning |
|-------|------|---------|
| `format_version` | `1` | Bump only for breaking format changes. |
| `bgg_id` | integer | BoardGameGeek id. The file is `templates/<bgg_id>-<slug>.json`. |
| `name` | string | Display name. |
| `supported_players` | `[min, max]` | Inclusive player counts. |
| `win_condition` | `highest` \| `lowest` \| `cooperative` \| `target` | See "Winning". |
| `target_score` | number, optional | Required for `target`. For `highest` or `lowest` it records the score that ends the game and does not change who wins. Not allowed for `cooperative`. |
| `rounds` | integer \| null | Fixed round count, or `null` for open-ended games. |
| `categories` | array | Ordered scoring lines. See below. |
| `tie_breakers` | array of strings | Ordered category ids; may end with `"shared"`. |
| `result_bands` | array, optional | `{min_total, label}` bands, typically for cooperative games. |
| `source` | object | `rulebook_title`, `edition_or_year`, `checked_against_rulebook`. |
| `notes` | string | Scope limits and caveats. |

### Category

| Field | Meaning |
|-------|---------|
| `id` | `snake_case`, unique within the template. |
| `label`, `help` | Our own wording; the help line tells a player what to enter. |
| `type` | `number` (any entry), `count` (whole number, 0 or more), `boolean` (tick box). |
| `points_per` | Multiplier. Default intent is 1. Negative values make penalties; **0 makes a tracking-only category** that scores nothing but can break ties. |
| `allow_negative` | Whether a `number` entry may be below zero. `count` and `boolean` never can. |
| `scope` | `once` (one entry per game) or `per_round` (one entry per round). |
| `tie_break_direction` | Optional, `higher` (default) or `lower`; used only when the category appears in `tie_breakers`. |

Every field except `tie_break_direction` is required, so a loader never needs defaults.

## Scoring

- `once` categories take a single value; `per_round` categories take an array, one number per round. If `rounds` is an integer the array length must match it; if `rounds` is `null` any length is accepted.
- Points for a category are `raw * points_per`, where `raw` is the value (summed over rounds), and a `boolean` is 1 when ticked, else 0.
- Penalties are entered as positive amounts with a negative `points_per` (for example, Dominion curses use a count with `points_per: -1`).
- A missing entry counts as 0.
- A player's total is the sum of all categories.

## Winning

- `highest` / `lowest`: best total wins.
- `target`: only players with a total at or above `target_score` can win; the highest of them wins. If nobody has reached it there is no winner yet.
- `cooperative`: nobody wins. The fixture and app record one team entry; `result_bands` map its total to a label.

Ties are resolved by walking `tie_breakers` in order. Each id compares the players' raw entries (not points) for that category, using `tie_break_direction`. Evaluation stops at `"shared"` or when one player remains; anyone still tied shares the win.

## Source and checking

`source.checked_against_rulebook` is `false` until someone compares the template with the printed rulebook for the named edition, and `true` afterwards. All 25 initial templates are `false`.

## Fixtures

`fixtures/<bgg_id>.json` holds `players` (names and entries), `expected.totals`, `expected.winner` (list of names, empty for coop or target-not-reached), `expected.result_band` where the template has bands, and a `provenance` of `rulebook-example` or `hand-calculated`.

## Version policy

Changes that add optional fields stay on version 1. Anything that changes the meaning of existing fields creates `schema.v2.json` with a migration; there are no compatibility shims in v1.
