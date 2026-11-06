# SP-IOS-14E — recovery and verification

**Status:** reconstructed candidate for owner review, 6 November 2026. No release, public under-13 voting, legal approval or production change is implied.

## Provenance and isolation

The named 14C and compliance worktree directories were absent. Read-only inspection of Git objects, reflogs, stale worktree registrations and relevant local patch/backup names found no exact 14C source or DPIA. The 14C branch reflog contained only its creation at the merged baseline. The historical 14D test claims do not validate this reconstruction. The 14D evidence report was used only as a requirements and risk source.

This candidate is a durable isolated clone at `/Users/tomrawnson/Developer/shelfpick-sp-ios-14e`, branch `codex/sp-ios-14e`, based on GitHub main `83ccffd7bea86184712b7645a87f66bb76a5acc5` (PR #9 merge). A read-only GitHub branch/compare check on 6 November found main still identical to this base, with zero new commits. [Main CI run 134](https://github.com/thomasrawnson/shelfpick/actions/runs/42083828413) succeeded for the baseline; its frontend and backend/migration jobs both passed. This uncommitted candidate has no CI run. The owner's dirty primary checkout and other worktrees were not reset, cleaned, rebased or merged. No commit was made.

## Reviewed change manifest

| Area | Files | Purpose |
| --- | --- | --- |
| Registration | `backend/auth/schemas.py`, `backend/tests/test_auth.py`, `frontend/src/api/client.ts`, `frontend/src/components/AuthView.tsx`, `frontend/src/styles/auth.css` | Explicit boolean 13+ declaration at API and UI; retain invitation, verification and rate limits. No birth date stored. |
| Guest rights | `backend/api/routers/game_night.py`, `backend/repositories/game_night_voting_repository.py`, `backend/services/game_night_voting_service.py`, `backend/tests/test_game_night_voting_api.py` | Credential-scoped nickname correction and guest/ballot deletion in one transaction; persistent per-IP rights-route throttle. |
| Guest presentation | `frontend/src/components/GameNightGuestVotingView.tsx`, `frontend/src/components/GameNightView.tsx`, `frontend/src/styles/game-night.css` | Nickname and host-visibility guidance; self-service rights controls; polling does not overwrite an in-progress edit. |
| Evidence | `docs/screenshots/sp-ios-14e/`, this report, DPIA and lawful-basis candidates | Synthetic browser screenshots and decision record. |

No Picker scoring, Free/Pro entitlement, host gate, backend retention policy, registration invitation flow, native signing or production configuration was changed. The existing 12-hour guest access window is not a data-deletion guarantee. Guest-rights routes remain accessible to a valid credential after a session closes or expires so the holder can remove their own record.

## Verification evidence

- Focused backend: 49 passed, 1 dependency deprecation warning. Missing/false/forged age declarations rejected before side effects; two guests and two sessions isolated; ballot removed with guest; invalid/missing credential and closed/expired cases covered; the 21st rights request receives 429; no tested credential in captured logs.
- Full backend on fresh disposable SQLite schema: 346 passed, 13 skipped, 2 failed. Both failures are pre-existing PostgreSQL `aggregate_order_by` tests that cannot compile under SQLite. A repeat excluding one PostgreSQL-only file exposed another PostgreSQL-only case; the suite with all seven `*_postgres.py` files excluded passed 343 tests. The earlier 21 missing-table failures were a test-database setup error. `alembic check` on the metadata-created disposable SQLite database reported "Target database is not up to date" because it has no Alembic revision; this is not PostgreSQL migration evidence. No PostgreSQL server or running Docker daemon was available; PostgreSQL integration and migrations remain unverified.
- Frontend: 103 tests passed; ESLint, TypeScript/Vite production build and PWA validation passed. The app used Node 22.23.3. Capacitor iOS sync and unsigned Xcode simulator build passed.
- Browser fixture: intercepted requests to a loopback-only API, with synthetic guests. At 320px dark and 390px light, registration and guest rights scrolled without horizontal overflow; the age control had a 44px row. At desktop width, no overflow. Nickname correction survived a poll, and removal cleared the local guest credential. Screenshots are browser evidence, not physical-device evidence.
- Simulator: isolated prototype was installed and launched on an iPhone 18 Pro Max iOS 27.2 simulator that held no prior ShelfPick app. The login screen visibly rendered. No simulator account sign-in, software-keyboard, live API or physical iPhone test was performed for this candidate.

The follow-up verification repeated 39 focused registration/guest tests, 103 frontend tests, lint, build and PWA validation with passing results. There was one bounded frontend correction: errors from guest-rights requests after voting closes now appear by the rights controls. After it, Capacitor asset sync and an unsigned Xcode simulator build passed. The existing browser fixture and simulator launch evidence predate that one-line correction; the final build was not reinstalled. No new physical VoiceOver or software-keyboard result is claimed. The detailed evidence and classification are in `docs/SP-IOS-14E-V-ACCEPTANCE-PACKAGE.md`.

## Security and operational limits

The guest credential is a bearer secret: a thief who also has the session link can act as its holder. The API cannot distinguish theft without a new identity mechanism. The current UI does not expose a public approved privacy contact; the existing legal content is a draft. Do not turn a draft link into a public assurance. For a lost credential, a future monitored privacy route should request only session context, approximate time and nickname, seek limited host corroboration where appropriate, and decline automatic deletion when ownership is uncertain. Do not ask a child to email a token or identity document. Owner/legal approval is needed for contact channel, verification standard, case retention and deleted-data restore reconciliation.

## Release gate

Run PostgreSQL migrations and integration tests in CI on this exact candidate; complete reviewed public notice/contact and operational rights process; decide the guest lawful basis and DPIA; then obtain separate authority for any PR. Do not activate public under-13 phone voting on this evidence alone.
