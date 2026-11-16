# SP-IOS-19B — Monthly Recap Polish and Release Verification

**Status:** PASS WITH RISKS

**Source:** `6eaae6cfa083799fb9fb56c8cf08e6775b429a94`

**Branch:** `codex/sp-ios-19a`

**Worktree:** `/private/tmp/shelfpick-sp-ios-19b`

## Completed

- Replaced the monthly recap's repeated “Cover not available” copy with a
  rights-safe editorial tile containing a branded monogram and the game's
  factual play count for the selected month.
- Preserved game names, totals, most-played copy, BoardGameGeek attribution,
  dimensions, privacy exclusions and the existing ShelfPick visual system.
- Left the server-controlled `EXPORT_COVER_ARTWORK_ENABLED=false` policy and
  fail-closed client behaviour unchanged. The fallback renderer requests no
  cover URL.
- Recreated and reverified the uncommitted SP-IOS-19A Game Night prefill after
  the earlier temporary worktree was removed by system cleanup.

## PostgreSQL verification

- Disposable image: PostgreSQL 16.15, loopback-only, tmpfs storage.
- Alembic upgraded only the disposable application database to head.
- Complete backend suite: **377 passed, 0 failed, 0 skipped**.
- `python -m alembic check`: passed; no new upgrade operations.
- Separate disposable databases were used for application, launch-hardening,
  retention and timer-integrity coverage. The existing development database
  was not started or modified.

## Frontend and iOS verification

- Focused recap, artwork-policy, Game Night, Picker and offline tests: **20 passed**.
- Complete frontend suite: **113 passed**; ESLint, production build and PWA
  validation passed.
- `npm run build:ios`: passed with the approved `.env.ios` origin; Capacitor
  sync completed without tracked native changes.
- Unsigned generic iOS Simulator Xcode build: passed with signing disabled and
  isolated DerivedData. The approved source's checked-in Simulator product
  identifies itself as `com.shelfpick.prototype`, version/build `1.0 (1)`;
  distribution build 2 must therefore use the separately controlled App Store
  signing configuration for `com.plutonightlabs.shelfpick` and increment its
  build number rather than treating this local Simulator product as the release.
- Browser fixtures at 390×844 and 1440×900 in light and dark: no horizontal
  overflow or console warnings/errors. The modal retained its accessible name,
  description, factual image alt text, keyboard opening and Escape focus return.
- PNG download produced `shelfpick-2026-11-recap.png` at 1200×1500. Browser
  file-sharing capability exposed the native-share action; no physical iPhone
  share-sheet test was performed.

## Evidence

- `docs/screenshots/sp-ios-19b/monthly-recap-before.png`
- `docs/screenshots/sp-ios-19b/monthly-recap-after.png`
- `docs/screenshots/sp-ios-19b/monthly-recap-download.png`
- `docs/screenshots/sp-ios-19b/recap-modal-390-light.png`
- `docs/screenshots/sp-ios-19b/recap-modal-390-dark.png`
- `docs/screenshots/sp-ios-19b/recap-modal-1440-light.png`
- `docs/screenshots/sp-ios-19b/recap-modal-1440-dark.png`

The before/after cards are deterministic, private-data-free fixtures rendered
by the real 1200×1500 export code with covers disabled. They use the four game
names reported by the owner; their play counts are illustrative fixture data,
not a claim about the owner's production history.

## Risks

- Owner visual approval and a physical-device check of the revised PNG/native
  share sheet remain open before TestFlight build 2.
- The checked-in native project remains a prototype identity; distribution
  bundle/signing settings and build 2 are a separate Apple release action.
- The branch is uncommitted and has not been pushed, merged, deployed or uploaded.

## Recommended next action

Review the before/after PNGs and light/dark modal captures, then authorise the
exact branch for a separately scoped TestFlight build 2.
