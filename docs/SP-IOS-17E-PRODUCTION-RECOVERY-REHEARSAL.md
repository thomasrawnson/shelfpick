# SP-IOS-17E — Production recovery rehearsal preparation

**Date:** 2026-11-12

**Status:** PASS WITH RISKS — preparation complete; execution not authorised

**Production release:** `6eaae6cfa083799fb9fb56c8cf08e6775b429a94`

**Production schema:** `f3a8c2d4e6b1`

## Outcome and evidence boundary

This plan prepares one fresh logical export and one point-in-time recovery
(PITR) into a new isolated database. It does not overwrite, reconnect, stop,
restart, migrate or otherwise change production. No export, database, IP rule,
credential view, billable resource or deletion was performed while preparing
this report.

SP-IOS-17D established the current live state through authenticated read-only
checks: PostgreSQL 16 in Frankfurt, `0.1c-256mb`, 1 GB storage with 10.07% used,
Alembic `f3a8c2d4e6b1 (head)`, a three-day PITR window and one logical export
created on 8 November 2026. Render reported the database Available and blocked
external PostgreSQL access. The production API and frontend were both live at
`6eaae6c`; service Auto-Deploy was Off, but the merge caused a Blueprint-triggered
deployment.

The Pluto Second Brain note is historical navigation only: it still describes
PR #11 as unmerged and production as unchecked. Current Git, SP-IOS-17D and
authenticated Render evidence take precedence.

## Current provider capabilities

Render's current documentation and dashboard evidence establish:

- paid PostgreSQL instances receive continuous PITR;
- the Hobby workspace recovery window is the past three days;
- the target time must be at least ten minutes old;
- PITR always creates a **new database instance** and does not overwrite the
  source;
- the recovery instance copies the source IP allow list; copying existing
  settings also copies its compute plan, Datadog setting and project;
- logical exports are compressed directory archives, retained by Render for
  seven days;
- only one logical export can run per database at once;
- recovery instances are billable until deleted.

Sources: [Render recovery and backups](https://render.com/docs/postgresql-backups),
[Render pricing](https://render.com/pricing).

## Exact resources and isolation

| Role | Name | ID / identity | Permitted treatment |
| --- | --- | --- | --- |
| Production database | `board-game-picker-db` | `[production database ID redacted]` | Read-only aggregate baseline and logical export source only. Never restore into, rename, suspend, restart or delete. |
| Production API | `board-game-picker-api` | `[API service ID redacted]` | Use its authenticated shell only for aggregate-only baseline queries. Do not change `DATABASE_URL` or any setting. |
| Production frontend | `board-game-picker-web` | `[web service ID redacted]` | No operation. |
| Temporary recovery database | `board-game-picker-db-sp-ios-17e-recovery-20261112` | New ID assigned by Render | PostgreSQL 16, Frankfurt, `0.1c-256mb`, 1 GB; standalone, not Blueprint-managed and never connected to production services. |
| Encrypted local export container | `SP-IOS-17E-2026-11-12.sparseimage` | `~/ShelfPick-Recovery/SP-IOS-17E-2026-11-12.sparseimage` | New AES-256 encrypted 4 GB sparse image, outside Git and cloud-synchronised folders. Owner supplies the passphrase interactively; it is never logged or stored in the repository. |

If the temporary database name already exists, the source database ID differs
from the value above, or Render proposes any other region, PostgreSQL major
version, plan or storage capacity, stop before starting recovery.

The recovery database must not be added to `render.yaml`, linked through an
environment group, or used by either live service. Its external allow list
starts from the copied production state. If access is required, add only the
operator's current `/32` address to the temporary database, never production,
and remove it immediately after validation.

## Cost and storage estimate

- Production capacity: 1 GB; observed use: 10.07% (about 103 MB). A 1 GB
  recovery database is sufficient unless the confirmation screen reports
  otherwise.
- Local capacity observed during preparation: 97 GiB free. A 4 GB sparse image
  is a bounded ceiling that accommodates the compressed archive, extraction
  and checksum material without allocating 4 GB immediately.
- Current list price for `0.1c-256mb`: US$6/month. Current PostgreSQL storage
  pricing is US$0.30/GB/month, while Render also advertises 1 GB included for
  paid PostgreSQL. Use **US$6.30/month as the conservative ceiling**.
- Compute and storage are prorated to the second. At that ceiling the temporary
  resource costs about US$0.04 for four hours or US$0.21 for 24 hours, before
  tax or any bandwidth overage.

Stop if Render shows a higher plan, more than 1 GB storage, a non-Frankfurt
region, or an incremental estimate above **US$1 total**. Check current workspace
bandwidth before downloading the export; the exact export size and any marginal
egress charge are not yet known.

## Proposed execution procedure

### Phase 1 — freeze the evidence, not production

1. Record UTC start time, operator, production DB name and ID, production
   release SHA, schema revision and current health result in a private execution
   log. Do not record connection strings or credentials.
2. Confirm `board-game-picker-db` remains Available, PostgreSQL 16, Frankfurt,
   `0.1c-256mb`, 1 GB, with a three-day PITR window.
3. Confirm no logical export is already running. Confirm local free space is at
   least 4 GB and the selected location is not synced to iCloud, Dropbox or
   another provider.
4. Create and mount the exact AES-256 encrypted sparse image above. The owner
   enters its new passphrase; do not save the passphrase in shell history,
   Keychain, Git or the report unless the owner separately chooses a secure
   custody method.

### Phase 2 — aggregate baseline and fresh export

5. In the authenticated production API shell, run the SQL in **Integrity
   manifest** through the existing SQLAlchemy connection with a read-only,
   repeatable-read transaction. Capture only the UTC database timestamp,
   schema revision, database size, aggregate row counts and orphan counts.
   Never select emails, names, usernames, tokens, hashes, locations, free text
   or complete rows.
6. On the production database Recovery page, select **Create export**. This is
   the first production-changing operation and requires the owner authorisation
   below. Wait for success; do not retry while an export is running.
7. Download the new `.dir.tar.gz` only into the mounted encrypted image. Record
   its Render creation time, byte size and SHA-256 checksum in the private log.
   Do not extract it outside the encrypted image and do not upload it anywhere.

### Phase 3 — isolated PITR

8. Wait until the baseline database timestamp is at least ten minutes old.
9. Select **Restore Database** on production's Recovery page and use:
   - name: `board-game-picker-db-sp-ios-17e-recovery-20261112`;
   - restore time: the captured UTC baseline time, using the precision Render
     accepts and recording any rounding;
   - Copy Existing Settings: **Yes**;
   - expected result: PostgreSQL 16, Frankfurt, `0.1c-256mb`, 1 GB.
10. Before the final **Start Recovery** action, recheck that the screen says a
    new database will be created, the name is the temporary name, and the cost
    remains within the US$1 cap. Starting recovery is a billable external
    change and requires the owner authorisation below.
11. Wait for the new database to become Available. Record its newly assigned
    ID. Confirm that ID is not `[production database ID redacted]` and that neither
    live service references the temporary database.

### Phase 4 — read-only validation

12. Add the operator's current `/32` inbound rule to the **temporary database
    only** if required. Reveal its connection URL only long enough to place it
    in a hidden, session-only environment variable. Never paste it into this
    report, a chat, a screenshot, shell history or a file.
13. Use the existing PostgreSQL 16 client from the recorded `postgres:16`
    Docker image. Pass the URL as an inherited environment variable so it does
    not appear as a command argument. Run `psql` with `-X`,
    `ON_ERROR_STOP=1`, and a read-only repeatable-read transaction.
14. Run the same Integrity manifest. Required results:
    - PostgreSQL major version 16;
    - `alembic_version = f3a8c2d4e6b1`;
    - all five required table counts captured successfully;
    - every representative orphan count equals zero;
    - no unvalidated foreign-key constraints;
    - recovered database size is plausible relative to the source.
15. Compare aggregate counts with the production baseline. Exact equality is
    required when Render accepted the exact baseline timestamp. If Render
    rounded the restore time, document the precision and investigate any count
    delta; do not inspect individual rows to explain it. A non-zero orphan
    result, missing table, wrong revision or unexplained material count delta
    fails the rehearsal.
16. Unset the session connection variable, close the client and remove the
    temporary `/32` rule. Do not connect the recovered database to the API.

## Integrity manifest

Run these statements in one transaction on production for the aggregate
baseline and again on the recovered database. Output remains in the private
execution log and is not committed.

```sql
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;

SELECT transaction_timestamp() AT TIME ZONE 'UTC' AS snapshot_utc;
SELECT current_setting('server_version') AS postgres_version,
       pg_database_size(current_database()) AS database_bytes;
SELECT version_num FROM alembic_version;

SELECT 'games' AS table_name, count(*)::bigint AS row_count FROM games
UNION ALL SELECT 'plays', count(*)::bigint FROM plays
UNION ALL SELECT 'user_games', count(*)::bigint FROM user_games
UNION ALL SELECT 'user_wishlist_games', count(*)::bigint FROM user_wishlist_games
UNION ALL SELECT 'users', count(*)::bigint FROM users
ORDER BY table_name;

SELECT 'user_games_missing_parent' AS check_name, count(*)::bigint AS failures
FROM user_games x
LEFT JOIN users u ON u.id = x.user_id
LEFT JOIN games g ON g.id = x.game_id
WHERE u.id IS NULL OR g.id IS NULL
UNION ALL
SELECT 'wishlist_missing_parent', count(*)::bigint
FROM user_wishlist_games x
LEFT JOIN users u ON u.id = x.user_id
LEFT JOIN games g ON g.id = x.game_id
WHERE u.id IS NULL OR g.id IS NULL
UNION ALL
SELECT 'plays_missing_parent', count(*)::bigint
FROM plays x
LEFT JOIN users u ON u.id = x.user_id
LEFT JOIN games g ON g.id = x.game_id
WHERE u.id IS NULL OR g.id IS NULL
UNION ALL
SELECT 'participants_missing_play', count(*)::bigint
FROM play_participants x
LEFT JOIN plays p ON p.id = x.play_id
WHERE p.id IS NULL
UNION ALL
SELECT 'guests_missing_session', count(*)::bigint
FROM game_night_guests x
LEFT JOIN game_night_voting_sessions s ON s.id = x.session_id
WHERE s.id IS NULL
UNION ALL
SELECT 'ballots_missing_parent', count(*)::bigint
FROM game_night_ballots x
LEFT JOIN game_night_voting_sessions s ON s.id = x.session_id
LEFT JOIN game_night_guests g ON g.id = x.guest_id
WHERE s.id IS NULL OR g.id IS NULL
ORDER BY check_name;

SELECT count(*)::bigint AS unvalidated_foreign_keys
FROM pg_constraint
WHERE contype = 'f' AND NOT convalidated;

COMMIT;
```

These queries intentionally return aggregates only. Query output must not
include personal data. `users` and relationship counts are operational evidence
and should remain in the private execution log.

## Cleanup and deletion guards

1. Keep production primary throughout. A successful rehearsal does not
   authorise changing `DATABASE_URL`, switching services or deleting the source.
2. Before cleanup, record the temporary database's exact name and new ID. The
   operator must verify all of the following on one screen:
   - name equals `board-game-picker-db-sp-ios-17e-recovery-20261112`;
   - ID is not `[production database ID redacted]`;
   - no live service references it;
   - the production database still reports Available.
3. Removal of the temporary database is destructive and requires a final
   action-time confirmation even if the execution plan was approved. Never use
   a wildcard, Blueprint deletion or project-wide deletion.
4. Keep the encrypted logical export mounted only for the rehearsal. After the
   owner decides whether to retain or destroy it, unmount the image. If
   destruction is approved, delete only the exact sparse-image path above and
   confirm it is absent. Do not promise a retention period that the owner has
   not approved.
5. Record the cleanup timestamp, removed temporary ID, local-export disposition
   and incremental Render charge. Do not record credentials.

If validation fails, remove external access from the temporary database but
retain the isolated resource long enough for owner review, subject to the cost
cap. Do not inspect user rows or switch production to it.

## Blueprint-triggered deployment safeguard

`autoDeployTrigger: "off"` protects normal Git-backed deploys but did not prevent
the merged `render.yaml` change from causing a Blueprint-triggered deployment.
Until a stronger technical gate is separately approved:

1. Every release review must run
   `git diff --name-only <production-sha>...<candidate-sha> -- render.yaml`.
2. Any output makes the merge **NO-GO** unless the owner explicitly authorises
   a possible Blueprint sync/deploy and the production change window is open.
3. Split required `render.yaml` changes into a dedicated infrastructure PR.
   Merge ordinary application code separately; hold the infrastructure PR until
   recovery evidence, exact SHA, CI and deployment approval are recorded.
4. After any authorised infrastructure merge, watch Blueprint events and both
   service deploy histories even when service Auto-Deploy remains Off.

This is a procedural safeguard only. No Render or GitHub setting was changed.

## Exact owner authorisation required

Execution may begin only after the owner provides this approval:

> I authorise SP-IOS-17E execution against production database
> `board-game-picker-db` (`[production database ID redacted]`) to create one fresh
> logical export, download it only into the AES-256 encrypted sparse image
> `~/ShelfPick-Recovery/SP-IOS-17E-2026-11-12.sparseimage`,
> capture aggregate-only production integrity evidence, and create one new
> Frankfurt PostgreSQL 16 PITR database named
> `board-game-picker-db-sp-ios-17e-recovery-20261112` using the existing
> `0.1c-256mb` plan and 1 GB storage. I authorise a temporary `/32` inbound rule
> on that recovery database only, read-only aggregate validation, and up to
> US$1 total incremental Render cost. Do not change any live service,
> production setting, production data, schema, credentials or connection.
> Stop on any resource, plan, region, version, timestamp, cost or integrity
> mismatch. Report the temporary database ID and results before deletion; the
> final destructive deletion still requires action-time confirmation.

## Preparation completion state

**COMPLETED:** Executable, bounded recovery plan with exact source, destination,
validation, privacy, cost, cleanup and Blueprint safeguards.

**TESTS:** Read-only repository/runbook review, official Render documentation and
pricing review, current SP-IOS-17D live evidence reconciliation, local capacity
check and static schema/relationship inspection.

**RISKS:** Exact logical-export size and marginal bandwidth charge remain unknown;
host full-disk encryption could not be confirmed, so the encrypted sparse image
is mandatory; the recovery modal's final plan estimate must be confirmed at
execution; count equality can require investigation if Render rounds the
requested PITR timestamp.

**NEXT:** Owner supplies the exact authorisation block above. No execution is
implied by approval of this preparation report.

## Execution result — 12 November 2026

**STATUS:** PASS WITH RISKS

**COMPLETED:** The authorised production aggregate baseline and fresh logical
export completed without changing production. The export created at 21:15 UTC
is 70,858 bytes with SHA-256
`910aaeba1885440ad8471322511739a8adb1ef6ecec4a290e0c29634b8187a11` and is
stored only in the AES-256 image, which was unmounted after evidence capture.
Render created the isolated recovery
database `board-game-picker-db-sp-ios-17e-recovery-20261112` with ID
`[temporary recovery database ID redacted]` at the accepted restore point
`2026-11-12 21:14:40 UTC`. It is Available, PostgreSQL 16, Frankfurt,
`0.1c-256mb`, 1 GB and not Blueprint-managed. The temporary current-IP `/32`
rule was removed after validation; Render again reports zero PostgreSQL inbound
IP ranges and blocks all external database traffic.

**TESTS:** PostgreSQL reported version 16.15 and Alembic revision
`f3a8c2d4e6b1`. All five approved aggregate table counts exactly matched the
production repeatable-read snapshot. All six representative relationship
orphan checks returned zero, no unvalidated foreign keys were present, and the
recovered database size was plausible. The exact aggregate output is retained
only in `SP-IOS-17E-EXECUTION-PRIVATE.log` inside the encrypted image; its
SHA-256 is
`06047c2bc2bf651aeb847bb75b66333c7b860c686c2ffcb44a271b65ec4d2ade`.

**RISKS:** The temporary recovery database remains billable until explicitly
deleted. At 21:41 UTC, approximately 15 minutes after creation, the conservative
accrued estimate was about US$0.0022; the actual invoiced amount was not yet
available and the estimate continues increasing at about US$0.00014 per minute.
The encrypted archive remains retained pending the owner's separate disposition
decision. No restore into production was tested or authorised.

**RESOURCES:** Temporary database `[temporary recovery database ID redacted]`; encrypted image
`~/ShelfPick-Recovery/SP-IOS-17E-2026-11-12.sparseimage`;
archive `2026-11-12T21_15Z.dir.tar.gz` within that image.

**COST:** Accrued estimate approximately US$0.0022 at 21:41 UTC, below the US$1
cap. Actual billing remains subject to Render's final prorated charge.

**NEXT:** After reviewing the resource ID and results above, the owner must give
action-time confirmation to delete only Render database
`[temporary recovery database ID redacted]`. Deletion of the encrypted archive is a separate
destructive decision and is not implied.
