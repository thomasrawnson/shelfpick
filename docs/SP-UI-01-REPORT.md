# SP-UI-01 — Navigation and visual refresh

Branch `codex/sp-ui-01`, draft PR. Based on `origin/main` 862f996 (SP-PLAY-01 merged). Controlled Track; one owner checkpoint (Tonight and Shelf), approved after three rounds of changes.

## What changed

- **Tabs and routes:** Tonight · Shelf · Plays · Discover · Stats. `/picker`, `/collection/*`, `/game-night`, `/insights` and `/rankings` redirect to `/tonight`, `/shelf/*`, `/tonight?mode=vote`, `/stats` and `/shelf/ranking` (query strings and sub-paths kept; logged-out deep links survive sign-in). Guest voting links (`/game-night/join/…`) are unchanged.
- **Tonight:** group size in one row, "Choose players by name", Complexity, Fine-tune, **Find a game**, a text action **Start a group vote**, and a Recently played cover row (hidden until there are plays). The three-mode control from the brief was dropped after review: "Just me" and "A group" duplicated the group-size chips.
- **Shelf:** compact header with "+ Add", search with sort and a Grid/List toggle on one row, small Played/Unplayed chips, cover grid (whole cover visible, two-line titles, "1 play / 14 plays" badge), skeleton while loading, pull-to-refresh.
- **Plays:** history across games grouped by month, filters (game, player, all time / 30 days / this year), prominent **Log play** (choose a game, then the existing form), **Rematch** and **Edit** per play, empty state, pull-to-refresh.
- **Cover accent:** game detail (hero cover on a tinted panel) and the pick result take an accent from the cover; accent text is adjusted to meet WCAG AA on every light and dark surface, with a palette fallback when the cover cannot be read.
- **Motion:** tab transition, pick reveal, skeleton shimmer and pull spinner are all off under reduced motion; light haptic on tab change (existing helper).
- Build number 7 → 8. `PRIVACY.md` gains one device-only row (Shelf layout choice). One small read-only backend endpoint, `GET /plays` (owner-approved scope change; see Plays tab data).

## Evidence

| Layer | Result |
| --- | --- |
| Unit | `npm test` 161 pass. New: route/legacy redirect tests (every old URL and deep link, guest links untouched), plays feed, cover accent (AA on all surfaces for 14 hues), pull-to-refresh, recently played. |
| Static | ESLint clean, TypeScript clean, `npm run build`, `check:pwa`, `build:ios` pass. |
| Browser (Playwright, WebKit) | Full suite 51 passed, 41 skipped (other phone project), 2 failed (below). New `e2e/ui-refresh.spec.ts`: all five tabs at 390×844 and 1440×900, light and dark (name, current marker, no sideways overflow); Plays filters/Rematch/Edit/Log play/empty state; reduced motion; pull-to-refresh; cover accent contrast in both themes; Shelf last row clears the tab bar. `dynamic-type.spec.ts` covers all five tabs at AX1/AX3/AX5. |
| Simulator (not a physical device) | Unsigned build 8 on iPhone 17 launched to the sign-in screen. I did not sign in (production API, no real account). |

Screenshots: `docs/screenshots/sp-ui-01/before/` (old Pick, Collection, Discover, Insights, 390px) and `after/` (all tabs, 390 and 1440, light and dark), plus `checkpoint/`. Shelf and Recently played covers in the screenshots are synthetic sample art.

## Known failures and gaps

- `play-logging.spec.ts` (SP-PLAY-01) fails 2 of 2 on this branch **and on a clean `origin/main`** against my local database (the first detail is the earlier co-op play, not the newer team play). It is not caused by this change; it needs a look by whoever owns SP-PLAY-01.
- The local dev database was behind the SP-PLAY-01 migration; I ran `alembic upgrade head` on the **local** `shelfpick_development` only.
- **Plays tab data:** owner chose a new read-only `GET /plays?limit=&offset=` (newest first, limit 1-200, returns `total` and the plays with participants and outcomes, scoped to the signed-in account and games still on the shelf). The tab pages through it, so full history shows with one request per 200 plays instead of one per game. **Deploy the backend before the app build**; no migration is needed. Tests: `test_play_edit_api.py` (ordering, paging, account scoping, empty, validation).
- The pick-result accent uses the same hook as game detail, but only game detail is exercised in the browser.
- Real BGG cover art, VoiceOver on a device, haptics and the native pull gesture were not tested.
- `e2e/support.ts` and `playwright.config.ts` now read `E2E_API_PORT` / `E2E_WEB_PORT` (default 8000/5173) so tests can run when another server holds the ports.

## Accepted exception: npm audit

On 2026-11-17 the CI `npm audit --audit-level=high` step began failing on this branch and on `main` (12 high advisories, now 17 after a safe `npm audit fix`: `glob`, `minimatch`, `picomatch` under vite 8 and vite-plugin-pwa). Not caused by this change. The only npm fix is `--force` (downgrades vite to 6.2.7). Owner accepted merging with the gate red; the packages are build-time tooling and not part of the shipped app. A proper dependency fix is a separate follow-up.

## Owner gates (NEXT)

1. Physical-phone check with real covers (Tonight, Shelf, Plays, game detail, pick result) and a VoiceOver pass.
2. Deploy the backend (includes `GET /plays` and SP-PLAY-01's migration `a7c1e9d3b5f2`) before the app build.
3. Refresh App Store screenshots if they show the old tabs.
4. Review and merge the draft PR, then deploy the backend, then submit the build.
