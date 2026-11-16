# SP-IOS-19C — Release Candidate PR and Hosted CI

**Status:** PASS WITH RISKS

**Base:** `origin/main` at `6eaae6cfa083799fb9fb56c8cf08e6775b429a94`

**Branch:** `codex/sp-ios-19a`

**Candidate:** `3f202d319ab73d38f288d656fa284d536aebc503`

**Draft PR:** <https://github.com/thomasrawnson/shelfpick/pull/13>

## Candidate scope

The candidate contains one commit and seven files:

- `frontend/package.json`
- `frontend/src/components/GameNightView.tsx`
- `frontend/src/components/picker/PlayerSelectionStep.tsx`
- `frontend/src/game-night-play-prefill.test.mjs`
- `frontend/src/player-selection.ts`
- `frontend/src/monthly-recap-card.ts`
- `frontend/src/monthly-recap.test.mjs`

No backend, migration, entitlement, registration, release-flag, native project,
environment, legal, App Store or Render Blueprint file is included. Local task
reports and screenshot evidence remain untracked and were deliberately excluded
from the PR under the source-and-tests-only allowlist. No suspicious credential,
database URL, secret or private-key pattern was found in the candidate files.

## Hosted results

GitHub reported draft PR #13 open and mergeable at the exact candidate SHA.

- Pull-request workflow: <https://github.com/thomasrawnson/shelfpick/actions/runs/43387668392> — **success**.
- Push workflow: <https://github.com/thomasrawnson/shelfpick/actions/runs/43387606233> — **success**.
- Backend tests and migrations: dependency audit passed; clean PostgreSQL 16
  migration and Alembic alignment passed; 377 tests passed, followed by the
  launch-hardening 6, timer-integrity 5 and retention 2 focused checks.
- Frontend tests, lint and build: 113 tests passed; ESLint, production build,
  legal-draft gate and PWA validation passed.
- The existing `npm audit --audit-level=high` gate passed but reported 15
  pre-existing lower-severity findings: 2 low and 13 moderate. No dependency or
  lockfile changed in this candidate.
- The repository integration automatically created a successful Vercel Preview
  status. No production deployment was requested or performed.

## Remaining gates

- Owner merge review remains pending; the PR is intentionally draft.
- TestFlight build 2 signing, upload and physical-device acceptance remain
  separately controlled work.
- The checked-in Simulator identity remains the prototype bundle configuration,
  not the App Store distribution identity.

## Recommended next action

Review draft PR #13 and, if accepted, separately authorise marking it ready and
merging the exact candidate SHA.
