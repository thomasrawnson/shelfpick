# SP-STATS-01 — Stats 2.0

Date: 18 November 2026 · Branch `sp-stats-01` from `origin/main` 601dea0 ·
Track: Controlled (Free/Pro boundary, App Store build). Not merged, deployed or
submitted.

## Prerequisites

SP-PLAY-01 and SP-SCORE-01 are both in `origin/main` (601dea0, PR #41). The
shared `standards/DEVELOPMENT-WORKFLOW.md` named in `AGENTS.md` does not exist
in `pluto-standards`; `CORE.md` was used instead (broken shared reference).

## Outcome

Stats opens on **Trends**.

Free: weekly play streak (current, best, "at risk" when this week is empty),
H-index with the games to play to reach the next level, plays per month
(12 or 24 months), a calendar heatmap for a chosen year.

Pro (`advanced_stats`): per-game score records (best, average, lowest, highest
losing score, best category from scoresheet breakdowns), head-to-head for two
players, filters (date range, player, location, player count) applied to every
Trends number, and **Help my H-index** in the Picker's Fine-tune.

Free accounts see one short locked preview (no modal, no price, no Buy action).

## Backend (`backend/`)

- `repositories/stats_repository.py`: SQL aggregates, account-scoped, timezone
  aware (`timezone(<IANA>, played_at)`). Outcomes (win/loss/draw/unknown) are
  computed in SQL with window functions that mirror
  `services/play_results.resolve_outcome`.
- `services/stats_service.py`: H-index, streaks, filter building, Picker boosts.
- `api/routers/stats.py`: `GET /stats/plays-per-month`, `heatmap`, `h-index`,
  `streak` (Free); `records`, `head-to-head`, `filter-options` (Pro). Any filter
  parameter on a Free account is 403. `GET /picker?help_h_index=true` is 403 for
  Free (`get_picker_h_index_boosts`).
- No migration, no new dependency.

### Rules

- **H-index**: largest h with h games played at least h times; every account
  play counts (imports included). Raise list = the `h+1-k` cheapest games to
  reach h+1 (k already have h+1 plays), owned unplayed games included.
- **Week**: ISO week (Monday) in the caller's timezone; year boundaries work
  because weeks are dates. A streak stays alive through an empty current week.
- **Records**: over participant scores. With a player filter only that player's
  scores count. Highest losing score uses per-participant outcomes, so lost
  co-op plays and losing teams count. Best category is the highest single
  category entry, from the exact sheet version the play used.
- **Head-to-head**: plays both took part in. Co-op/solo plays and plays on the
  same team are counted separately and never in wins. Otherwise ranks decide
  when both have one, else recorded winners; no result is "undecided".
- **Picker boost**: +6 for a game one play from counting toward the next
  H-index, +3 for two plays; only when the capped score changes, and then the
  result lists "Helps your H-index: ...". Never changes eligibility.

## Frontend (`frontend/`)

`components/stats/` (`TrendsPanel`, `BarChart`, `Heatmap`, `ProStatsPanel`,
`StatsFilters`, `useStats`), `stats-model.ts`, `styles/stats.css`, the Picker
toggle in `PlayerStep`/`PickerView`, API client additions. Charts are hand-rolled
SVG with a summary `aria-label` and a "View as a table" disclosure; skeletons
while loading; marks use the brand token. The Stats section tabs now wrap
(five sections).

## Evidence

| Layer | Result |
| --- | --- |
| Re-check after merging `origin/main` c768e16 (SP-SETTINGS-01), 18 Nov | Only conflict: the `npm test` list in `frontend/package.json` (stats tests combined with `tip-jar`, `feedback`). Backend `pytest` 593 passed, 16 skipped, one Alembic head `b8d2f4a6c1e3`, `alembic check` clean. Frontend `npm test` 225 passed, lint, build, `check:pwa` pass. Playwright and Simulator not re-run after the merge. |
| Backend automated | `pytest`: 541 passed, 15 skipped (disposable DB `shelfpick_stats01_test`, migrated to head, 25 built-in sheets seeded). `alembic check`: no drift. |
| 10,000-play budget (local PostgreSQL) | plays-per-month 2 ms, heatmap 1 ms, H-index 2 ms, streak 2 ms, records 53 ms, head-to-head 83 ms, filtered records 18 ms, filter-options 6 ms, Picker boosts 2 ms (limit 500 ms) |
| Frontend automated | `npm test` 208 passed incl. `stats-model`, `stats-contrast` (light, dark, black: bars and every heatmap level >= 3:1, chart text >= 4.5:1) and `stats-trends` (tables, locked preview, Pro-only toggle); `npm run lint`, `npm run build` (with `VITE_API_BASE_URL`), `npm run check:pwa` pass |
| Browser (Playwright WebKit, mocked `/stats` data, real local Free and Pro accounts and entitlements) | `e2e/stats-trends.spec.ts`: Free and Pro x 390x844 and 1440x900 x light and dark, axe `color-contrast` clean, no page overflow; Picker toggle hidden for Free. Related Stats/layout/refresh/year-recap/dynamic-type specs also pass. Screenshots: `docs/screenshots/sp-stats-01/` |
| Simulator (iPhone 17, build 13, Debug, ad hoc signed, **Simulator evidence only**) | Signed in as the local Pro account, Stats opens on Trends with Filters at AX3XL text. Not physical-device, VoiceOver or owner evidence. |

## Not done / risks

- Physical-device and VoiceOver walkthrough of the charts are pending (owner).
- Playwright data is mocked; live aggregates are covered by backend tests.
- The local `shelfpick_dev` database was upgraded to head (two additive
  migrations) to run the browser suite. Production needs no migration for this
  task.
- Pro cannot be bought yet (SP-PRO-01 paused); Pro features are testable on PRO
  accounts only.
- Heatmap uses the device timezone via `Intl`; a user travelling sees days in
  their current timezone.

## Rollback

Revert the PR. No schema change; build 13 changes `CURRENT_PROJECT_VERSION` only.
Deploy order: backend first (new endpoints are additive), then the app.
