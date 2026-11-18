# SP-SCORE-01 — Scoresheets in the app

Date: 18 November 2026 · Branch `codex/sp-score-01` from `origin/main` 1ead579 ·
Track: Controlled (migration, App Store build). Not merged, deployed or submitted.

## Outcome

When logging or editing a play, a player can tap **Use scoresheet** for any
game with a built-in or custom sheet. A category × player grid (players as
columns, category labels pinned on the left) opens a maths keyboard (+ − ×,
delete, clear; "12+7×2" evaluated by a small parser, never `eval`). Totals,
places and the winner, or the co-op band, update as you type. The player can
override the calculated winner, and the sheet then says "Winner chosen by hand"
with a "Use calculated result" button. A light haptic fires when every cell is
filled. **Plain scores** goes back to ordinary entry, keeping each total.

The server is the source of truth: it validates every breakdown, computes
totals, ranks, winners and the solo target result, and stores them with the
exact sheet version. Pro accounts can build, edit and delete their own sheets
for any game in the same format, with a live preview.

## Prerequisites checked

SP-PLAY-01 (#33), SP-SCORE-00 (#31) and SP-UI-01 (#36) are merged into `main`.
SP-SCORE-00b (#35, 19 more templates) is **not** merged, so 25 built-ins seed
today; the other 19 seed automatically once #35 merges.

## Data and migration (`d2b6f0a9c4e8`, revises `a7c1e9d3b5f2`)

- `scoresheets`: `id`, `bgg_game_id` (nullable), `owner_user_id` (null for
  built-ins, cascade on account delete), `schema` JSON, `format_version`,
  `version`, `archived_at`, `created_at`, `updated_at`. A partial unique index
  allows one built-in per game.
- `scoresheet_versions`: an immutable copy of every version. Plays logged
  on version 1 still reads and edits on version 1 after the sheet changes.
  This table goes beyond the brief; it is what makes acceptance criterion 1
  ("older plays readable and editable") hold.
- `plays.scoresheet_id` (SET NULL), `plays.scoresheet_version`,
  `plays.result_overridden` (default false), and
  `play_participants.score_breakdown` JSON.
- Additive only; existing plays are unchanged. The downgrade drops the new
  tables and columns, and with them every breakdown and custom sheet.
- Deleting a custom sheet archives it, so plays logged on it stay readable.
- Account deletion removes custom sheets and their versions.

## Seeding

`python -m scripts.seed_scoresheets` validates every template in
`scoresheets/templates` against `schema.v1.json` (the same keyword subset as
`lib/json-schema.mjs`) and the semantic rules from `validate.mjs`. It writes
nothing if any template is invalid. Unchanged templates are skipped; a changed
template becomes the next version. `render.yaml`'s pre-deploy command is now
`alembic upgrade head && python -m scripts.seed_scoresheets`.

## API

- `GET /scoresheets?bgg_id=` lists built-ins first, then the caller's own.
- `GET /scoresheets/{id}?version=` returns a built-in or the caller's own
  sheet; another account's sheet is a 404.
- `GET /scoresheets/mine`, `POST`, `PUT /{id}` and `DELETE /{id}` need the
  `custom_scoresheets` capability (403 otherwise). Custom sheets have their
  `source` forced to "Custom scoresheet", unchecked against a rulebook, plus
  size limits.
- `POST /plays` and `PATCH /plays/{id}` accept `scoresheet_id`,
  `scoresheet_version`, `result_override` and `participants[].score_breakdown`.
  Client scores are ignored when a sheet is used. Editing a breakdown
  recalculates the outcome; `scoresheet_id: null` returns the play to plain
  scores and keeps the totals.
- Co-op sheets record one team breakdown, which is stored on every participant.

## Capability (owner default kept)

`custom_scoresheets` is a Pro feature. Free accounts see no builder, upsell or
Pro-comparison row until SP-PRO-01 can sell Pro. Built-in sheets are free.
Logging with an existing custom sheet still works after a downgrade.

## BG Stats export

The export is unchanged: it sends totals, places and winners only. A
Playwright check confirms the link contains `"score":75` and no category ids.

## Fixed during testing

- `.play-sheet-form` is a scrolling flex column, and the player list has
  `overflow: hidden`. Once the form grew past the screen height, the list
  collapsed to zero height. This was a latent bug from SP-UI-02; the form's
  sections no longer shrink.
- On an iPhone 17 Simulator the keypad opened half off-screen. On phones it is
  now docked to the bottom of the screen with matching scroll space, and the
  active cell scrolls into view above it.
- An empty sheet showed "everyone shares the win"; it now shows no result, and
  saving an empty sheet is blocked.

## Evidence

| Layer | Result |
| --- | --- |
| Backend pytest (disposable PostgreSQL test DB) | 513 passed, 15 skipped (Postgres-only suites run separately) |
| Migration upgrade, downgrade and re-upgrade, seed idempotency (`test_scoresheets_migration_postgres.py`, `test_play_results_migration_postgres.py`) | 2/2 pass; `alembic check` clean |
| Engine: all 25 SCORE-00 fixtures, Python and TypeScript engines | Every total, winner and band matches |
| Engine property tests: ties, negatives, lowest-wins, tie-breakers, target, co-op | Pass (brute-force comparison, 300 random plays per case) |
| API tests (fixtures through the backend, isolation, 403 gate, versioning, override, recalculation, account deletion) | 36 pass |
| Frontend `npm test` / lint / tsc and build / `check:pwa` | 188 pass / clean / pass / pass |
| `node scoresheets/validate.mjs`, `scoresheets.test.mjs` | 25/25, 10/10 |
| Playwright `scoresheets.spec.ts`, iPhone 15 WebKit at 390x844, light and dark | 8/8: Wingspan with built-in sheet and override, edit breakdown, Skyjo lowest-wins with open rounds, Hanabi co-op, Pro build-use-delete, Free sees no builder |
| Playwright Dynamic Type AX1/AX3/AX5, grid and keypad | 3/3; keypad spoken output checked ("4 plus 2 equals 6") |
| Full Playwright suite | 67 passed, 8 failed, 63 skipped. All 8 failures are iPhone SE onboarding sign-in throttling (known from SP-SETTINGS-01); those specs pass alone, 10/10 |
| **Simulator** (iPhone 17, iOS 27.0, local backend, Free account) | Pass: built-in sheet, keypad sum "40+12 = 52", Next, save; history shows the server result (61, #1 Won). **Simulator evidence only — not physical-device or VoiceOver evidence.** |

Screenshots: `docs/screenshots/sp-score-01/`.

## Not verified

- No physical-iPhone check and no real VoiceOver session; the accessible names
  were checked from the accessibility tree only.
- The Render deploy must check out the whole repository, because seeding reads
  `../scoresheets`. If the API service is not managed by `render.yaml`, the
  dashboard pre-deploy command has to be updated by hand.
- At AX5 the existing sheet header crowds "Log play" beside Save. This
  predates SP-SCORE-01 and is not fixed here.

## Owner gates (in order)

1. Back up the production database, then run the migration and seed through
   the pre-deploy command.
2. Deploy the backend before the app. Build 12 needs the new endpoints;
   build 11 ignores them.
3. Check on a physical phone, including VoiceOver on the grid and keypad.
4. Archive 1.1 (12) with company staging, then submit.

Merge order: SP-SETTINGS-01's migration `b8d2f4a6c1e3` also revises
`a7c1e9d3b5f2`. Whichever merges second must re-point its `down_revision`, or
Alembic will have two heads.
