# SP-IOS-17C — Production and Release Candidate Reconciliation

**Date:** 2026-11-12

**Status:** PASS WITH RISKS

**Local branch:** `codex/sp-ios-17c`

**Candidate base:** `fec46b74e2b5735818bdab1a22d244bc486b8ed0`

**Candidate commit:** recorded by `git rev-parse HEAD` in the completion report after the local commit is created; a commit cannot truthfully contain its own object ID.

## Result

The production-only password-reset diagnostic is not required in the release candidate and is deliberately excluded. Its durable privacy improvement—removing the user ID from the password-reset email-failure log—is already present in PR #11. The remaining diagnostic emits an account-existence signal to restricted logs and was documented as temporary, bounded instrumentation. Excluding it changes no public API, database contract or user data.

The proposed candidate is PR #11 plus three release-control clarifications: explicit default-off Render flags for phone voting and public legal links, documentation of the public legal-links fail-closed default, and the owner-recorded Apple 4+ content rating clearly separated from the existing 13+ registration restriction. No legal draft is published or enabled.

## Source and pull-request identity

| Source | Verified state | SHA | Notes |
| --- | --- | --- | --- |
| `origin/main` | protected remote branch | `83ccffd7bea86184712b7645a87f66bb76a5acc5` | PR #10 and PR #11 both target this snapshot. |
| PR #10, `codex/sp-ios-14e` | open, draft, mergeable; prior checks green | `2b1ff912d49a97d7ff1db33663777996cbe0ebd8` | Two commits: family/privacy and guest-rights work, then default-off phone voting. It remains open and was not changed. |
| PR #11, `codex/sp-ios-release-10-v1` | open, draft, mergeable; prior checks green | `fec46b74e2b5735818bdab1a22d244bc486b8ed0` | Squashed release candidate. It remains open and was not changed. |
| Render production API | read-only deployment evidence from SP-IOS-17B | `d9450c985bf27b98519f87a9d9c9fe6012d6805d` | Production-only diagnostic commit; not on a locally tracked remote branch. |
| SP-IOS-17C proposed candidate | isolated local branch | see completion report | No push, merge or deployment performed. |

The PR states above are repository-host evidence checked during this task. Existing CI belongs to the PR SHAs, not to the new local SP-IOS-17C commit.

## History reconciliation

Production and PR #11 share merge-base `9403a04673ee8f67c63a1f0310937ca32ac740c9`.

- Production-only history: `d9450c9`.
- PR #11 side after the merge-base: `700efe7`, merge `b2fef84`, `1d7f811`, merge `83ccffd`, and squash commit `fec46b7`.
- PR #10 and PR #11 share base `83ccffd`. PR #11 is a squash, not a descendant of PR #10. Its release code retains the required PR #10 behaviours: 13+ registration declaration, guest correction/deletion support, and default-disabled phone voting. Some PR #10 evidence documents were not carried into the squash; this does not remove runtime functionality, and PR #10 remains preserved for historical review.

## Production-only diagnostic assessment

Commit `d9450c9` changes only the password-reset diagnostic and its tests/documentation:

- `backend/config.py`: adds `PASSWORD_RESET_ISSUANCE_DIAGNOSTIC_ENABLED`, defaulting to false.
- `backend/middleware/request_logging.py`: replaces a client-provided request ID with a server UUID for the reset route when the diagnostic is enabled.
- `backend/api/routers/auth.py`: conditionally logs whether a real reset token was committed and removes the user ID from the email-failure log.
- `backend/tests/test_auth.py` and `backend/tests/test_config.py`: cover the gated diagnostic.
- `docs/SP-IOS-RELEASE-04G-DIAGNOSTIC-ISOLATION.md`: records its bounded, privacy-sensitive use.

Decision: **exclude the diagnostic flag, middleware and account-existence log**. The diagnostic was created for temporary operational investigation, is disabled by default, and its own record requires later removal. PR #11 already includes the durable removal of `user_id` from the email-failure log and stronger reset-email/link round-trip coverage. No required production-only change is lost.

## Production-to-candidate change table

| Area | Production `d9450c9` | Proposed release | Assessment |
| --- | --- | --- | --- |
| Password-reset contract | Existing endpoint/token flow plus optional diagnostic | Existing endpoint/token flow; durable privacy-safe failure log; no issuance diagnostic | PASS — public and database contracts preserved. |
| Diagnostic logging | Can emit real-token-committed state when explicitly enabled | Absent | PASS — intentional removal of temporary privacy-sensitive instrumentation. |
| Registration age | Earlier shared implementation | Explicit 13+ declaration retained | PASS — storefront 4+ is documented separately. |
| Phone voting | Production state/config not established by this reconciliation | Code remains fail-closed; Render declaration explicitly false | PASS for candidate; production flag remains an operational verification gate. |
| Legal links | Production state/config not established by this reconciliation | Draft and public-link flags explicitly false | PASS for candidate; approved legal pages remain unavailable. |
| Free/Pro scope | Earlier shared implementation | Free-only V1 presentation retained; Pro purchasing disabled | PASS against release scope. |
| Database | Production revision was unverified in SP-IOS-17B | Alembic head `f3a8c2d4e6b1`; no new migration in SP-IOS-17C | RISK — production revision and recovery evidence still require authorised verification. |
| Native wrapper | Not represented by the production API commit | Company iOS wrapper builds as `com.plutonightlabs.shelfpick` | PASS for unsigned static build only; physical-device/TestFlight evidence remains open. |

## Candidate change manifest

- `render.yaml`
  - Declares `GAME_NIGHT_PHONE_VOTING_ENABLED=false`.
  - Declares `VITE_PUBLIC_LEGAL_LINKS_ENABLED=false`.
- `frontend/.env.example`
  - Documents the public legal-link flag as fail-closed and approval-gated.
- `docs/SP-IOS-08-APP-STORE-ASSETS.md`
  - Records the owner-reported Apple 4+ content rating while retaining the 13+ registration rule and the final-questionnaire/legal review gate.
- `docs/SP-IOS-17C-PRODUCTION-RELEASE-RECONCILIATION.md`
  - Records this immutable reconciliation and release-gate evidence.

The SP-IOS-16B privacy/terms drafts, legal draft view, retention material and decision sheet remain preserved in the earlier isolated worktree. They are intentionally not copied into this deployable candidate because qualified review and owner approval are still pending. Both legal feature flags remain false. No unrelated owner work was modified.

## Verification performed

### New SP-IOS-17C checks

- PostgreSQL image: PostgreSQL 16, local image ID `sha256:a3b7f434b2dc57ce85a67e171163eb8ab1a1ebcb39d27484661f26b1dfbe30d6`.
- Disposable databases only; no production database connection.
- Alembic upgrade from an empty database: PASS through `f3a8c2d4e6b1`.
- `alembic current`: PASS, `f3a8c2d4e6b1 (head)`.
- `alembic check`: PASS, no new upgrade operations.
- Backend: **377 passed, 0 failed, 0 skipped**; one existing Starlette/httpx deprecation warning.
- Frontend: **109 passed, 0 failed**. A Vite websocket port warning did not fail tests.
- Frontend lint: PASS.
- Web build with both legal flags false: PASS.
- PWA validation: PASS (branding, theme, icon and precache checks).
- `npm run build:ios`: PASS; Capacitor sync included Secure Storage.
- Company iOS preparation: PASS.
- Xcode 27.2 unsigned Release build for the generic iOS Simulator: **BUILD SUCCEEDED**.
- Compiled identity: `ShelfPick`, bundle ID `com.plutonightlabs.shelfpick`, iPhone-only device family, portrait orientation.
- Compiled web bundle references the intended Render API and contains no synthetic local API marker, legal-draft approval warning, or synthetic credential marker searched by this check.
- `git diff --check`: PASS before the candidate commit.

Two initial frontend/build attempts failed for environment reasons: the first dependency link omitted candidate Capacitor packages and sandboxing blocked Vite's socket; a shared read-only dependency tree also prevented TypeScript temporary-file creation. The same candidate passed after using the existing candidate dependency tree locally with the required sandbox permission. These were not release defects.

### Existing evidence, not rerun here

- PR #10 and PR #11 hosted CI checks were green at their recorded SHAs.
- SP-IOS-17A previously reported 377 backend and 109 frontend tests passing against PR #11.
- SP-IOS-17B supplied the read-only production deployment SHA. It did not establish the production Alembic revision, recovery proof, email journeys or reviewer access.

No physical iPhone, TestFlight, signed archive, live email delivery, reviewer account, production migration, production backup/restore, deployment or legal publication was tested or performed.

## Remaining release gates

| Gate | State | Required evidence |
| --- | --- | --- |
| Candidate history and production diagnostic | PASS | This reconciliation and local immutable commit. |
| PostgreSQL 16 migrations and backend suite | PASS | Clean disposable database; 377 tests passed. |
| Frontend tests, lint, build and PWA | PASS | 109 tests, lint, build and PWA checks passed. |
| Unsigned iOS build identity | PASS | Generic Simulator Release build succeeded with company bundle ID. |
| New candidate hosted CI | UNVERIFIED | Owner-authorised push, then green required checks for the exact candidate SHA. |
| Production schema revision | BLOCKER | Authorised read-only confirmation that production equals Alembic head `f3a8c2d4e6b1`. |
| Backup and recovery | BLOCKER | Current configuration plus dated recovery evidence. |
| Production release flags | UNVERIFIED | Confirm keys are present and false without exposing their values beyond intended boolean state. |
| Verification/reset email journeys | BLOCKER | Live production delivery and link completion using authorised test accounts. |
| App Review account | BLOCKER | Maintained Free reviewer account and successful collection journey. |
| Privacy Policy and Terms | BLOCKER | Qualified legal review, owner approval, publication, and reachable final URLs before enabling public links. |
| Physical iPhone and TestFlight | BLOCKER | Installation, launch, authentication, reset link, collection/discover/game-night journeys, accessibility, external links and account deletion on supported hardware. |

## Deployment implication and next operation

**Deployment is not safe to authorise yet.** The candidate is technically suitable for owner review and hosted CI, but the production schema, recovery evidence, production flags, email journeys, reviewer access, approved legal pages and physical-device/TestFlight gates remain unresolved. Because the production start command performs Alembic upgrade, deploying before confirming the production revision and recovery posture would exceed the available evidence.

**Recommended next operation:** owner reviews the exact local SP-IOS-17C commit and, if accepted, authorises pushing that SHA to a remote review branch so hosted CI can validate the immutable candidate. Do not deploy from that approval alone.
