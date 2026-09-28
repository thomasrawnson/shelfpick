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
   runtime environment `NODE_VERSION=22`, and auto-deploy **After CI Checks
   Pass**. Confirm its latest deploy is
   `aa686635580ecf3bdab3704388528fa67a79289c` and `Live`.
3. For `board-game-picker-api`, confirm region **Frankfurt**, plan
   `0.5c-512mb`, branch `main`, root directory `backend`, build command
   `pip install -r requirements.txt`, pre-deploy command
   `alembic upgrade head`, start command `bash start.sh`, health path
   `/health`, runtime environment `PYTHON_VERSION=3.12.14`, and auto-deploy
   **After CI Checks Pass**. Confirm the latest
   deploy is the same commit and `Live`.
4. For `board-game-picker-db`, confirm region **Frankfurt**, PostgreSQL 16,
   plan `0.1c-256mb`, 1 GB storage, database `boardgamepicker`, user
   `boardgamepicker`, and an empty public IP allow list.
5. On the web service, confirm `VITE_API_BASE_URL` is present and equals the
   API's HTTPS origin. On the API, confirm these keys are present without
   revealing their values: `APP_ENV`, `DATABASE_URL`, `JWT_SECRET`,
   `ACCESS_TOKEN_MINUTES`, `AI_PICKER_ENABLED`, `CORS_ORIGINS`,
   `FRONTEND_URL`, `RESEND_API_KEY`, `EMAIL_FROM` and `BGG_API_TOKEN`.
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
provider before creation preserves the intended GitHub integration and
`checksPass` deployment gate. Adding a card, connecting repository access and
applying the Blueprint are production/account changes outside this inspection.

At Render's 2026-09-20 list prices, the Blueprint adds approximately
**$13.30/month** on a Hobby workspace: $7 for `board-game-picker-api`, $6 for
`board-game-picker-db` compute and $0.30 for 1 GB database storage.
`board-game-picker-web` is free. The two proposed custom domains are within the
Hobby allowance; usage overages, a paid workspace or a temporary recovery
database can add cost. Confirm the checkout estimate in Render before the
later provisioning step.

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
| `CORS_ORIGINS` | API | `https://app.<your-domain>` |
| `FRONTEND_URL` | API | `https://app.<your-domain>` |
| `RESEND_API_KEY` | API | Resend production API key |
| `EMAIL_FROM` | API | Verified sender shown above |
| `BGG_API_TOKEN` | API | Approved BoardGameGeek application token |

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

Automatic deployment waits for the GitHub Actions checks to pass. Render then
runs `alembic upgrade head` as the API's pre-deploy command. A failed migration
prevents the new API version from starting.

## 3. Release verification

Complete this checklist against production before inviting testers:

- `GET https://api.<your-domain>/health` returns HTTP 200 with database `ok`.
- Open `https://app.<your-domain>`, then refresh a nested Collection and Want
  to Play route; the SPA must reload rather than return 404.
- Register a new address that has never been used in production.
- Receive the verification email, open its HTTPS link and verify the account.
- Request a password reset, receive the second email and set a new password.
- Log in with the new password and confirm the old password no longer works.
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
   `user_games`, `plays` and `user_wishlist`.
6. Keep the original database as primary; delete the temporary recovery
   instance after verification to stop further charges.

Do not rehearse a restore over the live database. Render creates a separate
database for point-in-time recovery so it can be validated safely first.

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

## 6. Release log

| Date | Commit | Deploy | Migration | Email | Backup/restore | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| YYYY-MM-DD | SHA | Pass/Fail | Pass/Fail | Pass/Fail | Pass/Fail | |
