# SP-BETA-01 — private beta readiness audit

**Date:** 12 October 2026  
**Scope:** audit and planning only; no application, schema, dependency,
production or deployment change was authorised.

## Decision

ShelfPick is **not ready to invite private-beta testers today**, but it does
not need the full remaining public-launch backlog first. A small controlled
beta can start after one clean release candidate is assembled and the must-fix
gates below are evidenced. SP-PB02 does **not** need to remain a beta blocker
if Top 100 is deliberately made unavailable, rather than continuing to try an
unapproved and unreliable ranked-page source.

The minimum beta should use a free Render static site, one paid Render API,
one paid private Render PostgreSQL database, a verified Resend sender and a
small invite allow-list. Hot, For You and existing Free access remain. Selected
testers may receive a manually controlled Pro entitlement without checkout;
the approved launch model remains a **£3.99 one-off Pro purchase**.

## SP-BETA-02 implementation update — 12 October 2026

Controlled beta access and truthful unavailable services are implemented
locally. Production now fails to start without a non-empty server-only
`BETA_INVITE_EMAILS` allow-list. Invited addresses are normalised with Unicode
case folding, new accounts are always Free, and registration returns the same
message for invited, uninvited and already-registered addresses. New beta
accounts receive no session until their 24-hour, hashed, single-use verification
token is consumed. A beta-specific token purpose lets existing accounts keep
their previous login behaviour. Resend is generic and rate limited.

Top 100 now returns an explicit unavailable response before service/source
execution, and the runtime candidate provider contains only the authorised Hot
source. For You continues to use Hot candidates and its existing scoring.
SP-PB02 remains blocked until an authorised official rankings source passes its
documented validation.

SP-BETA-02 browser closeout passed on 12 October 2026. The earlier failures
were test-environment defects: the first preview omitted VITE_API_BASE_URL;
the inline authenticated fixture then omitted CORS headers, so session restore
correctly failed before Discover rendered. A correctly configured production
preview and stateful CORS-valid synthetic API passed Google Chrome at 390x844
and 1440x900 in light/dark. Authentication, verification, resend, existing
login, Free/Pro Discover behaviour, absence of ranked requests, focus,
overflow and navigation clearance passed. See
sp-beta-02-qa-closeout-2026-10-12.md. SP-BETA-02 is complete; no application
change was required by QA.

## 1. Release and integration state

At audit time the checkout is `main`, one commit ahead of its local
`origin/main` tracking ref:

- local `HEAD`: `871d4bf` — completed SP-PB09B add-game work;
- tracked remote head: `de97c31`;
- completed SP-PB12B, SP-PB13, SP-PB14A and SP-PB14B work remains uncommitted
  among a large set of tracked and untracked files;
- `frontend/src/components/picker/PickerView.tsx` contains an unrelated,
  formatting-heavy rewrite and must not enter the beta candidate accidentally;
- the last known GitHub Actions run for remote `main` was successful for
  `de97c31` on 29 September 2026, but no CI run covers `871d4bf` or the dirty
  completed slices;
- remote `main` was observed unprotected. Branch protection and a required CI
  review gate are therefore release-process gaps.

The checked-in CI runs PostgreSQL 16, migrations, `alembic check`, the complete
backend suite, frontend tests, ESLint, production build and PWA validation on
pushes and pull requests. It does not replace authenticated deployed smoke
tests, recovery rehearsal, security review or physical-device validation.

### Safe integration sequence

1. Leave the current checkout intact and record a recoverable snapshot of all
   local changes. Do not reset, reformat or stage `PickerView.tsx` with the
   beta work.
2. Create a clean release-candidate worktree and branch from the then-current
   remote `main`. Confirm the live remote SHA before integrating.
3. Integrate the reviewed local work as separate, reviewable units in this
   order: SP-PB09B (`871d4bf`), SP-PB12B, SP-PB13, SP-PB14A, then SP-PB14B.
   Reconcile documentation separately. Explicitly exclude unrelated
   `PickerView.tsx` changes and any local-only test-account data.
4. Run the full release suite after every dependency boundary and require a
   green pull request on the complete candidate. Protect `main` against direct
   pushes and require both CI jobs before merge.
5. Add only the bounded beta-entry fixes listed below, rerun all automated
   checks, then perform the deployment, recovery and physical-device gates as
   separately authorised release operations.
6. Invite testers only after owner acceptance of the exact deployed commit.

## 2. BGG Top 100 decision

SP-PB02's display and rank-boundary logic is tested, but cold retrieval is not
viable: the ranked web pages return HTTP 403 and the current application token
does not grant the official ranks dump. Process-local stale data is not a
truthful or durable beta source. Substituting Hot results would be misleading,
and unlicensed scraping is not acceptable.

SP-PB02 should therefore be removed from the private-beta critical path only
after a small fail-closed change:

- show Top 100 as clearly **Unavailable during private beta**, or remove its
  selectable tab while retaining an accessible explanation;
- stop production attempts to scrape ranked pages;
- do not fabricate rankings or silently fall back to Hot;
- keep Hot, For You and the existing Free-access policy unchanged.

Restore Top 100 only after BGG grants official ranks-dump access, or another
contractually permitted official source is approved. Re-enable behind an
explicit configuration switch after validating cold start, ranks 1–100,
warm/stale/restart behaviour, attribution and source-outage handling. This
does not mark SP-PB02 complete; it records that the feature may be unavailable
without blocking a controlled beta.

## 3. Minimum hosting and operations configuration

The checked-in Render Blueprint defines:

| Layer | Minimum beta configuration | Baseline cost |
| --- | --- | ---: |
| Frontend | Render static React PWA on the global CDN | $0/month |
| API | Frankfurt `0.5c-512mb` FastAPI service | $7/month |
| Database | Frankfurt private PostgreSQL 16, `0.1c-256mb`, 1 GB | $6/month |
| Email | Verified Resend domain/sender | usage-plan dependent |

The current official Render list price is therefore approximately
**$13/month**, before bandwidth/build overages, domain registration, email
usage or temporary recovery resources. Confirm the actual checkout before
provisioning. Do not use free PostgreSQL for beta: it expires after 30 days,
has no backups and is deleted after its grace period. A free web service would
also introduce cold-start delay; the Blueprint's paid API is the safer small-
beta baseline.

The API filesystem is ephemeral and must remain stateless. The only persistent
application store is PostgreSQL; generated PNGs remain client-side. Required
secrets and configuration are `DATABASE_URL`, `JWT_SECRET`,
`ACCESS_TOKEN_MINUTES`, `CORS_ORIGINS`, `FRONTEND_URL`, `RESEND_API_KEY`,
`EMAIL_FROM`, `BGG_API_TOKEN` and frontend `VITE_API_BASE_URL`. Keep secrets in
Render, never GitHub or Vite client variables. Rotate any value exposed during
setup.

Before invitations, evidence all of the following:

- Blueprint resources, paid plans, Frankfurt API/database colocation, private
  database networking and custom-domain TLS;
- successful pre-deploy migration, `/health` database check, SPA rewrites and
  exact frontend/API/CORS URL alignment;
- verification and reset mail from the production sender;
- one independent logical export and one isolated point-in-time restore with
  migration revision and key row counts checked;
- recorded recovery objectives: initially **RPO <= 24 hours** using a daily
  retained logical export plus provider recovery, and **RTO <= 4 hours** for
  this small beta, subject to a successful rehearsal;
- a named operator, incident contact, release log and last-known-good rollback
  commit.

The 20 September dashboard review found no Render resources or Blueprint
instance. That is the last documented environment state, not a current live
assertion; refresh it before provisioning. No production resource was created
or inspected during this audit.

## 4. Security and privacy findings

| Severity | Finding | Beta disposition |
| --- | --- | --- |
| **Critical** | None confirmed from the source and test evidence reviewed. | Continue dependency and deployed-environment checks on the candidate. |
| Resolved locally by SP-BETA-02 | Registration is now server allow-listed, generic and verification-gated. | Revalidate configuration and email delivery on the release candidate. |
| **High** | No production database, backup or restore evidence exists. | **Must fix operationally:** paid database, export and isolated restore rehearsal before any tester data. |
| **High** | Permission for commercial redistribution of BGG cover artwork in exported PNGs is unresolved. | **Must resolve externally or disable cover-bearing exports** for beta; fallback artwork may remain after review. |
| **Medium** | Ranked-page retrieval is unapproved/unreliable. | Fail closed for Top 100 before beta; do not scrape or substitute. |
| **Medium** | Registration lacks its own effective abuse control; other limiters are in-memory per process and rely on forwarded client-IP handling. | Invite gating is the beta mitigation. Before public launch, use a trusted proxy boundary and shared/durable limits for login, reset, verification and guest joins. |
| **Medium** | Bearer tokens last 24 hours and are stored in browser `localStorage`; there is no demonstrated server-side revocation. Static headers omit a Content Security Policy. | Accept only for the small beta after XSS review and CSP/deployed-header verification; shorten exposure or add revocation before public launch if risk warrants. |
| **Medium** | No user-facing account deletion flow or documented retention schedule was found. | Publish a beta privacy notice, retention schedule and a tested manual deletion/export process before invitations; self-service can follow before public launch. |
| **Medium** | `main` is unprotected and the local release candidate is not represented by remote CI. | Protect the branch and require candidate CI/review before merge. |
| **Low** | Account enumeration is possible during registration through duplicate-email responses. | Use generic responses as part of invite gating; retain internal audit logging without email addresses in routine logs. |
| **Low** | No deployed error/uptime alerting evidence exists. | Add a minimal health alert, error review cadence and tester support channel before invitations. |

Positive controls already present include strong password hashing, signed
time-limited JWTs, production-secret validation, one-time verification/reset
tokens, explicit production CORS origins with credentials disabled, server-side
entitlements, private database networking, redacted Game Night join-token log
paths, account-scoped repositories and extensive isolation tests. These are
source-level findings; they still need verification against the deployed beta
environment.

BGG attribution must remain visible wherever required. Hot, search and game
metadata access must use the approved server-side token and comply with the
agreement. No claim is made here that the current agreement permits ranked
scraping or artwork redistribution.

## 5. Pro without checkout

Private beta does not need payment processing. Free testers can use the
existing Free feature set. A deliberately selected subset may use the existing
server-side `PRO` tier, but the repository's local test-account script is
development-only and must not be used as a production entitlement mechanism.

Use a documented, auditable operator procedure tied to approved invite email
addresses, record who granted or revoked each entitlement, and verify the API
response rather than trusting client state. Do not expose an unrestricted
admin endpoint or client-side tier override. Revoke test grants at beta end.
No price, checkout promise or permanent licence is created; launch remains the
approved £3.99 one-off Pro purchase.

## 6. Executable mobile beta checklist

Use at least one current physical iPhone/Safari and one current physical
Android/Chrome on separate tester accounts. Record device, OS/browser version,
theme, deployed commit, timestamp and result. Playwright already covers the
390x844 and 1440x900 light/dark layout matrix, keyboard focus, bottom-nav
clearance, horizontal overflow and the mocked feature states documented by
their completed slices. It does **not** prove the device integrations below.

### Physical devices required

- [ ] Register from an invited address, receive verification mail, reject an
  uninvited address, sign in/out, reset the password, and confirm the old
  password fails.
- [ ] Install from Safari and Chrome, launch in standalone mode, verify icon,
  theme/splash, direct-route reopen and a controlled offline/reconnect cycle.
- [ ] On both devices exercise Picker, Collection, Discover, Insights, Settings
  and play logging with the on-screen keyboard, browser chrome expanded and
  collapsed, portrait and landscape, light and dark.
- [ ] Start a Pro Game Night on one real device. Scan its QR code on the other
  network/device, join without an account, vote/edit/abstain, close voting and
  verify the same deterministic result. Check invalid, expired and revoked
  joins and ensure host/account data is not exposed.
- [ ] Start a timer, background for at least five minutes and reopen. Repeat
  while paused and after Finish but before save; elapsed time must derive from
  timestamps without drift or duplicate saves. Repeat after the OS evicts and
  relaunches the PWA where practical.
- [ ] Share a saved play and monthly recap through the native iOS and Android
  share sheets, including cancel. Verify the received PNG, privacy defaults,
  fallback artwork and long text. Do not test cover-bearing exports until
  artwork permission is resolved.
- [ ] Download each PNG, locate it in Files/Downloads, open it and confirm the
  1200x1500 output is complete and legible.
- [ ] Check notch/safe-area and bottom-navigation clearance, no horizontal
  scroll, no obscured primary action, visible focus with a hardware keyboard,
  and usable layout at 200% browser text/zoom where supported.

### Automated evidence to rerun on the candidate

- [ ] Full backend PostgreSQL suite and Alembic head/check.
- [ ] Full frontend suite, ESLint, production build and PWA checks.
- [ ] Existing Playwright 390x844 and 1440x900 light/dark journeys, including
  empty/error states, Game Night UI, sharing and navigation safety.
- [ ] Deployed authenticated smoke test for health, nested-route refresh,
  account isolation, Free/Pro responses and CORS/mixed-content errors.

## 7. Beta entry criteria

### Must fix before private beta

| Blocker / owner action | Severity | Complexity | Acceptance criteria | Evidence |
| --- | --- | --- | --- | --- |
| Release engineer: assemble a clean candidate excluding unrelated `PickerView.tsx` work | High | M | Reviewed candidate contains only intended completed slices and beta fixes; remote CI is green | commit/file manifest, PR review, CI URLs and final diff |
| Backend/security: server-enforced invite access and verified-email activation | High | M | Uninvited users cannot create usable accounts; invited users must verify; responses do not enumerate membership | API/PostgreSQL tests plus deployed email journey |
| Discover owner: make Top 100 explicitly unavailable and stop ranked scraping | Medium | S | No ranked fetch, fabricated rank or Hot substitution; Hot/For You and Free access unchanged | focused tests and deployed UI/network check |
| Release/DB owner: paid database, secrets, health, export and isolated restore | High | M | exact environment alignment, healthy migration, RPO/RTO evidence and restored row/revision checks | Render records and redacted rehearsal log |
| Product/legal owner: resolve BGG cover-export rights or disable covers | High | S/external | written permission is retained, or exports use only an approved fallback | agreement reference or tested fail-closed build |
| Privacy owner: beta notice, retention/deletion process and contact | Medium | S | testers consent to documented purpose/retention; deletion request is rehearsed and logged | published notice and synthetic deletion evidence |
| QA/release owner: physical iPhone and Android checklist | High | M | all device-required items above pass on the exact deployed commit, or blocking defects are fixed and rerun | signed device matrix, screenshots/video and defect links |
| Owner: explicit invitation decision | High | S | exact commit, tester list, Pro grants, support route and rollback owner approved | dated release log entry |

### Can defer until public launch

- payment checkout and licence fulfilment for the £3.99 one-off purchase;
- an authorised implementation of SP-PB02 Top 100;
- durable/distributed abuse controls, token revocation/refresh and a fuller CSP
  hardening pass, provided the private-beta mitigations above remain bounded;
- self-service account export/deletion after the tested manual process exists;
- broader observability, capacity/load testing and a formal incident rota;
- a polished production entitlement administration surface.

### Post-launch

- advanced statistics and any new Pro capabilities;
- custom/photo avatars and their object-storage/upload pipeline;
- barcode lookup, source-neutral custom games and outside-app timer surfaces;
- other roadmap enhancements that do not remediate a beta defect.

### External dependencies

- Render billing, live plan availability and dashboard provisioning;
- DNS ownership and TLS issuance;
- verified Resend domain and deliverability;
- BGG token/terms, ranks-dump approval and artwork-export permission;
- physical iPhone and Android hardware plus two-network QR testing;
- owner approval of tester identities and the invitation date.

## 8. Recommended next task

**SP-BETA-02 — Controlled beta access and truthful unavailable services.**
Implement a server-enforced invite allow-list with verified-email activation,
generic rejection behaviour and audit-safe tests; in the same candidate,
disable Top 100 ranked retrieval and present its explicit private-beta
unavailable state without changing Hot, For You, Free access or entitlement
definitions. This is the smallest application slice that closes the two
current public-entry/fail-open risks before operational provisioning.

After SP-BETA-02, the remaining gates are principally release integration,
external permissions, provisioning/recovery and physical-device evidence.

## 9. Validation performed for this audit

The full configured local release check passed on 12 October 2026:

- backend: **291 passed, 5 skipped** against the verified development
  PostgreSQL target on `localhost:5433`;
- Alembic: **No new upgrade operations detected**;
- frontend: **84 passed**;
- ESLint: passed;
- production build: passed, including service-worker generation;
- PWA asset/metadata/precache check: passed;
- `git diff --check`: passed.

The first sandboxed backend attempt could not open the local database socket
and reported 23 connection-derived failures, 268 passes and 5 skips. The same
command was rerun with approved local-database access and passed as recorded
above. Frontend tests emitted non-failing warnings that Vite's WebSocket port
24678 was already in use. The backend emitted one existing Starlette/httpx
deprecation warning. No dependency was installed or changed.

These results validate the current dirty checkout, not an integrated remote
release candidate. No new Playwright pass was needed for documentation-only
changes; the completed-slice browser evidence was reviewed. No live account,
hosted environment, native share sheet, production email, backup restore or
physical mobile device was tested by SP-BETA-01.
