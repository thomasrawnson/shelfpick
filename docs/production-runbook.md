# Production deployment runbook

ShelfPick's closed-alpha environment uses one Render Blueprint:

- a static React PWA;
- a FastAPI web service;
- a private Render PostgreSQL 16 database;
- Resend for verification and password-reset email.

The frontend and backend use Render's managed HTTPS. The database uses a
paid plan because free Render PostgreSQL databases do not provide recovery.
Keep the API and database in Frankfurt. Render serves the static frontend from
its global CDN, so the static site does not have a regional compute setting.

## Private-beta audit update — 2026-10-12

SP-BETA-01 found that the minimum controlled-beta topology remains the
Blueprint described here, but provisioning is only one of the remaining entry
gates. A clean release candidate, invited and verified accounts, a fail-closed
Top 100 state, BGG artwork-export permission or an approved fallback-only
export, a successful isolated recovery rehearsal and physical iPhone/Android
sign-off are required before invitations. See
`private-beta-readiness-audit-2026-10-12.md` for the severity-ranked findings,
integration order and executable device checklist.

SP-BETA-08 resolves the application-side artwork export gate with a server-only
`EXPORT_COVER_ARTWORK_ENABLED` switch. Since the owner's 2026-11-19 decision
(SP-COVERS-01) it defaults to `true` and exported play cards and recaps show
BoardGameGeek covers; set it to `false` to return exports to branded initials
artwork. An unreachable or non-boolean policy response still fails closed to
initials in the browser; normal in-app cover display is separate. Exported
covers are relayed by the authenticated `GET /export-cover` endpoint (BGG's
image host sends no CORS headers); it returns 404 while the flag is `false`.
After deploying, check an export in the app shows covers, not only initials.
Changing the value is a production configuration change requiring owner review,
promotion of an exact approved commit and post-deploy play-card/recap checks.

At the official prices reviewed on 12 October 2026, the static site is free,
the `0.5c-512mb` API is $7/month and the `0.1c-256mb` PostgreSQL service is
$6/month with 1 GB included: approximately **$13/month** before overages,
domains, email or a temporary recovery resource. Confirm the checkout price at
provisioning time. Do not substitute free PostgreSQL: it expires, has no
provider backup and is unsuitable for tester data.

The Foundation B table below remains a dated 20 September dashboard snapshot.
SP-BETA-01 did not access or change production, so refresh every dashboard
claim before provisioning rather than treating that snapshot as current.

## Manual Render deployment safeguard — 21 October 2026

Both Git-backed services in `render.yaml` set `autoDeployTrigger: "off"`.
GitHub Actions in `.github/workflows/ci.yml` still runs on pushes and pull
requests; a passing CI run no longer authorises or starts a Render deploy.
Before applying a Blueprint, verify the reviewed commit and owner approval for
the initial deployment and paid resources. Applying a new Blueprint may itself
start the first build and deploy, even with later automatic deploys disabled.
After creation, verify **Auto-Deploy: Off** for both services in Render, then
deploy only the separately approved exact commit through a manual action.
Record that commit, CI run, approver and deployment ID in the release log.

### Private-beta invitation operator procedure

`BETA_INVITE_EMAILS` is a server-only, comma-separated allow-list on the API.
It is intentionally absent from frontend configuration and APIs.

1. Obtain owner approval for the exact address; record approver, operator,
   timestamp and reason in the private release log.
2. Normalise obvious surrounding whitespace and add the address to
   `BETA_INVITE_EMAILS` in Render. Do not put the list in Git or screenshots.
3. Redeploy the same approved commit and confirm `/health` before asking the
   invited person to register. Registration always grants Free, never Pro.
4. To withdraw an unused invitation, remove the address and redeploy. Any
   outstanding beta verification link then fails generically. Removing an
   address does not unexpectedly lock an already activated account; use the
   separately approved account-removal process if access must be revoked.
5. Reconcile the private invitation log with the configured list after every
   change. Two-person review is recommended for production edits.

Verification email uses the existing `RESEND_API_KEY`, verified `EMAIL_FROM`
and `FRONTEND_URL`. Tokens are random, stored only as SHA-256 hashes, expire
after 24 hours and are single use. Registration and resend responses do not
reveal invite or account existence. A pending user may use **Resend verification
email**; expired, incorrect and reused links show the same recovery guidance.

### Public-registration promotion procedure

`PUBLIC_REGISTRATION_ENABLED` is the independent server-side launch switch.
It remains explicitly `false` in `render.yaml`; merging or deploying this code
does not open registration. When false, the private invitation procedure above
continues to apply. When true, a new account receives no bearer session until
its email is verified, and duplicate registration, resend and recovery return
generic responses.

Only set it to `true` in a separately approved manual deployment after the
SP-LAUNCH-02 checklist is signed. Before that change, review any pre-existing
unverified users, confirm the production migration and mail quota, verify the
edge-proxy client address seen by auth limits, and retain a current invite-list
snapshot for rollback. Afterward, test new, duplicate, missing and unverified
addresses without recording personal data. Reverting the switch closes new
public registrations; it does not disable verified accounts.

## Foundation B verification status — 2026-09-20

This review used the public Git repository, the checked-in Blueprint and the
authenticated Render dashboard. The selected Render workspace is empty: it
contains no services and no Blueprint instances. Production-only behavior is
marked **Untested** rather than inferred from `render.yaml`. No production
resources, billing details or settings were created or changed.

| Item | Status | Evidence or required follow-up |
| --- | --- | --- |
| UX-1B on `origin/main` | **Verified** | `aa686635580ecf3bdab3704388528fa67a79289c` (`Improve request recovery, registration and responsive layouts`) is both local `HEAD` and `origin/main`. |
| GitHub Actions for UX-1B | **Verified** | Public CI run [#44](https://github.com/thomasrawnson/board-game-picker-commercial/actions/runs/35441421844) completed successfully on `main` for `aa68663` on 2026-09-19. The workflow covers backend migrations/tests and frontend tests, lint, build and PWA validation. The full local release suite was not repeated. |
| Blueprint resources | **Verified in repository** | `board-game-picker-web` is a static site; `board-game-picker-api` is a Frankfurt `0.5c-512mb` web service; `board-game-picker-db` is a Frankfurt PostgreSQL 16 database on `0.1c-256mb` with 1 GB storage and no public IP allow list. |
| Existing Render resources, plans and regions | **Verified absent** | The authenticated **My Workspace** overview reported that no services have been created. None of the three Blueprint resource names exists. |
| Render Blueprint instances | **Verified absent** | The Blueprints page reported that no Blueprint instances have been created. |
| Current Render deploy | **Not applicable** | With no services, there is no deployed commit or deployment status to inspect. The first deployment must use `aa686635580ecf3bdab3704388528fa67a79289c` or a deliberately reviewed successor on `main`. |
| Domains, DNS, HTTPS and URL alignment | **Verified absent** | The empty workspace has no services or custom domains. No production hostnames are recorded in the repository. Configure and verify both domains after the first deployment, then confirm the three URL variables align as described below. |
| Environment-variable presence | **Verified absent** | No services exist, so none of the required service variables is configured in Render. Values were not requested, entered or exposed. |
| Public health and SPA routing | **Failed for unverified candidates; production untested** | Read-only requests to the unsuffixed candidates `board-game-picker-api.onrender.com/health` and `board-game-picker-web.onrender.com/` both returned HTTP 404. These hostnames are not recorded in the repository and might be unassigned, suffixed or disabled, so this does not establish a production outage. Repeat against the dashboard URLs. |
| Blueprint preparation | **Blocked before apply** | Render accepted the public repository URL, selected branch `main`, found the root `render.yaml` and opened the review screen. It then required payment information because the Blueprint contains paid resources. No card was added and the Blueprint was not applied. |
| Production migration | **Untested** | CI proved a clean PostgreSQL 16 migration and `alembic check`; no production database or API exists yet, so the production pre-deploy result remains outstanding. |
| Verification and reset email | **Untested** | Requires a verified Resend domain, production sender and two end-to-end delivery tests. |
| Backup and recovery | **Untested** | Confirm Recovery is available, then schedule the logical export and isolated point-in-time recovery rehearsal in section 4. |

The only failed checks were probes of unverified candidate hostnames. Their
HTTP 404 responses are consistent with the now-confirmed empty workspace.
Production health, routing, migration, email and recovery checks cannot run
until the reviewed Blueprint is applied in a later, explicitly authorized step.

### Exact Render dashboard comparison

1. On the workspace service list, confirm these exact resources exist only
   once: `board-game-picker-web`, `board-game-picker-api` and
   `board-game-picker-db`.
2. For `board-game-picker-web`, confirm type **Static Site**, branch `main`,
   root directory `frontend`, build command
   `npm ci && npm run build && npm run check:pwa`, publish directory `./dist`,
   runtime environment `NODE_VERSION=22`, and **Auto-Deploy: Off**. Confirm
   its latest deploy is the separately approved commit and `Live`.
3. For `board-game-picker-api`, confirm region **Frankfurt**, plan
   `0.5c-512mb`, branch `main`, root directory `backend`, build command
   `pip install -r requirements.txt`, pre-deploy command
   `alembic upgrade head && python -m scripts.seed_scoresheets`, start command `bash start.sh`, health path
   `/health`, runtime environment `PYTHON_VERSION=3.12.14`, and
   **Auto-Deploy: Off**. Confirm the latest
   deploy is the same commit and `Live`.
4. For `board-game-picker-db`, confirm region **Frankfurt**, PostgreSQL 16,
   plan `0.1c-256mb`, 1 GB storage, database `boardgamepicker`, user
   `boardgamepicker`, and an empty public IP allow list.
5. On the web service, confirm `VITE_API_BASE_URL` is present and equals the
   API's HTTPS origin, and `VITE_LEGAL_DRAFTS_ENABLED` remains `false`. On the API, confirm these keys are present without
   revealing their values: `APP_ENV`, `DATABASE_URL`, `JWT_SECRET`,
   `ACCESS_TOKEN_MINUTES`, `AI_PICKER_ENABLED`, `CORS_ORIGINS`,
   `EXPORT_COVER_ARTWORK_ENABLED`, `RETENTION_CLEANUP_ENABLED`, `FRONTEND_URL`, `RESEND_API_KEY`,
   `EMAIL_FROM` and `BGG_API_TOKEN`.
   `APP_ENV` must be `production`; `DATABASE_URL` must link to
   `board-game-picker-db`; `CORS_ORIGINS` and `FRONTEND_URL` must equal the
   frontend HTTPS origin. Confirm `EMAIL_FROM` uses the verified ShelfPick
   sender domain. A present key with a blank value does not pass this check.
6. In each service's **Settings > Custom Domains**, record the hostname and
   confirm **Verified** with an active TLS certificate. Check that HTTP
   redirects to HTTPS. Do not place secrets or database URLs in this file.
7. In `board-game-picker-api`'s deploy logs, record the deployment timestamp,
   commit, successful pre-deploy migration and health-check result. In
   `board-game-picker-db`'s **Recovery** page, record whether logical exports
   and point-in-time recovery are available and the displayed recovery window.

### Read-only production checks once URLs are known

- `GET https://api.<your-domain>/health` must return HTTP 200 and report the
  database as `ok`.
- `GET https://app.<your-domain>/` must return the ShelfPick application over
  HTTPS.
- Directly request and refresh `/collection/owned`,
  `/collection/want-to-play`, `/picker`, `/discover`, `/game-night`,
  `/rankings` and `/insights`; each must return the SPA rather than 404.
- Confirm the frontend's browser requests use the same API HTTPS origin stored
  in `VITE_API_BASE_URL`, with no CORS or mixed-content errors.

### Proposed next deployment step

The next deployment step is to add billing information to **My Workspace**,
connect the GitHub repository provider for
`thomasrawnson/shelfpick`, and return to **New Blueprint
Instance**. Use Blueprint name `shelfpick-production`, branch `main`, and the
root `render.yaml`. Before applying, confirm the review lists exactly
`board-game-picker-web`, `board-game-picker-api` and `board-game-picker-db`
with the plans and Frankfurt placement specified above. Supply the six
prompted values shown in section 2, use
`ShelfPick <accounts@mail.<your-domain>>` for `EMAIL_FROM`, and attach
`app.<your-domain>` to `board-game-picker-web` and `api.<your-domain>` to
`board-game-picker-api` after the first successful deploy.

The public-repository preparation reached Render's review page but was not
applied. Render warned that the Git provider is not configured and that the
paid API and database require payment information. Connecting the GitHub
provider before creation preserves the intended GitHub integration while
Render automatic deploys remain off. Adding a card, connecting repository
access and applying the Blueprint are production/account changes outside this
inspection.

At Render's 2026-09-20 list prices, this section originally estimated
**$13.30/month** by adding $0.30 for 1 GB database storage. Render's official
pricing reviewed on 12 October lists 1 GB as included on the selected database
service, making the current estimate **$13/month**: $7 for
`board-game-picker-api`, $6 for `board-game-picker-db`, and a free static site.
Usage overages, domain registration, email, a paid workspace or a temporary
recovery database can add cost. Confirm the checkout estimate in Render before
the later provisioning step.

## 1. Domain and email preparation

Use two hostnames from the existing product domain:

- `app.<your-domain>` for the PWA;
- `api.<your-domain>` for FastAPI.

In Resend, verify a transactional-email subdomain such as
`mail.<your-domain>`. Add the DNS records Resend supplies and wait until the
domain status is verified. Use a sender such as:

```text
ShelfPick <accounts@mail.<your-domain>>
```

Do not use `onboarding@resend.dev` for the alpha. It is a testing sender, not
the application's production identity.

## 2. Create the Render Blueprint

1. In Render, create a Blueprint from this GitHub repository.
2. Render reads `render.yaml` and creates the web, API and database resources.
3. Supply the prompted secret/environment values:

| Variable | Service | Value |
| --- | --- | --- |
| `VITE_API_BASE_URL` | web | `https://api.<your-domain>` |
| `VITE_LEGAL_DRAFTS_ENABLED` | web | Keep `false`; drafts are not approved for publication |
| `CORS_ORIGINS` | API | `https://app.<your-domain>` |
| `FRONTEND_URL` | API | `https://app.<your-domain>` |
| `RESEND_API_KEY` | API | Resend production API key |
| `EMAIL_FROM` | API | Verified sender shown above |
| `BGG_API_TOKEN` | API | Approved BoardGameGeek application token |
| `BETA_INVITE_EMAILS` | API | Approved comma-separated private-beta addresses |
| `PUBLIC_REGISTRATION_ENABLED` | API | Keep `false` until the separately approved public-launch deployment |
| `EXPORT_COVER_ARTWORK_ENABLED` | API | `true` (owner decision 2026-11-19); `false` is the kill switch back to initials artwork |
| `RETENTION_CLEANUP_ENABLED` | API | Keep `false`; no scheduled cleanup is approved |

`JWT_SECRET` is generated by Render. `DATABASE_URL` is populated from the
private database connection and neither value belongs in GitHub. Keep the
BoardGameGeek application token server-side; never expose it through a Vite
environment variable or browser request.

The Blueprint fixes the API runtime at Python 3.12.14 and the static-site
build runtime at Node 22. These values are not secrets and do not need manual
entry. The API validates `BGG_API_TOKEN` during production startup; a missing
or whitespace-only token stops the deployment without logging its value.

Railway startup diagnostics on 2026-09-25 reported Python 3.13, while this
repository declares Python 3.12.14 in `.python-version`. The database-driver
compatibility fix does not change that runtime. Before a separately approved
Railway deployment, configure its build runtime to use the intended Python
3.12.14 release and rebuild; do not treat successful driver selection as
resolution of the runtime mismatch.

4. Add the two custom domains to their matching Render services and create
the DNS records Render supplies.
5. Wait for both Render certificates to become active.
6. Redeploy the web service if its first build ran before
`VITE_API_BASE_URL` was entered. Vite embeds this value at build time.

GitHub Actions checks continue independently of Render. Once the approved
commit passes CI and the owner authorises deployment, manually deploy that
exact commit. Render then runs `alembic upgrade head && python -m
scripts.seed_scoresheets` as the API's pre-deploy command. A failed migration,
or an invalid template in `scoresheets/templates`, prevents the new API version
from starting. Seeding is idempotent: unchanged templates write nothing and a
changed template becomes the sheet's next version while older plays keep the
version they were logged on. The script reads `../scoresheets/templates`, so
the deploy must check out the whole repository, not only `backend/`. If the
service is not managed by `render.yaml`, update the dashboard pre-deploy
command by hand.

## 3. Release verification

Complete this checklist against production before inviting testers:

- `GET https://api.<your-domain>/health` returns HTTP 200 with database `ok`.
- Open `https://app.<your-domain>`, then refresh a nested Collection and Want
  to Play route; the SPA must reload rather than return 404.
- Register a new address that has never been used in production.
- Confirm an unverified account receives no normal session and cannot use an
  authenticated route; duplicate registration and resend stay generic.
- Receive the verification email, open its HTTPS link and verify the account.
- Request a password reset, receive the second email and set a new password.
- Log in with the new password and confirm the old password no longer works.
- Confirm the token issued before password reset is rejected. Use **Log out all
  devices** and confirm the current token is rejected.
- Delete a disposable account after password confirmation and verify its owned
  rows are absent while shared catalogue rows remain. Do not use a real user.
- Confirm browser developer tools show no CORS, mixed-content or failed API
  requests.
- Install the PWA on a phone and reopen it from the home screen.
- On a real phone, start a Pro timer, background the PWA long enough to make
  drift visible, reopen it, and verify the same timer and timestamp-derived
  elapsed time survive. Repeat once with a paused timer and once after Finish
  but before saving the play. This is an in-app recovery check; outside-app
  timer surfaces and notifications remain a separate future task.

Record the commit SHA, deployment time and result in the release log at the
end of this file. Never paste API keys, tokens or database URLs into the log.

## 4. Database backup and restore rehearsal

Before adding alpha testers:

1. Open the database's **Recovery** page in Render.
2. Create a logical export and download it for independent retention.
3. Trigger a point-in-time recovery to a new database instance.
4. Connect the recovered database to a temporary API service or use a
   read-only SQL client. If using a local client, temporarily allow only your
   current public IP on the recovered instance and remove that rule when the
   check is complete.
5. Verify the migration revision and row counts for `users`, `games`,
   `user_games`, `plays` and `user_wishlist_games`.
6. Keep the original database as primary; delete the temporary recovery
   instance after verification to stop further charges.

Do not rehearse a restore over the live database. Render creates a separate
database for point-in-time recovery so it can be validated safely first.

### Proven logical-export restore to a disposable local database (SP-IOS-20B, 2026-11-15)

These steps were executed end to end against production in about 4.5 minutes
(export about 3.5 minutes; download, restore, verification and deletion about
1 minute for a 71 KB export). They do not touch the live database and need no
IP allowlist change. The export contains personal data: keep it only in a
private (`chmod 700`) scratch directory, never in the repository or
`~/Downloads`, and delete it in the same session.

1. In Render, open `board-game-picker-db` → **Recovery** → **Export** →
   **Create export**. Reload the page until the new row shows a
   `.dir.tar.gz` file.
2. Download that file with the row's link. The link carries a short-lived
   signed `auth` query string: treat it as a secret and never paste it into
   logs, reports or tickets. Record the archive's SHA-256.
3. Unpack it. The archive holds a `pg_dump` directory-format dump under
   `<timestamp>/boardgamepicker/`. Move that directory to a path without a
   colon (Docker bind mounts reject `:` in the source path).
4. Start a throwaway PostgreSQL 16 container with tmpfs storage and no
   published port, mounting the dump read-only:

   ```bash
   docker run -d --rm --name sp-restore -e POSTGRES_PASSWORD=<local-only> \
     -e POSTGRES_DB=restore --tmpfs /var/lib/postgresql/data:rw,size=512m \
     --mount type=bind,src=<dump-dir>,dst=/dump,readonly postgres:16
   docker exec sp-restore pg_restore -U postgres -d restore \
     --no-owner --no-acl --exit-on-error -j 2 /dump
   ```

5. Verify: `select version_num from alembic_version` equals the repository
   Alembic head; for every `TABLE DATA` entry in `pg_restore -l /dump`, the
   restored `count(*)` equals the number of non-empty data lines in the
   matching `<id>.dat` file excluding the `\.` terminator; and
   `select count(*) from pg_constraint where not convalidated` returns 0.
   Record counts only, never row contents.
6. `docker stop sp-restore` (the `--rm` flag and tmpfs discard the data),
   delete the scratch directory and archive, and confirm that no container,
   new Docker volume or downloaded copy remains.

Render keeps its own copy of each export for at least 7 days; that retention
is Render-managed.

Repeat the logical export before any risky migration and perform a recovery
rehearsal at least once before closed alpha.

## 5. Rollback

For an application-only regression, use Render's rollback/redeploy control to
deploy the last known-good commit. Check `/health` and repeat the affected
smoke test.

A code rollback does not reverse a database migration. Prefer forward-fixing
additive migrations. Only run `alembic downgrade <revision>` when all of the
following are true:

- the migration's downgrade has been tested against a disposable database;
- a fresh logical export exists;
- the downgrade will not discard production data;
- the previous application version is compatible with the resulting schema.

For destructive or uncertain schema incidents, use point-in-time recovery to
a separate database, validate it, then update the API's database connection.

### Pro purchases: RevenueCat setup and rollout (SP-PRO-01)

ShelfPick sells **Pro Lifetime** (`com.plutonightlabs.shelfpick.pro.lifetime`,
non-consumable) and **Pro Yearly** (`com.plutonightlabs.shelfpick.pro.yearly`,
auto-renewing) through RevenueCat. The server grants Pro only from RevenueCat's
own record of the account's purchase; a client claim, a webhook body or a
forged request grants nothing. Manual and test Pro grants on `users.tier` keep
working and are never changed by billing.

Owner setup, in this order (the repository cannot do any of it):

1. In RevenueCat, create a project and an iOS app for the ShelfPick bundle ID
   and add the App Store Connect in-app purchase key.
2. Add the two products. Create one entitlement with identifier `pro`
   (or set `REVENUECAT_ENTITLEMENT_ID`) and attach both products to it.
3. Create the `default` offering and make it current. Add the yearly product
   as the **Annual** package and the lifetime product as the **Lifetime**
   package; the app reads `offering.annual` and `offering.lifetime`.
4. Keep RevenueCat's default of transferring a purchase to the newest
   signed-in app user ID. ShelfPick signs each account in with its random
   `users.public_id`, so a restore on a second device returns Pro to the same
   account, and a purchase shared by two ShelfPick accounts moves to the one
   that restores it (the webhook then downgrades the first).
5. In App Store Connect, point App Store Server Notifications (V2) for the
   app at the URL RevenueCat shows, so renewals, expiry and refunds reach it
   within minutes.
6. In RevenueCat > Integrations > Webhooks, add
   `https://api.<your-domain>/billing/revenuecat/webhook`, set the
   Authorization header value to a long random string, and send both
   sandbox and production events.

Environment (Render dashboard, API service; all secrets):

| Variable | Value |
| --- | --- |
| `REVENUECAT_SECRET_API_KEY` | RevenueCat **secret** API key, **version 1**. Used for purchase lookups and, when a user deletes their ShelfPick account, to erase their RevenueCat customer. A version 1 key has no permission setting in the dashboard (only version 2 keys are scoped), so nothing needs configuring. If erasure is ever refused (403), it is logged as a warning naming the random account ID, which then has to be deleted by hand in the RevenueCat dashboard. Do not switch to a version 2 key without changing the code, which calls the version 1 API. |
| `REVENUECAT_WEBHOOK_AUTH` | The exact Authorization header value entered in the webhook above. |
| `REVENUECAT_ENTITLEMENT_ID` | Optional; defaults to `pro`. |

Set the first two together: the API refuses to start with only one. Until both
are set, `/billing/*` answers 503 and nothing can be sold. The iOS build also
needs `VITE_REVENUECAT_IOS_API_KEY` (the public `appl_` SDK key, safe to ship)
in `frontend/.env.ios`, and `VITE_PURCHASES_ENABLED=true` (the release lane sets
it for `purchases:true`). The Privacy Policy and Terms links show in every build,
beside the price when purchases are on.

Deploy order: the migration (`c4e7a9b2d6f1`, part of the pre-deploy command) is
additive and keeps the previous release working, because `users.public_id` has
a database default. Then deploy the API, then add the secrets and the webhook,
then ship the app build. Verify with a sandbox purchase on a TestFlight build
and a sandbox tester: the account should show Pro, a Restore on a second
install should return it, and `purchase_entitlements.environment` should read
`SANDBOX`. App Review buys in the sandbox against production, so sandbox
purchases are accepted and grant real Pro on the account that made them.

Rollback: remove `REVENUECAT_SECRET_API_KEY` and `REVENUECAT_WEBHOOK_AUTH` (with
both gone, billing is off and existing purchase rows keep working until their
expiry), or redeploy the previous commit. Do not downgrade the migration while
purchase rows exist.

Operations: a failed RevenueCat lookup (HTTP 502 from `/billing/sync` or the
webhook) never grants or removes Pro; RevenueCat retries webhooks. Refunds and
expiry arrive by webhook, and an expired yearly plan stops unlocking Pro at its
expiry time even if a notification is late. A deletion request for a user must
also be raised with RevenueCat; the account deletion in the app removes only
ShelfPick's own purchase row.

### Offline plays: `plays.client_id` migration (SP-NATIVE-01c)

Migration `e5b8c2f1a7d4` adds a nullable `plays.client_id` (a UUID string) and a
unique constraint on `(user_id, client_id)`. It rewrites no row. Existing plays and
imported plays keep a null id; nulls never collide.

- **Order:** take a fresh backup, deploy the API (the pre-deploy command runs
  `alembic upgrade head`), check `/health`, then release the app build. An app that
  sends `client_id` to an API without the migration would fail every save.
- **Older app builds** do not send `client_id` and are unaffected. An older API on the
  migrated schema is compatible (the column is nullable).
- **Smoke test:** `POST /plays` twice with the same `client_id` returns 201 then 200
  with the same play `id`, and the game's history shows one play.
- **Rollback:** prefer a forward fix. `alembic downgrade c4e7a9b2d6f1` is tested; it
  drops the constraint and the column and loses only these ids. Afterwards the server
  can no longer recognise a retried play, so a play whose reply was lost could be saved
  twice. Avoid downgrading while phones may hold unsynced plays unless that is accepted.

## 6. Release log

| Date | Commit | Deploy | Migration | Email | Backup/restore | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| YYYY-MM-DD | SHA | Pass/Fail | Pass/Fail | Pass/Fail | Pass/Fail | |

### Phone voting switch

`GAME_NIGHT_PHONE_VOTING_ENABLED` was set to `true` in production on
2026-11-17 (Render environment, manual deploy of `ffff122`; the web service was
deployed at the same commit). `render.yaml` carries `"true"` so a Blueprint sync
does not turn it off. To roll back, set it to `false` in the Render API
environment and redeploy: hosts and guests then see the "unavailable" state and
existing data is kept. The matching privacy policy and terms were published on
the website the same day.
