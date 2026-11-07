# SP-IOS-RELEASE-04G — Isolated reset issuance diagnostic

**7 November 2026. Local candidate: PASS WITH RISKS. Production cause remains unknown.** This work used a new durable worktree at `/Users/tomrawnson/Developer/shelfpick-sp-ios-release-04g`, branch `codex/sp-ios-release-04g-diagnostic`, based exactly on `9403a04673ee8f67c63a1f0310937ca32ac740c9`. The source was the uncommitted 04F patch in `shelfpick-sp-ios-14e`; that worktree and the primary checkout were not edited. No commit, push, PR, Render change, deployment, production reset, database access or paid resource was used.

## Isolated manifest and hunk review

| Candidate file | Exact purpose |
| --- | --- |
| `backend/config.py` | Add server-only `PASSWORD_RESET_ISSUANCE_DIAGNOSTIC_ENABLED`; absent or malformed values resolve to `false`. |
| `backend/api/routers/auth.py` | Log one Boolean issuance outcome after real-token commit or dummy branch, before email dispatch; remove user ID from reset-email failure log. 04G also guards optional diagnostic logging so a logger failure cannot interrupt reset. |
| `backend/middleware/request_logging.py` | When enabled on the reset-request path only, replace untrusted incoming request ID with a server UUID used by both the existing request log and diagnostic. |
| `backend/tests/test_config.py` | Missing, false, true and malformed-flag tests. |
| `backend/tests/test_auth.py` | Only 04F diagnostic tests plus 04G logger-failure cases; baseline auth tests remain in place. |
| This report | Scope, test evidence and future operating gates. |

Each code hunk was reviewed against `9403a04` before transfer. The source branch's **Game Night phone-voting flag** in `backend/config.py` and its test were explicitly excluded because they are absent from production baseline. The mixed dirty auth test file was not copied: only its diagnostic block and imports were inserted. No Game Night, Discover, legal, deletion, App Store, frontend, dependency, migration, CI or Render-manifest changes are in this candidate. The five-file code/test diff has SHA-256 `754181ea9b84e4ff2975db08510acd25675f80572c9d7510cdb7f4311dac7d53` for local review; it is **not** a commit SHA and does not include this untracked report.

## Security and functional review

The diagnostic defaults off and cannot be enabled by a client. When enabled, its sole event payload is `reset_issuance_diagnostic request_id=<server UUID> real_reset_token_committed=true|false`, plus standard logger metadata. `true` follows a successful database commit; `false` follows the deliberately unpersisted dummy branch. No event is emitted for invalid, throttled or failed token-creation requests. A simulated diagnostic logger failure is swallowed without changing reset request processing. No account address or ID, password, token, hash, reset URL, request body or credentials are passed to the event. The existing reset-email exception log no longer includes a user ID. A malicious email-shaped incoming `X-Request-ID` is ignored while enabled; the response still returns `X-Request-ID`, now a server UUID for this one route. No Boolean is exposed in response or header.

The public reset status/body and email template are account-indistinguishable. Token generation, hashing, 30-minute expiry, per-user replacement, one-time consumption, password change, session revocation and database-backed rate limiting are unchanged from `9403a04`; `backend/auth/one_time_tokens.py` and confirmation code have no candidate diff. The internal Boolean **does reveal account existence to restricted log readers**, so the flag is appropriate only for a short, approved diagnostic window and must later be removed. There is no third-party telemetry, new storage or dependency. An optional logger failure is handled; a database/token-creation failure still fails normally and cannot generate a misleading committed event.

## Local checks and PostgreSQL CI readiness

| Check | Result |
| --- | --- |
| Focused diagnostic, reset, flag and request-ID tests (`-k 'reset_issuance_diagnostic or password_reset or request_id'`) | **AUTOMATED PASS:** 23 passed, 46 deselected; one Starlette library deprecation warning. |
| Full `tests/test_auth.py tests/test_config.py tests/test_request_logging.py` | **AUTOMATED PASS:** 69 passed; one Starlette library deprecation warning. Synthetic accounts, captured mail/logs, disposable in-memory SQLite; no external email. |
| `git diff --check` and five-file manifest review | **PASS:** no whitespace errors or out-of-scope tracked file changes before this report. |
| Local PostgreSQL 16 execution | **NOT RUN:** no isolated `LAUNCH_HARDENING_DATABASE_URL`, `pg_isready` or Docker socket was available. SQLite results do not establish PostgreSQL behavior. |
| Frontend and dependency audit | **NOT RUN locally:** no frontend or dependency files changed. Existing CI will run frontend checks and `pip-audit` after an authorised push. |

The checked-in `.github/workflows/ci.yml` needs **no infrastructure edit**: its backend job starts PostgreSQL 16, applies migrations to a clean database, runs `alembic check`, creates isolated launch-hardening/timer/retention databases, runs all backend tests and the dedicated PostgreSQL modules, including concurrent reset replacement. It also installs/audits pinned Python dependencies. The frontend job runs npm audit, tests, lint, build and PWA validation. These are **expected**, not completed, CI results for this uncommitted candidate. A separately approved branch push would trigger CI via the existing `push` event; a PR also triggers it.

**Proposed commit description, not executed:** `Add isolated opt-in reset issuance diagnostic (SP-IOS-RELEASE-04G)`. **Proposed branch:** the existing local `codex/sp-ios-release-04g-diagnostic`. **Proposed review:** a draft PR containing only the six-file manifest, after separate approval and a verified baseline comparison. The local `main` and `origin/main` refs both point to `871d4bf`, which diverges from `9403a04` (merge base `de97c31`); a PR directly against that local base would show broad unrelated changes. Recheck the actual remote refs and choose an approved baseline review branch or a separately reconciled patch before any PR. Draft PR #10 remains unchanged.

## Future production procedure — proposal only

1. Owner verifies the **current** production API/web deploy SHAs, API contract, database migration state, Render branch/exact-commit deploy mechanism, config defaults, log access/retention and rollback coordinates. If API is no longer at `9403a04`, compare intervening fixes and stop until the candidate is reconciled. Do not infer safety from the last-verified SHA. A candidate based on the older commit could omit newer production fixes or change contracts. The API's Render `preDeployCommand` runs `alembic upgrade head` even for a code-only deploy; preflight it separately.
2. After a separately authorised commit and push, require the **exact diagnostic commit SHA**, passing PostgreSQL 16 CI (including concurrency), dependency audits and frontend job, plus owner review of the six-file diff. Confirm a manual **API-only** deployment of that SHA is possible without promoting unrelated PR #10 or changing the web service. Deploy with the diagnostic flag absent/off and verify `/health` and the deployment SHA.
3. With separate approval for configuration, restricted log access and **one** reset attempt for the designated disposable account, enable the server flag for a bounded window. Use the browser's response `X-Request-ID` to match one private issuance event and the request-completion line. Retain only SHA/deploy ID, UTC times, request ID, Boolean, status and approval/operator reference; never retain email, password, link, token, hash, request body, HAR or raw log export.
4. Disable the flag immediately and verify its off state through the approved operator process. Remove the diagnostic code and setting in the next reviewed change. If the API deploy causes regression, manually redeploy the **previously approved live API SHA** and verify health and affected API contracts; a code rollback does not reverse migrations, so database compatibility must be established in preflight. No production SQL or restore is authorised by this plan.

**Approvals still required:** commit, branch push/CI, any PR, review-base choice, exact API deployment, Render flag enable/disable, production reset attempt, restricted log inspection, and later removal/rollback. Stop for owner review.
