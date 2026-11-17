# SP-YIR-01 — Year in Review 2026

Branch `codex/sp-yir-01`, draft PR. Free for all users. Controlled Track release item (submit by about 10 December 2026).

## What shipped

- **Backend** `GET /insights/year-recap?year=&timezone=` (authenticated, 422 on a bad year or timezone). The monthly recap and the year recap now share one period query (`InsightsRepository.get_period_summary`) and one timezone/bounds helper in the service. Half-open local-time bounds are converted to UTC. All figures are SQL aggregates: plays, unique games, recorded minutes with timed-play count, top 5 games (ties: last played, then name, then BGG id), new-to-you games (first-ever account play falls in the year), plays per month, busiest month, plays per weekday, busiest weekday, longest timed play, top 3 co-players. Imported plays count. No migration.
- **Story** (`YearRecapStory`): 8 slides (totals, top 5, new-to-you, months bar, weekday, longest play, co-players in-app only, closing/share). A year with fewer than 3 plays gets totals, top games and closing; slides with no data are skipped; 0 plays shows an explanation instead. Tap (left third back, elsewhere forward), swipe, Previous/Next buttons, arrow keys, Escape. Progress bars, light haptic on slide change. Auto-advance (8 s) with a Pause button; with reduced motion there is no auto-advance, no Pause and no animation. Each slide is a labelled group ("Slide 3 of 8: New to you. …") with the content spoken in the label; the month chart has a text label.
- **Entry points**: Insights → Recaps shows the Year in Review card (replacing the placeholder) above the monthly recap; a dismissible Pick banner shows 1 Dec–31 Jan (user's timezone) only when the year has plays, and opens the story.
- **Share**: 1080×1920 PNG, initials artwork, ShelfPick logo, unmodified Powered by BGG logo plus "boardgamegeek.com". No covers, photos, scores or locations. Co-player names are off by default behind a "Player names" checkbox. Native share sheet with download fallback (same as the monthly card).
- Build number 6 → 7 (`CURRENT_PROJECT_VERSION`).

## Evidence

| Layer | Result |
| --- | --- |
| Backend (automated) | Full suite 385 passed, 13 skipped (DB `shelfpick_development`). New: `test_year_recap_postgres.py` (London 31 Dec 23:30 and Auckland bounds, imported plays, empty year, one-play year, deterministic ties, account isolation, 5,000 plays under 500 ms), plus endpoint/validation tests. Existing monthly recap tests pass unchanged. |
| Frontend (automated) | `npm test` 143 pass; `npm run lint` clean; `npm run build` (with `VITE_API_BASE_URL` set) and `check:pwa` pass; `build:ios` passes. `check:colors` reports only pre-existing raw colours. |
| Browser (Playwright, WebKit) | Full suite: 38 passed, 26 skipped (other project). New `e2e/year-recap.spec.ts` at 390×844 light and dark: every slide, swipe and tap, auto-advance and Pause, reduced motion, empty state, share preview, Pick banner in/out of window, PNG check (1080×1920, logo pixel match, no non-brand image requests, names absent by default). `dynamic-type.spec.ts` covers the story at AX1/AX3/AX5. |
| Simulator (not a physical device) | Unsigned (`CODE_SIGN_IDENTITY="-"`) Simulator build of build 7 on iPhone 17 launched to the sign-in screen. I did not sign in: the iOS build points at production, which does not have the endpoint yet, and I did not use a real account. |

Screenshots: `docs/screenshots/sp-yir-01/` (story light/dark, entry empty, Pick banner, share preview, exported PNGs, Simulator launch).

## Not verified

- Physical iPhone, VoiceOver walkthrough with a real screen reader (labels are asserted in the DOM only), and haptics on device.
- The story against the real endpoint end to end in a browser (Playwright mocks the API response; the endpoint is covered by backend tests).
- Native share sheet (download path only in the browser).

## Notes and decisions for the owner

- **Privacy**: no new server data or fields; the endpoint reads existing plays, games and players for the signed-in account only. One new device-only flag (banner dismissal per year) is added to the `PRIVACY.md` data table (draft edit, please confirm). Player names appear only in-app, and in the image only if the user ticks the box.
- Auto-advance was included because the brief mentions reduced motion turning it off; it can be removed by deleting one effect if you prefer a purely manual story.
- The year shown is the current year, or the previous year during January.
- Worktree setup: `.env`, `node_modules` and `.venv` were linked/copied locally (not committed). `ios/App/CapApp-SPM/Package.swift` was reverted after the Simulator build because it picked up worktree-relative paths.

## Owner gates (NEXT)

1. Physical-phone check of the story, share sheet and VoiceOver.
2. Review and merge the draft PR.
3. Deploy the backend to Render **before** the app build reaches users.
4. Submit build 7 (owner only; nothing was touched in App Store Connect).
