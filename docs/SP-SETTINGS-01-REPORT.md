# SP-SETTINGS-01 — Settings redesign, tip jar and feedback

Branch `codex/sp-settings-01` (worktree `~/Developer/_worktrees/shelfpick/sp-settings-01`), from `aacfee6` (origin/main). Controlled Track. Not pushed.

## Owner decisions (2026-11-18, in session)

- **Tip jar:** SP-PRO-01 has no purchase layer in the repo (no StoreKit code on any branch). The tip jar is built on a `PurchaseLayer` interface with a dev-only stand-in. The row is hidden in release builds until a real StoreKit layer exists.
- **Rows with nothing to reuse are left out:** App icon, Which player is you (and its footer), Players and groups, Shelf view, Hide expansions (which also conflicts with the backend rule that always excludes expansions), Roadmap (also dropped from the feedback sheet), Export and backup, and BGG play import. With no Pro-only rows left, no crowns are shown.
- **Feedback** was approved with a PRIVACY.md update. Device info is sent only when the toggle is on.
- **Tip count and Supporter badge** are stored on this device only.

## What changed

- **Settings root**, in this order:
  - Title, then a profile card ("Account, plan and log out", FREE/PRO pill, Supporter badge), then the Unlock ShelfPick Pro card (Free users only).
  - **Appearance:** Theme, an inline native menu (Dark, Light, System, plus the existing Black).
  - **Players and picking:** Picker defaults.
  - **Collection:** BoardGameGeek sync, with a status dot and relative time.
  - **Data and backup:** Import plays (BG Stats).
  - **Support ShelfPick:** Tip jar, and Leave a review (App Store `?action=write-review`).
  - **Feedback:** Request a feature, Report a problem, What's new.
  - **Follow ShelfPick:** Website, YouTube.
  - **About:** Help, Contact (mailto), and Privacy policy (behind the existing public-legal-links gate, which is off in iOS builds).
  - Footer: "ShelfPick 1.1 (11) · Pluto Night Labs" with the repo's Powered by BGG logo.
- **Removed:** the Appearance and Play history screens and routes, and `getPlayCount`. "Help, about and contact" is now "Help".
- **Constants:** `SOCIAL_LINKS`, `REVIEW_URL`, `CONTACT_URL`, `APP_VERSION` and `APP_BUILD` are in `frontend/src/app-links.ts`. Tip product IDs and prices are in `frontend/src/tip-jar.ts`.
- **Tip jar sheet:** loading, load failed, ready, purchasing, pending, cancelled (returns quietly), failed (message, count unchanged) and a thank-you state with the tip count.
- **Feedback sheet:** a type control, a 10 to 2,000 character message with a counter, "Email me back", "Include app and device info", and Send.
  - Offline, the message is queued on the device per account and sent on the next sign-in or `online` event. Nothing is dropped.
  - Server errors keep the text in the box.
- **Backend:**
  - New `feedback` table (migration `b8d2f4a6c1e3`).
  - Authenticated `POST /feedback`, limited to 5 per user in a rolling 24 hours (429 after that).
  - Each message is saved first, then emailed to hello@plutonightlabs.com through the existing Resend service. A mail failure does not lose the row.
  - The account email is sent only when the user asks for a reply.
  - Feedback rows are deleted with the account.
- **Shared code:** the Log play sheet shell moved to `components/ui/Sheet.tsx` and is reused by both new sheets.
- **PRIVACY.md** now covers feedback, the offline outbox and the device-only tip count, with open items for the owner.

## Evidence

| Layer | Result |
| --- | --- |
| Backend unit/API | Full suite 451 passed, 14 skipped (Postgres-only tests skip without their database URLs). Feedback: validation, trimming, 2,000-character limit, rate limit (6th returns 429; other users and older rows don't count), sign-in required, email escaping and reply address, mail failure keeps the row, account deletion |
| Migration | `test_feedback_migration_postgres.py` on a disposable local database: upgrade, constraints, cascade, downgrade, re-upgrade. `alembic check` at head: no drift |
| Frontend unit | 199/199. Covers `SOCIAL_LINKS` URLs, external labels, review and contact URLs, group order, theme menu name, upsell and plan pill for Free vs Pro, and accessible row names. Tip jar (mocked layer): success counts and shows the badge; cancel and failure leave the count unchanged; pending shows a message. Feedback: length rules, device info only when the toggle is on, offline queue and retry, offline vs server errors, control names |
| Static | lint, `tsc -b`, `build`, `build:ios`, `check:pwa` and `git diff --check` pass. `check:colors` shows no new raw colours. The release bundle doesn't contain the dev purchase stand-in |
| Browser (Playwright WebKit, iPhone 15, mocked shelf, local backend, `/feedback` stubbed) | `settings-layout` 7/7: dark and light screenshots, every row at least 44pt, last row and footer clear the tab bar, tip shows thanks then the badge with focus returned, feedback validation and send, offline save then delivery when back online, Log out from Profile. Dynamic Type Settings AX1/AX3/AX5 3/3. Full suite on the dev database upgraded to `b8d2f4a6c1e3` (then downgraded back to `a7c1e9d3b5f2`): 67 passed, 7 failed. All 7 are iPhone SE `onboarding-account` tests that can't sign in after the iPhone 15 run uses the shared account. Run alone, that spec passes 13/13 on both phones. On the un-migrated dev database, account deletion fails because the `feedback` table is missing, so **the migration must run before this backend is deployed** |
| Simulator (not a physical device) | iPhone 17 / iOS 27.0, Debug, ad hoc signed, release-mode web build against a local backend. Signed in as the local test account. Settings showed the agreed groups with the Tip jar hidden, and the feedback sheet opened full screen with no tab bar and safe areas kept. Found and fixed one issue: at normal text size the native Dynamic Type rule pushed the FREE pill onto its own line. The send path was not exercised here (the dev database had no feedback table). Evidence: `docs/screenshots/sp-settings-01/simulator/` |
| Physical device | Not run |

Screenshots: `docs/screenshots/sp-settings-01/before/` (390×844 dark, before) and `after/`, which has 390×844 dark and light for Settings top, Settings bottom, Tip jar and Feedback.

## Owner confirmations

- 2026-11-18: YouTube URL `https://www.youtube.com/@shelfpick` confirmed by the owner.

## Merge with SP-SCORE-01 (18 November 2026)

`main` (SP-SCORE-01, migration `d2b6f0a9c4e8`) was merged into this branch, and `b8d2f4a6c1e3` now revises `d2b6f0a9c4e8`, so Alembic has one head: `a7c1e9d3b5f2 → d2b6f0a9c4e8 → b8d2f4a6c1e3`. On the merged code: backend 527 passed; migration tests for play results, scoresheets and feedback 3/3; `alembic check` clean; frontend 205 passed; lint, tsc, build and PWA pass; Playwright on iPhone 15 (scoresheets, settings layout, play logging) 17/17. The settings footer still hard-codes build `11` in `frontend/src/app-links.ts`; bump it with the next iOS build number.
