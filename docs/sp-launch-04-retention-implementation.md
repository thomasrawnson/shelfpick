# SP-LAUNCH-04 retention implementation handoff

**Status:** Foundations only. No production deletion or scheduled job is enabled.

## Storage map and implementation

| Policy category | Tables/storage | Foundation and remaining gap |
|---|---|---|
| Inactive accounts — 24 months | `users`; all user-owned tables enumerated by `AccountDeletionService` | Authenticated immediate deletion is tested. `users` has `created_at` but no reliable last-login/activity timestamp. Do not infer inactivity or automate account deletion until the activity definition, warning/grace process, lawful basis and schema are approved. |
| Expired Game Night — 30 days | `game_night_voting_sessions`, cascading `game_night_guests` and `game_night_ballots` | `RetentionCleanupService` selects `expires_at <= now - 30 days`, orders by age/ID, deletes at most 500 sessions per committed batch and is idempotent. |
| Expired verification/reset tokens — 7 days | `auth_tokens` (`email_verify`, `beta_email_verify`, `password_reset`) | The same service selects `expires_at <= now - 7 days`, orders by age/ID and uses bounded committed batches. Raw tokens are never stored. |
| Operational logs — 30 days | API stdout/Render logs; Resend provider logs | Production email success logs now omit recipient addresses. Render/Resend retention remains a provider configuration and contract check. |
| Independent backups — 30 days | Future encrypted logical exports/provider recovery | Not provisioned. A restore must remain isolated, replay an approved deletion register or otherwise reconcile post-backup deletions, and pass owner review before replacing live state. The deletion-register design itself requires privacy/legal approval. |
| Temporary personal-data exports — 7 days | Future secure request workspace | No application export store exists. Use an access-controlled temporary location, record deletion and do not place exports in Git, logs, email bodies or previews. |
| Resolved privacy requests — 12 months | Future restricted case register | No register exists. Approve fields, access, audit trail and deletion mechanism before operating it. |

Account deletion takes precedence over these maximum live-retention positions: the authenticated flow removes all owned/transitive rows immediately and preserves only shared catalogue data. Token and Game Night cleanup do not select users or shared game records.

## Safety and invocation

The new indexes support the age scans. `python -m scripts.retention_cleanup` is dry-run only. Applying deletion additionally requires both `--apply` and the exact environment value `RETENTION_CLEANUP_ENABLED=true`; the checked-in Render value is `false`. Each batch commits independently and rolls back on error. No API route, startup hook, worker, CI workflow or scheduler invokes the routine.

The routine must not be run against production until qualified policy review, an approved backup/recovery reconciliation design, a dry-run count review, exact-database confirmation and separate owner authorisation are recorded.

## SP-LAUNCH-04A local PostgreSQL validation — 3 November 2026

An isolated localhost-only PostgreSQL 16.15 container used an in-memory data directory and disposable test databases. The complete migration chain upgraded from base to `f3a8c2d4e6b1`; the retention-index migration safely downgraded to `8d2e4f6a7b90` and re-upgraded; both indexes disappeared and returned as expected; and `alembic check` reported no drift.

The complete backend suite passed 348 tests with every PostgreSQL-specific test enabled. PostgreSQL retention coverage verifies dry-run counts, exact boundaries, batch size 1, idempotency, Game Night cascades, two-user isolation, failed-batch rollback, preservation of active and unrecognised-purpose tokens, unchanged user token versions and continued validity of an unrelated access token. No production database was contacted and apply mode remains disabled.

## Scheduling and cost boundary

No scheduled-job resource is added. Render's official [Cron Jobs documentation](https://render.com/docs/cronjobs), reviewed 3 November 2026, states that each cron-job service has a minimum monthly charge of $1 in addition to usage-based billing. A later Render Cron Job or equivalent is therefore new paid operational infrastructure and requires separate owner approval, price re-verification, secret configuration, alerting, concurrency protection and a failed-run procedure. Do not run cleanup inside an API request or opportunistically on application startup.

## Activation checklist

1. [x] Migration upgrade/downgrade and Alembic drift checks on disposable PostgreSQL 16.
2. [x] Boundary, batching, idempotency, rollback, cascade, credential-preservation and two-user isolation tests.
3. Dry-run on an isolated production-like restore; review counts without exposing personal data.
4. Restore rehearsal that proves deleted accounts do not silently reappear.
5. Owner approval of the exact schedule, batch size, database target and rollback/incident procedure.
