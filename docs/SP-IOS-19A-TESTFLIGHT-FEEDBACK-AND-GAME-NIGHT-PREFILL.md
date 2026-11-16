# SP-IOS-19A — TestFlight Feedback and Game Night Play Prefill

**Status:** PASS WITH RISKS

**Source:** `6eaae6cfa083799fb9fb56c8cf08e6775b429a94`

**Branch:** `codex/sp-ios-19a`

## Completed

- Confirmed the Airplane Mode screenshot reflects the expected offline path. A failed fetch shows the connection message, and recovery occurs through an explicit retry after connectivity returns. No connectivity code changed and mutations are not replayed automatically.
- Game Night now supplies the selected participant count and ordered names to the existing `PlayLogForm` prefill path.
- Count-only sessions receive the correct number of editable blank participant rows.
- Added regression coverage for named players, count-only sessions, incomplete selections, changed selections and repeated entry.

## Validation

- Frontend focused tests: 12 passed.
- Frontend full suite: 113 passed.
- Frontend lint, production build, PWA asset check and `git diff --check`: passed.
- Backend full suite against the pre-existing development database: 355 passed, 9 failed, 13 skipped because that database lacked `users.token_version`.
- `python -m alembic check`: failed with `Target database is not up to date.` No migration was applied.

## Open gates

- No new TestFlight build or physical-iPhone retest was performed.

## SP-IOS-19B verification

On 13 November 2026, PostgreSQL 16.15 was started as a disposable, tmpfs-only
container with separate databases for the application, launch-hardening,
retention and timer-integrity suites. Alembic upgraded the disposable
application database to head, all 377 backend tests passed with no skips, and
`alembic check` reported no new upgrade operations. No existing database was
modified.
