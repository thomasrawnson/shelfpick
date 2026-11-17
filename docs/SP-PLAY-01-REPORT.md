# SP-PLAY-01 — Play logging foundation

**STATUS: PASS WITH RISKS** (local candidate on `sp-play-01`, based on `origin/main` 5650806; draft PR for owner review). Nothing deployed, migrated in production, submitted or pushed to main.

## What changed
- **Data model / migration `a7c1e9d3b5f2`** (after `f3a8c2d4e6b1`): `plays.outcome_type` (competitive | cooperative | team | solo, default competitive), `plays.coop_result` (won | lost | null), `play_participants.team`, `rank`, `role`; CHECK constraints on the enums and `rank > 0`.
- **Backfill:** every existing play becomes `competitive` through the column default; team/rank/role stay NULL; `is_winner` is untouched, so win/loss/draw/unknown counts cannot change. `is_winner` stays and is now derived at write time (co-op won → all; team → winning team; rank 1), so SQL win counts (Insights frequent players) stay correct.
- **API:** `PATCH /plays/{id}` (owner only; 404 for another user's play), partial edit of game, date, duration, location, participants, outcome type, co-op result. `POST /plays` accepts the new fields. Rules live in `services/play_results.py` (co-op needs a result and no winners; team needs 2+ teams and a team per player; ranks positive, all-or-none; solo = one player). `source`, `source_play_id` and `timer_session_id` are never edited. CORS now allows `PATCH` (found by the browser run).
- **Outcomes:** `_participant_outcome` → `resolve_outcome`: co-op/solo shared result; team members share the result (two winning teams = draw); rank 1 wins, shared rank 1 draws; flag-only plays keep the previous logic exactly (including the "Cooperative Game" mechanic rule and scored ties); no result = unknown.
- **BG Stats import:** maps `rank`, `team`, `role`, game `cooperative` (won if all players are winners, else lost) and play `usesTeams`. Combinations ShelfPick rejects (e.g. ranks on some players only) import as plain competitive plays with their winner flags. Re-import is idempotent; existing plays are never rewritten, so edits survive.
- **Send to BG Stats payload:** adds `rank`, `team`, `role` per player and `cooperative` on the game; a won co-op marks everyone a winner. These names mirror the export format the importer already reads; **not verified against BG Stats' live createPlay documentation**.
- **UI:** result-type selector, co-op/solo Won/Lost, team names + winning team, optional place, Edit on each history play (reuses `PlayLogForm`), Rematch on history plays and in the saved confirmation (picker play entry now stays on the confirmation with Rematch / Done instead of leaving immediately). Haptics via the existing helper.
- iOS build number 7 → 8.

## Evidence
| Check | Result |
| --- | --- |
| Backend full suite (disposable local PostgreSQL) | 433 passed, 13 skipped (skips need other env DBs) |
| Migration test on seeded fixture (`PLAY_MIGRATION_TEST_DATABASE_URL`): upgrade, win/loss/draw/unknown 4/2/2/3 before and after, downgrade, re-upgrade | passed |
| Migration on a copy of the local dev DB (26 plays; **not production data**) upgrade, `alembic check`, downgrade | passed |
| API tests: every field, other user's play, imported-play edit + re-import, validation matrix, co-op/team logging, CORS | passed (`test_play_edit_api.py`, `test_play_results.py`) |
| BG Stats fixtures: new fields, partial ranks, co-op, old format | passed |
| Frontend `npm test` | 148 passed |
| ESLint, `tsc -b`, build, `check:pwa`, `build:ios` | pass (`check:colors` reports 10 raw colours that exist on `origin/main`; none are new) |
| Playwright 390×844 light + dark, real local backend: log co-op, log team, edit, Rematch (confirmation and history) | 2 passed; screenshots `docs/screenshots/sp-play-01/` |
| iOS Simulator smoke test (iPhone 18 Pro, **Simulator evidence, not a device**; Debug build pointed at a local backend on the local dev DB): log in, open game, new result-type selector, log a co-op Won play, confirmation shows Rematch and Send to BG Stats, Rematch opens a fresh form, row stored as `cooperative`/`won`. Team, edit and picker flows were not repeated on the Simulator (covered by Playwright). The Simulator was very laggy; one cosmetic fix (chip label spacing) followed. | pass |
| Physical device | **Not run** |

## Rollback
The migration is additive. Preferred rollback is to forward-fix. If required: stop the new API, `alembic downgrade f3a8c2d4e6b1` (tested; drops only the new columns, losing any co-op/team/rank data recorded since), then redeploy the previous API. An older API is compatible with the migrated schema, so downgrading is only needed to remove the columns.

## Risks / limits
- Insights "frequent players" win count still counts any rank-1 or scored tie as a win (as before); player profile win rate separates draws.
- UI keeps the game fixed when editing (the API supports changing it).
- `role` is stored, imported and exported but has no input field.
- Legacy coop-game plays stay `competitive` (backfill is deliberately count-preserving).
- Reference `standards/DEVELOPMENT-WORKFLOW.md` named in AGENTS.md does not exist.

## Owner gates
Back up before the production migration; deploy the backend (and migration) before the app; physical-phone check; submit.
