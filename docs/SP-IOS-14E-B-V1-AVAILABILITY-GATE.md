# SP-IOS-14E-B — V1 phone/QR voting availability gate

Status: scoped candidate for draft PR #10 CI verification. This does not approve public under-13 guest voting or change production configuration. Base: `8e179feef3b8ccaf6f0540d9acd4944871aeb319` (`codex/sp-ios-14e`). PR #10 CI on that base predates this gate.

## Change manifest

- `backend/config.py`, `backend/.env.example`: server setting `GAME_NIGHT_PHONE_VOTING_ENABLED`, default false, malformed values false.
- `backend/api/routers/game_night.py`: availability check before entitlement/service access on voting routes.
- `backend/tests/test_config.py`, `backend/tests/test_game_night_api.py`, `backend/tests/test_game_night_voting_api.py`: default, opt-in, entitlement, route coverage, disabled-state and rights tests.
- `frontend/src/game-night-availability.ts`, `frontend/src/components/GameNightView.tsx`, `frontend/src/components/GameNightGuestVotingView.tsx`, `frontend/src/components/ProComparisonView.tsx`: V1 presentation gate and independent rights UI.
- `frontend/src/game-night-voting.test.mjs`, `frontend/src/pro-comparison.test.mjs`: V1 copy/regression assertions.
- `docs/SP-IOS-08-APP-STORE-ASSETS.md`, `docs/SP-IOS-09-REVIEW-EXPERIENCE.md`, `docs/SP-IOS-09A-REVIEWER-ACCESS-SCREENSHOTS.md`: V1 public/reviewer draft copy now reflects all-tier unavailability.
- This report: local endpoint, browser and release-gate evidence.
- `docs/screenshots/sp-ios-14e-b/`: synthetic local browser evidence, retained outside the proposed commit.

**Proposed commit allowlist:** exactly the 14 modified tracked files above, `frontend/src/game-night-availability.ts`, and this report (16 files). Both synthetic PNGs in `docs/screenshots/sp-ios-14e-b/` stay local and uncommitted. The pre-existing untracked `docs/SP-IOS-14E-PRIVACY-RESOLUTION.md` and `docs/screenshots/sp-ios-14e/` are separate owner work and excluded. No generated `frontend/dist`, database, token or fixture script belongs in the commit.

## Server contract and transition

Absent, false or unrecognised setting disables phone voting for **all** accounts, including Pro. An explicit recognised true is needed to enable the server routes. The frontend has a separate V1 false constant; enabling the backend alone does not advertise the feature. A later approved release must review both gates, legal basis, entitlement presentation and existing sessions together.

| Route | Disabled result | Rights exception |
| --- | --- | --- |
| `POST /game-night/voting` | 503 | — |
| `GET /game-night/voting/sessions/{session_id}` | 503 | — |
| `POST /game-night/voting/sessions/{session_id}/close` | 503 | — |
| `GET /game-night/voting/{join_token}` | 503 | — |
| `POST /game-night/voting/{join_token}/join` | 503 | — |
| `PUT /game-night/voting/{join_token}/ballot` | 503 | — |
| `PUT /game-night/voting/{join_token}/guest` | Credential-scoped correction remains available | Yes |
| `DELETE /game-night/voting/{join_token}/guest` | Credential-scoped removal remains available | Yes |

Valid disabled voting requests return `503 {"detail":"Phone voting is unavailable in this version."}`. The check runs before Pro entitlement or record lookup, so an existing token or Pro account cannot bypass it. Framework body validation may reject malformed requests before the handler; no voting action occurs. Existing sessions and ballots are not deleted or mutated by the setting. Hosts cannot view or close those sessions through disabled voting routes; a future authorised re-enable or existing retention process is needed. No cleanup scheduling was activated.

The standalone join page says voting is unavailable, then reads only this device's saved guest credential. It does not request public session state while disabled. With a credential, it exposes nickname correction and removal; successful removal clears the local credential. Existing server credential matching, cross-guest isolation and rights throttling remain in force. Lost credentials require the separate manual privacy-request process; identity verification and contact-link publication remain owner/legal decisions.

## Verification

- Focused backend: 43 passed, including all six disabled routes, invalid token consistency, Pro bypass, correction/removal, cross-guest failure and surviving second guest. Route inventory asserts all eight voting paths.
- Full non-PostgreSQL backend: 353 passed on 6 November after `database.init_db` created schema in fresh disposable `/private/tmp/sp-ios-14e-b-ci-full.db`. An earlier run against a separate empty file had 16 schema-related failures; its initialized rerun also passed. No production database was used.
- Frontend: 103 tests and ESLint passed. Node 22.23.3 TypeScript/Vite production build passed with approved Render API origin and legal drafts disabled; PWA asset check passed on that output. An initial no-origin build failed the existing app-content guard, then the correctly configured build passed. No API request or deployment occurred.
- Local Playwright synthetic guest route: 320px light and 390px dark had no horizontal overflow; 48px rights buttons remained reachable; correction and deletion used only rights endpoints, with no public-state GET. Synthetic 404 showed an error; removal cleared local credential. Screenshot: `docs/screenshots/sp-ios-14e-b/guest-rights-390-dark-synthetic.png`.
- Local Playwright synthetic authenticated **Free** host journey: onboarding-complete fixture selected two players, chose 60 minutes, received three recommendations, viewed the shortlist and revealed a game. No phone-voting action appeared. Empty recommendations showed “No games fit yet” with Adjust time; synthetic 503 left the selected time intact and showed a recoverable error with Find games/Back. At 320px and 390px in both themes, no document-level horizontal overflow occurred; all three choice buttons scrolled above bottom navigation, and keyboard Tab produced visible focus. The 320px cards are dense but operable. Screenshot: `docs/screenshots/sp-ios-14e-b/free-shortlist-320-dark-synthetic.png`. This is browser fixture evidence, not live account, iOS or physical-device evidence.
- PostgreSQL-specific integration/migration tests were not run locally: Docker daemon was unavailable. PR #10 CI on the base SHA does not validate this gate; fresh CI is required on the update SHA.
- `alembic check` on the isolated model-created SQLite database exited 255, “Target database is not up to date.” That database has no applied Alembic revision and cannot substitute for the required disposable PostgreSQL CI migration check; no migration was applied to make it pass.
- An unsigned `xcodebuild` simulator attempt did not reach compilation: the sandbox could not connect to CoreSimulatorService or write Swift/Clang caches under the user Library. No simulator result is claimed for this gate.

## V1 public/reviewer copy

“Game Night helps a host shortlist games and choose together.” Do not present phone voting as a Free or Pro benefit. The editable public listing, private reviewer-note template and screenshot plan now reflect the V1 gate; they remain unapproved drafts.

## Release classification

- **BLOCKER:** Merge/deployment must wait for reviewed commit and fresh CI including PostgreSQL; owner/legal approval of children's data processing and published privacy/rights contact remains separate. Public under-13 phone voting stays disabled.
- **RISK:** Existing guest credentials lost with a device cannot self-serve rights; manual identity review is required. Disabled historical sessions are inaccessible to hosts until an approved transition.
- **POLISH:** The 320px shortlist cards are narrow and text wraps heavily, but buttons remain reachable. Public listing and reviewer instructions still need owner approval; this candidate has not updated published legal text.

This local verification did not change any production account, provider setting, entitlement definition or Apple resource.
