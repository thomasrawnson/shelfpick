# SP-IOS-14E-V — technical acceptance and release gates

**6 November 2026; uncommitted candidate for owner review.** Branch `codex/sp-ios-14e` at base `83ccffd7bea86184712b7645a87f66bb76a5acc5`. GitHub main remains exactly that SHA; there is no integration delta or read-only merge conflict to resolve. Main CI passed, but the candidate has not run CI or PostgreSQL checks.

## Exact candidate manifest

Modified source and tests: `backend/api/routers/game_night.py`, `backend/auth/schemas.py`, `backend/repositories/game_night_voting_repository.py`, `backend/services/game_night_voting_service.py`, `backend/tests/test_auth.py`, `backend/tests/test_game_night_voting_api.py`, `frontend/src/api/client.ts`, `frontend/src/components/AuthView.tsx`, `frontend/src/components/GameNightGuestVotingView.tsx`, `frontend/src/components/GameNightView.tsx`, `frontend/src/styles/auth.css`, `frontend/src/styles/game-night.css`. Review documents: `docs/SP-IOS-14E-RECOVERY-AND-VERIFICATION.md`, `docs/SP-IOS-14E-DPIA-CANDIDATE.md`, `docs/SP-IOS-14E-LAWFUL-BASIS-DECISION.md`, this package. Three PNGs remain local in `docs/screenshots/sp-ios-14e/` and are excluded from the proposed commit: synthetic browser fixtures (320px dark registration, 390px light guest) and an unsigned iPhone 18 Pro Max simulator login launch. They contain no credentials or personal data.

No Picker, entitlement, migration, retention setting, company signing, production API or hosting file is changed. The proposal adds registration request validation and two guest-rights routes; existing route contracts remain intact.

## Regression ledger

| Check | Result | Limit |
| --- | --- | --- |
| Registration and guest-rights API tests | 39 passed | SQLite fixtures and synthetic users. |
| Full backend on fresh disposable SQLite schema | 346 passed, 13 skipped, 2 failed | Two PostgreSQL aggregate cases cannot compile on SQLite; excluding just that file exposed another PostgreSQL-specific test. |
| Backend excluding seven PostgreSQL-only test files | 343 passed | Does not replace PostgreSQL CI. |
| Alembic check on disposable SQLite schema | Blocked: database not at a migration revision | Model-created SQLite tables are unsuitable migration evidence. No existing safe PostgreSQL 16 server, binary or Docker daemon was available. |
| Frontend | 103 tests passed; lint, TypeScript/Vite build, PWA pass after the final error-feedback correction | Tests and synthetic fixture, no live account. |
| Browser 320/390/desktop | Prior synthetic fixture passed registration, guest edit/remove, light/dark and overflow | Not a real software keyboard or VoiceOver test; one later error-message correction is covered by build, not recaptured visually. |
| iOS simulator | Prior unsigned build, install and visible login launch passed; final synced iOS assets and unsigned Xcode build passed | No final-build reinstall, sign-in or guest route on simulator. No physical test. |
| `git diff --check` | Pass | Untracked documentation also reviewed manually. |

## Security and privacy matrix

| Safeguard | Classification | Evidence or remaining gate |
| --- | --- | --- |
| Literal true 13+ registration declaration | Implemented and verified locally | Missing, false, numeric and string forgeries rejected before account/email side effects. Self-declaration is not independent age assurance. |
| Invite, email verification, registration rate limits and anti-enumeration | Implemented baseline; focused regression verified | No public registration activation. |
| Host Pro gate and guest account-free session | Implemented baseline; local tests verified | No entitlement bypass or new guest account. |
| Credential-scoped correction and atomic guest/ballot removal | Implemented and verified locally | Two guests, two sessions, other host, missing/invalid credential, repeat removal, closed and expired sessions tested. |
| Rights request throttling and no token logging | Implemented and verified locally | 21st synthetic request receives 429; captured test logs exclude credential. Production proxy/log configuration unverified. |
| Host/public response separation | Implemented and verified locally | Host sees participant names and aggregates; guest sees own detail and aggregates. Host can independently retain observed names. |
| Stolen credential plus forwarded link | Residual risk; not preventable by current bearer model | A holder with both can act as the guest. Do not claim theft is detected. |
| Nickname minimisation | Partly implemented; owner decision | UI asks for a nickname and warns against real names, but a display name is required and arbitrary real-name input is accepted. Generated alias or optional nickname requires product decision. |
| Lost-credential privacy request | Proposed and unimplemented | Choose monitored public contact, safe limited corroboration and case retention. No identity-document demand or automatic deletion on weak evidence. |
| Child-readable transparency | Proposed and unimplemented | Draft legal link is not an approved public notice. Test comprehension with intended audience before use. |
| Guest retention, backup restoration and deletion reconciliation | Proposed and unimplemented | 12-hour access expiry is not row deletion; cleanup is disabled. Set operational period, schedule and restore handling after legal approval and isolated tests. |
| DPIA and lawful basis | Requires owner and qualified legal decision | Legitimate interests balance is undetermined; public under-13 phone voting remains gated. |

## Release sequence

1. Owner reviews this exact uncommitted manifest and the one-line closed-session error correction.
2. Obtain an isolated PostgreSQL 16 CI run on the eventual reviewed commit: migrations, schema alignment, full backend and guest security tests. Do not use Render production.
3. Resolve the minimal privacy decisions: nickname data minimisation; public child-readable notice and monitored contact; lost-credential request handling; guest deletion and recovery schedule; per-purpose lawful basis and DPIA sign-off. Escalate unmitigated high residual risk for qualified advice and any required prior consultation.
4. Before App Store release, separately approve and publish the public Privacy Policy and Terms, verify account-deletion operation and reviewer access, decide App Privacy and age-rating answers, and approve company distribution signing/submission. Existing draft routes and local simulator evidence cannot satisfy these release gates.
5. Only after separate authority, prepare the exact commit/PR package. No commit or PR is proposed as ready today because the PostgreSQL and legal gates remain open. Separate App Store distribution approval follows independently.
