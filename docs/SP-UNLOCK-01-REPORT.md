# SP-UNLOCK-01 — Switch on what's built

**STATUS: PASS WITH RISKS** (local candidate on `codex/sp-unlock-01`; draft PR for owner review). Nothing deployed, pushed to main, submitted or changed in production.

## Completed
1. **Free phone voting.** `game_night_enhanced` is now FREE (name kept); the Pro 403 gate was removed from `backend/api/routers/game_night.py`. `PHONE_VOTING_V1_AVAILABLE = true`. Comparison view, `docs/free-pro-capability-audit.md`, ROADMAP/DESIGN no longer claim voting is Pro. `render.yaml` still has `GAME_NIGHT_PHONE_VOTING_ENABLED=false`. With the server flag off, the host sees "Phone voting is unavailable in this version."; the guest page was **fixed** to show the existing "Phone voting isn't available" state instead of a vote heading with a futile "Try again".
2. **Guest CTA.** "Get ShelfPick" (`https://apps.apple.com/app/id6833957995`, no parameters, no data collected) after a vote is cast and on closed results. Hidden inside the native app. The App Store ID came from Apple's public lookup for `com.plutonightlabs.shelfpick` (listing live, v1.0).
3. **Powered by BGG on exports.** Unmodified `powered-by-bgg-rgb.svg`, uniformly scaled, plus `boardgamegeek.com` beneath, in both cards; ShelfPick logo kept. Cover-art policy untouched (`EXPORT_COVER_ARTWORK_ENABLED` still off).
4. **Haptics.** `@capacitor/haptics@8.0.2` (peer `@capacitor/core >=8`). Light impact on Pick reveal, vote cast, play saved, segmented/filter/Discover tab selection. One helper, no-op on web.
5. **Review prompt.** `@capacitor-community/in-app-review@8.0.0` (peer `>=8`). At most once per 90 days, on recap shared, vote closed with a winner, or third saved play; iOS-native only; throttle in local storage.
6. **Privacy draft.** Guest nicknames, ballots, 12-hour window and provisional 30-day retention added to `LegalDraftView` and `docs/privacy-notice-draft.md`; owner approved the wording 2026-11-17 (legal review not recorded). Published pages and draft routes untouched (build gate: drafts disabled).
7. **iOS build number** 1 → 6 in `project.pbxproj` (build 5 is in review; the release process otherwise injects the number into a staged project). `npx cap sync ios` run.

## Evidence
| Check | Result |
| --- | --- |
| Backend full suite (fresh migrated local DB `shelfpick_development`) | 370 passed, 13 skipped |
| Backend free create/open/close, guest join/vote/change/abstain, 503 with flag off | passed (`test_game_night_voting_api.py`) |
| Frontend `npm test` | 127 passed |
| ESLint, `tsc -b`, production build, `check:pwa`, `build:ios` + `cap sync` | pass |
| Playwright full suite (real local backend, Chromium-less WebKit iPhone profiles) | 23 passed, 5 skipped |
| `e2e/phone-voting.spec.ts`, 390×844 light and dark, flag on: free host QR, guest votes, CTA, close, results CTA | passed |
| Same spec, flag off: truthful host and guest unavailable state | passed |
| `e2e/export-bgg-logo.spec.ts` real-canvas pixel check of share-card and recap PNGs (mean diff < 2) | passed |
| Mock unit tests: logo drawn at native aspect, old text gone, covers off | passed |
| Haptics helper and review-prompt throttle unit tests | passed |

Screenshots: `docs/screenshots/sp-unlock-01/` (Playwright/browser evidence, plus the export PNGs).

**Simulator evidence (iPhone 17, iOS 27 Simulator — NOT physical-device evidence):** Free account logged in against a local backend with voting enabled, Game Night shortlist, **Open phone voting** shown to a Free account, QR + join link + Close button displayed: `docs/screenshots/sp-unlock-01/SIMULATOR-host-qr-free-account-iphone17.png`. The Simulator bundle used a throwaway local API URL; the production-pointed bundle was rebuilt afterwards. An unsigned Simulator build cannot use the Keychain (-34018); an ad-hoc signed build was used.

## Risks
- Haptics, the review prompt and the native vote CTA hiding were not exercised on a device or in the Simulator beyond the smoke test.
- Review prompt shows only at iOS's discretion; Apple may suppress it.
- Pre-existing: `shelfpick_dev` local DB lacks migrations (9 backend tests fail there, same on clean `main`); `check:colors` reports raw-colour findings that already existed; shortlist cards render narrowly in the app (not changed here).
- No root `PRIVACY.md` exists in this repo although CORE.md expects one for shipped-dependency changes; two new SDKs were added.
- `studio/pluto-standards/standards/DEVELOPMENT-WORKFLOW.md`, named in AGENTS.md, does not exist.
- Tab-bar (bottom navigation) selection has no haptic; only segmented/filter/Discover tabs do.
- Second Brain note not updated (outside this repository).

## Owner gates (NEXT)
Privacy/legal sign-off on guest data and notice wording; physical two-phone QR test on mobile data; flip `GAME_NIGHT_PHONE_VOTING_ENABLED` in production; App Store submission.
