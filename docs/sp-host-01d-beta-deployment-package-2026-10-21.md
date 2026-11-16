# SP-HOST-01D — closed-beta deployment operator package

**Preparation only, 21 October 2026.** No Render resource, payment method, DNS record, production database or invitation was changed. This document is not part of the release commit. Use the [merged production runbook](https://github.com/thomasrawnson/shelfpick/blob/e15d5ceed75518af9e2307e6aff60ee6a819adfb/docs/production-runbook.md) for the detailed application procedure; its older Foundation B SHA is a dated historical snapshot.

## Verified source and stop conditions

- PR [#5](https://github.com/thomasrawnson/shelfpick/pull/5) is merged. Current remote `main` is **`e15d5ceed75518af9e2307e6aff60ee6a819adfb`**; its tree equals the reviewed PR head `0a359073a8ab26e66262d445b8e6595b92f15754`. GitHub Actions [run 39678812050](https://github.com/thomasrawnson/shelfpick/actions/runs/39678812050) passed both backend and frontend jobs on the merge SHA. The jobs run migrations and `alembic check`, backend tests, frontend tests/lint/build/PWA check. Recheck branch SHA and all required checks immediately before deployment; a changed SHA needs a fresh review.
- The merged `render.yaml` validates against the downloaded official [Render Blueprint schema](https://render.com/schema/render.yaml.json). Both Git-backed services set `autoDeployTrigger: "off"`; CI still runs on push and pull request. Render may start the **first** build/deploy when a new Blueprint is applied, so applying it is a separately approved live deployment action. [Blueprint reference](https://render.com/docs/blueprint-spec)
- The local working checkout has owner changes and a stale `render.yaml`; **never deploy from that checkout**. Use the pinned merged source from GitHub. The empty Render workspace/no card/no charges finding is historical; the owner must recheck the live dashboard.
- No code configuration defect was found in the merged Blueprint. Live URLs, verified sender, BGG token, billing, backups, health and device behavior remain unverified gates. Beta invitations remain on hold under `ROADMAP.md` until the owner explicitly resumes them.

## Ordered operator sequence for a later authorised milestone

1. **Approval gate:** record owner approval of this exact SHA, maximum checkout/temporary recovery charges, selected hostnames, secret custodian, and authorised operator. Confirm the Render workspace is still empty or reconcile any existing resources. Do not add a card or create resources before this approval.
2. Prepare the two intended HTTPS origins (`app.<domain>` and `api.<domain>`) and a verified Resend sending domain. Confirm ownership of an approved BGG application token and the initial private invite list. These values must be ready for the initial Blueprint prompts. The API requires valid HTTPS origins and nonempty email/BGG/invite configuration at startup; DNS can be attached after resource creation, but the first deploy cannot complete useful smoke tests until hostnames and certificates work.
3. **Account/change gate:** connect only `thomasrawnson/shelfpick` to Render, select `main` and root `render.yaml`, then review exactly three resources: free `board-game-picker-web` static site; Frankfurt `board-game-picker-api` Python `0.5c-512mb`; Frankfurt `board-game-picker-db` PostgreSQL 16 `0.1c-256mb`, 1 GB, private IP allow list. Verify checkout price and all resource details against the Blueprint before adding payment details or applying. The repository estimate is about **$13/month** ($7 API, $6 DB, free static), excluding overages, domain/email and temporary recovery capacity; the live checkout is authoritative.
4. Supply the variables below through Render's protected prompts. **Deployment gate:** with owner approval, apply the Blueprint knowing it may deploy immediately. Inspect the actual branch, source SHA, build commands, root directories, Frankfurt API/DB regions, API health path `/health`, database disk/plan, and **Auto-Deploy: Off** on *both* services. Record Render service IDs and initial deployment IDs/statuses. If the initial deploy is not the approved SHA, stop; manually deploy the exact approved commit via **Deploys → Manual Deploy → Deploy a specific commit** only after checking the available revision. [Manual deployment reference](https://render.com/docs/deploys)
5. Attach the approved custom domains and DNS, wait for HTTPS certificates, and verify the three URL values agree. If `VITE_API_BASE_URL` changed after the static build, manually rebuild/redeploy the same approved SHA because Vite embeds it at build time. Check the API pre-deploy `alembic upgrade head` result; a failed migration is a no-go. Record deployed SHA, deploy IDs, migration revision and time in a private release log without secrets.
6. Enable Render failure/unhealthy-service notifications to the responsible operator, then execute the backup rehearsal and smoke matrix below using approved synthetic beta accounts. Keep invitations disabled until recovery, browser, physical-device and owner gates pass.

## Environment checklist

| Service | Variable | Source and verification |
| --- | --- | --- |
| API | `DATABASE_URL` | Generated `fromDatabase` private connection; confirm binding, never paste into Git/log. |
| API | `JWT_SECRET` | Render `generateValue`; confirm present and at least 32 characters without displaying it. |
| API | `APP_ENV`, `PYTHON_VERSION`, `ACCESS_TOKEN_MINUTES` | Blueprint values `production`, `3.12.14`, `1440`. |
| API | `FRONTEND_URL`, `CORS_ORIGINS` | Manually set to approved HTTPS frontend origin; CORS is comma-separated origins, not a URL path. |
| API | `RESEND_API_KEY`, `EMAIL_FROM` | Manually supplied protected key and verified production sender. Verify delivery; never use `onboarding@resend.dev`. |
| API | `BGG_API_TOKEN`, `BETA_INVITE_EMAILS` | Protected server-only token and owner-approved comma-separated addresses. Check invite restriction without logging addresses. |
| API | `AI_PICKER_ENABLED`, `EXPORT_COVER_ARTWORK_ENABLED` | Blueprint `false`, `false`. Keep cover-bearing exports disabled absent approved rights. |
| Static | `NODE_VERSION`, `VITE_API_BASE_URL` | Blueprint Node `22`; manually set **public** HTTPS API origin. `VITE_` is embedded in browser assets and must never hold a secret. |

## Backup, recovery and rollback

Before tester data exists, inspect Render Recovery availability and create a logical database export in the dashboard. Download it to an owner-controlled encrypted off-site location, record timestamp, format, size, checksum, retention owner and retrieval test; do not store it in Git or on the API filesystem. Repeat before schema-changing releases and on a defined regular schedule. Use the export's actual format and Render's documented restore path, not an assumed `pg_restore` command. For a rehearsal, obtain separate owner approval for a **temporary isolated database** (and any necessary client/service), import the logical export there, and compare `alembic_version` plus row counts for `users`, `games`, `user_games`, `plays`, `user_wishlist_games`; inspect representative synthetic records. Preserve the source database and remove the temporary resource after evidence is recorded. Never restore into production as a test.

Paid PostgreSQL provides Render point-in-time recovery; on Hobby, the current documented window is **3 days**, a point in the last **10 minutes** is unavailable, and recovery creates a **new database instance** with possible extra charges. If rehearsing PITR, choose a recoverable point, approve its cost, validate the new instance in isolation and leave the original primary untouched. A logical off-site export covers a different failure mode and must remain independently retrievable. [Render backup/recovery reference](https://render.com/docs/postgresql-backups)

For an application regression after a known-good production release, manually redeploy that prior SHA only if its schema compatibility is established; then rerun `/health` and affected smoke checks. A code rollback does not undo an Alembic migration. For the **first** release there is no prior production SHA: hold invitations/traffic, retain the database, diagnose or forward-fix, and seek owner approval before any recovery cutover. Never run an untested downgrade or replace a customer database in place.

## Minimum monitoring and response

| Signal | Operator check and response |
| --- | --- |
| API and DB connectivity | Render `/health` must report HTTP 200 and `database: ok`; Render's health check marks failures unhealthy. Page/respond to unhealthy-service notifications; inspect DB connectivity and deployment logs. |
| HTTP 5xx and uncaught errors | Inspect Render application logs and HTTP status metrics after deploy and daily during beta. Request middleware logs status, duration and request ID; uncaught failures are logged. Escalate repeated 5xx or a new traceback and pause invitations. Avoid logging tokens, addresses or payloads. |
| Latency | Time critical smoke paths after deploy and compare a small repeated baseline during beta. Render Hobby does **not** expose response-latency percentile metrics; do not promise automatic latency alerts without an approved external monitor. [Metrics reference](https://render.com/docs/service-metrics) |
| DB capacity/resources | Check disk usage against 1 GB, connections, CPU and memory in Render daily at first; investigate sustained growth, connection errors or approaching capacity before inviting more users. |
| Resend/BGG | Inspect delivery failures in Resend and BGG request failures/rate limits in API logs during initial smoke and daily beta review; test using authorised accounts only. Escalate failure of verification/reset or collection sync. |
| Unexpected charges | Review Render usage/invoices after provisioning and weekly, including storage/egress or temporary recovery resources; agree a spending owner and stop conditions before apply. |

## Go/no-go smoke matrix

**Automated evidence:** merged SHA CI above. This proves clean PostgreSQL migration/model alignment and local frontend/backend checks, not production integration. **Production browser checks** below require a later deployment and approved synthetic accounts. **Physical device checks** require actual iPhone and Android hardware; simulator screenshots do not replace them. Record date, operator, device/browser, observed result and defect reference for each group.

- [ ] **HTTPS/routing/browser:** correct certificates; app and API hostnames; `/health` 200 with DB ok; direct load/refresh of `/collection/owned`, `/collection/want-to-play`, `/picker`, `/discover`, `/game-night`, `/rankings`, `/insights`; no mixed content, CORS or failed API calls. Confirm Vite bundle calls only the intended API.
- [ ] **Access/email:** invited account signs up, receives verification and logs in; password reset email arrives and new password works; uninvited address is rejected; expired/invalid links fail safely. Confirm sender and Resend failure logs.
- [ ] **Collection/import:** BGG title search and add to Owned/Want to Play; BGG collection sync and BG Stats import with approved test data; duplicate and upstream-error handling; confirm no unexpected overwrite of prior entries.
- [ ] **Core play:** Picker yields usable recommendations; Discover Top 100 either works from an authorised source or truthfully shows unavailable without ranked requests; save a play and reopen history; restart the API and verify the play and collection persist.
- [ ] **Sharing and boundaries:** export/share play image uses branded/initials fallback, with no unapproved cover in generated output; rankings, preferences and game-night voting behave where implemented; Free/Pro entitlement boundaries reject unauthorised Pro paths and allow only approved test grants. No live checkout is required for closed beta.
- [ ] **Resilience:** empty collection, empty history, bad credentials, invalid invite, offline/failed API, BGG failure and email failure show understandable recovery without data loss or secret leakage.
- [ ] **Physical devices:** iPhone and Android PWA install/reopen, navigation/scroll/keyboard layout, saved collection/play persistence, share sheet, and Pro timer background/reopen behavior (running, paused, finished before save). Record explicit owner device sign-off.

**No-go before invitations:** missing owner approval or approved source SHA; failed CI or production migration; unverified actual cost; missing/invalid secrets or domains; failed `/health`, authentication/email or persistence; no independent backup and isolated restoration proof; repeated unhandled 5xx; cover export enabled without approved rights; incomplete physical-device sign-off; or any unresolved beta blocker in `ROADMAP.md`. Cosmetic polish can follow beta if the owner accepts it explicitly. The owner makes a separate final invitation decision.
