# SP-NATIVE-01c — Offline play logging and shelf cache

Date: 22 November 2026 · Branch `sp-native-01c` from `origin/main` 506de60 (SP-HOTFIX-01 merged) · Track: Controlled
(migration, App Store build). Not merged, deployed, tagged or submitted. Draft PR for owner review.

## Outcome

With no signal a player can log a play (including Rematch and a scoresheet play) and browse the shelf. On reconnect every
queued play reaches the server exactly once.

- **Server.** `plays.client_id` (nullable UUID string, unique per user) by migration `e5b8c2f1a7d4`. `POST /plays` takes
  `client_id`; a repeat of `(user, client_id)` returns the existing play with **200** and creates nothing (a body that
  differs is ignored). Two requests that race are settled by the unique constraint. `source` / `source_play_id` import
  rules, the timer id and the response shape are unchanged.
- **Queue (`frontend/src/offline/play-queue.ts`).** Every new play gets a random `client_id`. If the server cannot be
  reached (no connection, a timeout, 5xx, 408, 429) the whole play, including `score_breakdown`, scoresheet id and pinned
  version, is stored in a durable queue: iOS Preferences (`@capacitor/preferences` 8.0.1) in the app, localStorage on the
  web. A stored play contains only play fields, so a token cannot be persisted (tested).
- **Sync.** Runs on app open, reconnect, return to the foreground and **Sync now**; in creation order; a network failure
  stops the run and waits with exponential backoff (2 s doubling to 5 min, ±20 %); an item leaves the queue only after a
  2xx. A 4xx marks it **failed** with Retry and a confirmed Discard, and does not block later plays. A session that has
  expired stops the run without losing anything. A light haptic fires when a run syncs something.
- **UI.** "N plays waiting to sync · Sync now" banner (and a Review pointer for failed plays); "Pending sync" /
  "Couldn't sync" badge in Plays and the game's history; queued plays count in Plays and in the game's totals; Edit and
  Delete work on a queued play and change only the queue; "Saved on this device" confirmation (no BG Stats link, since it
  needs the server's play id).
- **Saved copies (`offline/cache.ts`).** Shelf list, collection counts, wishlist, each game's history, the newest 400 plays,
  players, and every scoresheet version opened (the sheets list saves each version it returns) are saved per account
  and used only when the server cannot be reached. Screens say "Offline · … last updated 5 min ago". The profile last
  returned is saved so the app **opens offline**. Tonight, Discover, Stats and Game Night show "needs a connection" with
  Log a play / Browse your shelf / Try again.
- **Sign-out and deletion.** Sign-out and session expiry remove the saved copies and the saved profile; unsynced plays stay
  for that account so signing back in does not lose them. Deleting the account removes its queue too.
- **Analytics.** No new events. `play_logged` fires once, when the person saves, and only through the existing consent gate.

## Evidence

| Check | Result |
| --- | --- |
| Backend, disposable local PostgreSQL | **710 passed, 15 skipped** (skips need other env databases). 10 new API tests: repeat returns the same play with 200 and one row, a changed body is ignored, per-user isolation, one id cannot return another user's play, no id never merges, canonical UUID, a raced duplicate resolved by the constraint, a rejected play can retry with the same id |
| Migration `e5b8c2f1a7d4`, disposable PostgreSQL (`CLIENT_ID_MIGRATION_TEST_DATABASE_URL`) | upgrade keeps plays and nulls, the pair is enforced, another user may reuse an id, downgrade drops the column and constraint, re-upgrade, `alembic check` clean |
| Frontend (`npm test`, ESLint, `tsc -b`, `npm run build`, `check:pwa`, `build:ios`, `ruby fastlane/test/bundle_flags_test.rb`) | **312/312** unit tests (28 new: queue, cache, mapping, connection detection); ESLint, TypeScript, build, PWA and iOS build checks pass; Ruby 4/4. `check:colors` reports 40 raw colours, none in the new files (the spike baseline reports 42) |
| Playwright, **full suite** (`npx playwright test`) | **126 passed, 0 failed, 114 skipped** (the iPhone SE project skips by design; the offline spec runs on iPhone 15 only). The new spec has 10 tests |
| Queue unit tests (`play-queue.test.ts`, 15) | persists across reload with breakdown and pinned version; ordered sync; 2xx-only removal; backoff and cap; **lost reply: server saved, client timed out, retry gives one play**, also across an app restart; 4xx failed + Retry + Discard; edit/delete while waiting and while being sent; expired session; overlapping triggers share one run; no token stored; unreadable storage kept aside |
| Playwright `offline-plays.spec.ts`, 390×844 iPhone 15, light and dark, real local backend | 3-player Wingspan scoresheet play logged offline, pending badge, synced exactly once on reconnect (one POST, 201), nothing resent after reload; edit and delete a queued play; lost reply with the real server (`route.fetch` then abort) ends with one play; failed play with Retry and confirmed Discard; offline screens and the cached shelf. Screenshots `docs/screenshots/sp-native-01c/` |
| **Simulator** (iPhone 17, iOS 27.0, Debug build, local API; **Simulator evidence, not a device**) | signed in, opened the shelf and a game, **stopped the API**, logged a 3-player play ("Saved on this device"), killed and relaunched the app (opened offline, 1 play still waiting), restarted the API, **Sync now**: one POST 201, one row with its `client_id`, banner gone. Screenshots `simulator-1` to `-4` |

## Findings worth knowing

- **iOS sends POSTs through `CapacitorHttp`**, and an offline POST rejects with an error coded `NSURLErrorDomain`, not the
  `TypeError` that `fetch` throws and that the feedback outbox looks for. The first version would have lost plays on a
  phone. `isConnectionFailure` now recognises both, and the feedback outbox uses it too (it was never offline-safe on a
  device). Covered by `request.test.ts` and `cache.test.ts`; the Simulator run exercised it for real.
- **The iOS Simulator has no airplane mode.** "No signal" was made by stopping the local API (connection refused), so
  `navigator.onLine` stayed true; the browser-offline path is covered by Playwright only.
- **UserDefaults is a required-reason API.** `@capacitor/preferences` ships no privacy manifest, so
  `PrivacyInfo.xcprivacy` now declares `NSPrivacyAccessedAPICategoryUserDefaults` (CA92.1).
- **Existing tests changed because behaviour changed.** The SP-SCORE-R01 e2e used a dropped connection to fail the pinned
  sheet; with a saved copy that now succeeds, so it fails the fetch with a 503 instead. Four backend fakes and two SSR tests
  mirror the new `client_id` / provider.
- **Existing test problems fixed so the full suite can pass** (all were already failing on `origin/main`):
  `analytics-choice.spec.ts` (SP-HOTFIX-01) could not be collected, which aborted any full Playwright run; the Feedback test
  asserted app version 1.1 (11) and two Year in Review tests asserted slide titles that no longer exist; and a full run
  signed in more often than the loopback limit allows, so every e2e sign-in now clears it first
  (`local_test_accounts.py reset-rate-limits`, local development databases only).

## Not verified, limits

- **No physical-device test**, no VoiceOver or Dynamic Type check of the new banner and badges.
- The Simulator test used plain scores; the scoresheet path is covered by Playwright and unit tests.
- Edit and delete of a play that is **already on the server** still need a connection (out of scope). A game's history is
  available offline only if it was opened online once; the Plays tab keeps the newest 400 plays.
- First launch with no connection cannot sign in. A session that expired while offline is only found out on the first request
  that reaches the server.
- Last write wins; no two-device merge. A repeat with a changed body returns the stored play unchanged.
- No background sync while the app is closed; Pro live-timer polling offline was not changed.
- A POST that gets no answer for 30 s is treated as unreachable and queued (safe, because the id makes a resend idempotent).
- Build number is **25** (`app-links.ts`). SP-SETTINGS-01b (PR #58) uses 24; the release lane takes the real number from
  TestFlight and refuses a mismatch.

## Rollback

Application: redeploy the previous API/app. The migration is additive; prefer a forward fix. `alembic downgrade c4e7a9b2d6f1`
is tested and drops only the ids, after which the server cannot recognise a retried play (see the runbook). An older app
sends no `client_id` and is unaffected; an app that sends it to an API without the migration would fail every save.

## Owner gates (NEXT)

1. Back up the production database, then run the migration (deploy the API first).
2. Deploy the backend **before** the app build reaches users.
3. Physical-phone airplane-mode test: log, force-quit, relaunch, reconnect, confirm one play; also check VoiceOver and large text.
4. Review the privacy manifest change and the PRIVACY.md rows; confirm no App Store Connect answer changes.
5. Submit (owner only).
