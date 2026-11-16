# SP-HOST-01B — beta release candidate handoff

**Prepared:** 21 October 2026. **State:** locally validated candidate; no deployment approval or tester invitation. This is an operational checklist, not a change to the product roadmap.

## Candidate and source control

- Candidate code and Blueprint: `3897ded7cb41e0377402729f5d9c25d91fa24f52` (`origin/main`, merge of PR #4). Its Git tree is identical to reviewed PR #4 head `e66bf71da68337eb80862432b3f239c6213befd7`. GitHub CI runs [#116](https://github.com/thomasrawnson/shelfpick/actions/runs/38391441729) on the PR head and [#117](https://github.com/thomasrawnson/shelfpick/actions/runs/38393284710) on the exact `main` merge SHA both passed the backend/migrations and frontend jobs. Freeze and recheck the SHA before any deployment.
- PR #3 integrated SP-PB09B, SP-PB12B, SP-PB13, SP-PB14A/B and SP-BETA-02. PR #4 integrated SP-BETA-08 fallback-only artwork exports. Open PRs #1 and #2 are draft documentation changes, not release code.
- The working `main` checkout remains dirty and diverged (one local commit ahead, ten remote commits behind at inspection). Its uncommitted changes include an unrelated `PickerView.tsx` rewrite and overlapping older release work. Do not reset, rebase, merge, cherry-pick or deploy from that checkout. The isolated validation checkout was detached at the candidate SHA.
- `audit/sp-beta-06-production-exposure` and `infra/sp-beta-07-deployment-protection` remain local-only refs. The latter's manual-deploy safeguards are **not** in `3897ded`; do not silently treat them as released.

## Verification performed on the isolated checkout

| Check | Result |
| --- | --- |
| PostgreSQL 16 migration from empty disposable database to head | Pass, revision `c15f4b6d8e20` |
| `python -m alembic check` on that database | Pass, no new operations |
| `python -m pytest` with a second isolated database for timer-integrity tests | 308 passed, 1 dependency deprecation warning (the default run passed 303 and skipped those 5 opt-in tests) |
| `npm test` | 92 passed; benign Vite HMR port warnings |
| `npm run lint` | Pass |
| `npm run build` | Pass |
| `npm run check:pwa` after build | Pass |
| `git diff --check` and candidate status | Pass; no tracked changes |

These checks do not establish live Render behavior, email delivery, real BoardGameGeek responses, physical-phone behavior or owner approval. The disposable database held no customer data.

## Pre-provisioning owner gate

1. Confirm the exact release SHA and review any subsequent config change as a new candidate. Recheck the current remote `main` SHA, PR status and CI. Do not use the dated `aa68663` SHA in the historical Foundation B runbook table.
2. Resolve the deployment-control gap: `render.yaml` at this candidate still has `autoDeployTrigger: checksPass` for both Git services. Review and integrate an approved manual-deploy safeguard, then verify it in Render before connecting domains or tester data. Reconfirm the Vercel Production alias/protection and GitHub branch rules; earlier SP-BETA-06/07/08 records are dated snapshots.
3. In Render's review screen confirm exactly one static site, one Frankfurt Python 3.12.14 API (`0.5c-512mb`), and one private Frankfurt PostgreSQL 16 database (`0.1c-256mb`, 1 GB). Verify the current checkout charge before adding a card or applying the Blueprint: the documented baseline is about **$13/month**, plus possible domain, email, storage/usage and temporary recovery charges. No charge or resource was created by this task.
4. Owner supplies approved `app` and `api` hostnames, DNS access, a verified Resend sender/domain, approved server-side BGG token/terms, the private beta invite list, monitoring recipient and encrypted off-site backup destination. Do not record secret values or tester addresses in Git or screenshots. Record a separate owner approval for first provisioning and another for tester invitations.

## Configuration and deployment checklist

- Compare deployed services and settings with [`render.yaml`](../render.yaml). Static site: `frontend`, Node 22, `npm ci && npm run build && npm run check:pwa`, `./dist`, SPA rewrite. API: `backend`, Python 3.12.14, `pip install -r requirements.txt`, `alembic upgrade head` pre-deploy, `bash start.sh`, `/health`. Database: PostgreSQL 16, Frankfurt, private allow list, 1 GB. Confirm manual promotion and the same approved SHA on both services.
- Web build variable `VITE_API_BASE_URL` must be the API HTTPS origin. API variables: `APP_ENV=production`, private `DATABASE_URL`, generated `JWT_SECRET`, `ACCESS_TOKEN_MINUTES`, `AI_PICKER_ENABLED=false`, `CORS_ORIGINS` and `FRONTEND_URL` equal to the web HTTPS origin, `RESEND_API_KEY`, verified `EMAIL_FROM`, `BGG_API_TOKEN`, nonempty server-only `BETA_INVITE_EMAILS`, and `EXPORT_COVER_ARTWORK_ENABLED=false`. Check presence and semantics without displaying values. A web build made before its API URL is set needs a new build.
- Before inviting anyone, inspect build, pre-deploy migration, startup and health logs; record deploy ID, exact SHA, migration revision, URL, TLS status, approver and rollback target. Stop if the two services use different SHAs or if database recovery is unavailable.

## Production smoke and monitoring checklist

- API `/health`: HTTP 200 and database `ok`; web root and direct refresh of Collection, Want to Play, Picker, Discover, Game Night, Rankings and Insights routes: HTTPS and no 404/CORS/mixed-content errors. Confirm the browser calls the approved API host.
- With owner-approved synthetic accounts: uninvited registration remains generic and grants no access; invited registration sends one verification email and grants Free only after link use; existing account login still works; resend and password reset emails arrive and single-use/expiry behavior is correct. Check Resend delivery and bounce logs without copying personal data.
- Verify BGG title search/Add to Owned and Want to Play, one collection sync, Discover Hot/For You, and explicit Top 100 unavailability. Record upstream errors and timeouts; do not represent unavailable ranked data as working. Verify ordinary in-app covers separately from fallback-only play-card and monthly-recap PNG exports; the export policy endpoint must report disabled.
- With an audited test Pro grant, check recommendations, Game Night QR voting, one play save and live timer recovery. Checkout is outside private beta; do not imply live subscription payments. Complete the existing real iPhone/Android and PWA checks before invitations.
- Configure an external HTTPS `/health` probe and alerts to an owner, plus Render deploy/5xx/restart, PostgreSQL storage/connections/recovery, Resend delivery failures, BGG upstream failure/rate limits and spend alerts. Record alert owner, threshold, response route and one test notification. Review privacy-safe request logs; keep tokens, emails and database URLs out of logs.

## Off-site backup and isolated recovery rehearsal

1. Before tester data, confirm Render's actual recovery window, export capability, storage usage and cost of a temporary recovered database. Choose and record an RPO of at most 24 hours and RTO of at most four hours, or get explicit owner acceptance of a different target. Establish a daily logical-export owner and encrypted off-site destination outside Render.
2. Take a custom-format `pg_dump` from the production database through a controlled operator session; store the archive encrypted off-site with a SHA-256 checksum, timestamp, source database identity and retention/deletion date. Keep connection strings and archive contents out of tickets and Git. Confirm the archive with `pg_restore --list` and a checksum after transfer.
3. Rehearse a restore into a **new isolated database**, never the live database. Restore the logical archive there and verify `alembic_version`, schema, row counts for `users`, `games`, `user_games`, `plays` and `user_wishlist_games`, and representative foreign-key/account-scoped reads. Record export/restore duration, errors and checksum; restrict access and remove the temporary data copy after evidence is captured.
4. Separately rehearse Render point-in-time recovery to another isolated instance at a selected timestamp. Verify revision and counts, document cutover steps without switching the live API, then remove the temporary instance to stop charges. Do not claim recovery is ready until both the off-site export and isolated restore have succeeded.
5. Before a risky migration, take a fresh export and confirm the last known-good application SHA. An application rollback redeploys that SHA; it does not reverse database changes. Use a reviewed forward fix or validated isolated recovery plan for schema/data incidents.

## Go/no-go

**Verified:** the candidate tree, reviewed/merged code slices, PR-head CI and local automated suite above. **Unverified:** current Render checkout and service settings, production migration/email/BGG/health, live monitoring, off-site backup and isolated recovery, real phones, current Vercel protection and owner invitation approval. **No-go for provisioning or invitations** until the owner reviews the exact SHA, deployment-control change and charge; **no-go for invitations** until all live smoke, monitoring and recovery checks pass.
