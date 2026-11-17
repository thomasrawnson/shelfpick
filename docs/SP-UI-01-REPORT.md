# SP-UI-01 — Navigation and visual refresh

Branch `codex/sp-ui-01`, draft PR. Based on `origin/main` 862f996 (SP-PLAY-01 merged). Controlled Track; one owner checkpoint (Tonight and Shelf), approved after three rounds of changes.

## What changed

- **Tabs and routes:** Tonight · Shelf · Plays · Discover · Stats. `/picker`, `/collection/*`, `/game-night`, `/insights` and `/rankings` redirect to `/tonight`, `/shelf/*`, `/tonight?mode=vote`, `/stats` and `/shelf/ranking` (query strings and sub-paths kept; logged-out deep links survive sign-in). Guest voting links (`/game-night/join/…`) are unchanged.
- **Tonight:** group size in one row, "Choose players by name", Complexity, Fine-tune, **Find a game**, a text action **Start a group vote**, and a Recently played cover row (hidden until there are plays). The three-mode control from the brief was dropped after review: "Just me" and "A group" duplicated the group-size chips.
- **Shelf:** compact header with "+ Add", search with sort and a Grid/List toggle on one row, small Played/Unplayed chips, cover grid (whole cover visible, two-line titles, "1 play / 14 plays" badge), skeleton while loading, pull-to-refresh.
- **Plays:** history across games grouped by month, filters (game, player, all time / 30 days / this year), prominent **Log play** (choose a game, then the existing form), **Rematch** and **Edit** per play, empty state, pull-to-refresh.
- **Cover accent:** game detail (hero cover on a tinted panel) and the pick result take an accent from the cover; accent text is adjusted to meet WCAG AA on every light and dark surface, with a palette fallback when the cover cannot be read.
- **Motion:** tab transition, pick reveal, skeleton shimmer and pull spinner are all off under reduced motion; light haptic on tab change (existing helper).
- Build number 7 → 8. `PRIVACY.md` gains one device-only row (Shelf layout choice). No backend change.

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
- **Plays tab data:** there is no cross-game plays endpoint, so the tab gathers each played game's recent plays (the API returns about 10 per game). A game with many plays shows only its latest ones, and the screen says so. A small read-only `GET /plays` endpoint would fix this (backend change, deploy before the app); out of scope per the brief.
- The pick-result accent uses the same hook as game detail, but only game detail is exercised in the browser.
- Real BGG cover art, VoiceOver on a device, haptics and the native pull gesture were not tested.
- `e2e/support.ts` and `playwright.config.ts` now read `E2E_API_PORT` / `E2E_WEB_PORT` (default 8000/5173) so tests can run when another server holds the ports.

## Owner gates (NEXT)

1. Physical-phone check with real covers (Tonight, Shelf, Plays, game detail, pick result) and a VoiceOver pass.
2. Decide the Plays data source (client gather now, or add `GET /plays`).
3. Refresh App Store screenshots if they show the old tabs.
4. Review and merge the draft PR; deploy the backend (including the SP-PLAY-01 migration) before the app; submit.
