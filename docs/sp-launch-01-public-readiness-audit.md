# SP-LAUNCH-01 — Public Release Readiness Audit

**Audit date:** 3 November 2026  
**Release baseline:** `e15d5ceed75518af9e2307e6aff60ee6a819adfb`  
**Decision:** **NO-GO today; CONDITIONAL GO after SP-LAUNCH-02 and the external gates below.**

ShelfPick has a useful, tested Free product and a credible low-cost hosting plan. It is not safe to enable public registration yet. The shortest route is one bounded launch-hardening milestone, followed by legal/licensing decisions, a recovery rehearsal, deployed smoke tests and internal physical-device/accessibility checks. An external beta is not required. Checkout is not required if launch is explicitly Free-only and Pro remains clearly unavailable for purchase.

## Evidence boundary

- The clean, last-validated baseline is merge `e15d5ce`; merged PR #5 records passing backend/migration and frontend CI for its exact release head.
- This audit re-ran a representative baseline slice: **77 backend tests passed** (auth, config, rankings, Game Night, wishlist and API); **92 frontend tests, lint, production build and PWA checks passed**. The first backend attempt lacked `DATABASE_URL`; the configured rerun passed. Vite WebSocket sandbox warnings did not fail tests.
- Source inspection covered auth/session controls, per-user repositories, import/sync paths, browser token storage, configuration, migrations, deployment manifests, public journeys and launch documents. The separate security report is at the Codex Security scan artifact for scan `7a4d20ed-2cc9-4daa-8f4a-48ad171d359f`.
- The current checkout is **not a release candidate**: local `main` is ahead 1/behind 12, based on older `871d4bf`, and contains extensive owner changes. Open draft PRs #1 and #2 are stale documentation-only work. Nothing in this audit authorises cleanup or integration.
- No Render service, live domain, production database, production mail flow, restore, physical device or human accessibility review was tested. Dependency advisories were not revalidated: the networked npm check was not authorised and Python advisory tooling is absent.

## Implemented product versus planned work

| Area | Verified implemented at `e15d5ce` | Not implemented / not evidenced |
|---|---|---|
| Core Free product | Onboarding; collection CRUD; BGG sync; wishlist; Picker/Hot recommendations; play recording/history; sharing; insights; Game Night voting; settings and PWA shell | Discover Top 100 data source; richer editing/analytics |
| Authentication | Registration, login, verification mail, resend and password reset; Argon2 password hashing; signed/expiring JWTs; hashed one-time tokens | Safe public-registration state machine; shared bounded abuse controls; session revocation |
| Entitlements | Free tier is useful; Pro comparison states purchase is unavailable and does not show price/checkout | Billing, purchase and subscription recovery—which are out of launch scope for a Free-only release |
| Operations | Render blueprint, `/health`, explicit production secrets/CORS and fail-closed export cover artwork | Provisioned services, live monitoring, restore evidence, rollback rehearsal |
| Legal/support | Basic Help/About copy and BGG disclaimer | Privacy notice, terms, controller/support contact, retention/deletion process and approved BGG attribution/licence |

Planned features must remain labelled unavailable. They are not launch blockers unless public copy promises them.

## BLOCKERS

### B1 — Public authentication and session abuse controls

**Evidence:** Production config still requires beta invite configuration (`backend/config.py:133-137,211-214`). In public mode registration returns a normal JWT before `email_verified` is true, and tests encode that behaviour (`backend/api/routers/auth.py:190-273`; `backend/tests/test_auth.py:258-288`). Duplicate registration returns a distinct 409 (`auth.py:204-221`). The process-local email/IP limiter has attacker-controlled, unbounded key storage (`backend/auth/login_rate_limiter.py:15-185`). Password reset and browser logout do not revoke existing 24-hour JWTs (`backend/auth/security.py:36-80`; `backend/api/routers/auth.py:695-741`; `frontend/src/App.tsx:375-381`). Resend Free permits 100 messages/day, so public abuse could exhaust transactional mail ([Resend pricing](https://resend.com/pricing?product=transactional)).

**Impact:** Email-address squatting, enumeration, mail denial, memory growth and continued stolen-session access.  
**Smallest safe resolution:** Replace invite-only startup semantics with an explicit public mode; issue only a restricted pending-verification state until ownership is confirmed; make registration/resend/recovery responses indistinguishable; use a bounded shared limiter for registration, login, resend and reset; revoke prior tokens on reset/logout-all; add mail quota alerts. Verify the trusted-proxy address rule in the deployed environment.  
**Tests:** Public/pending/verified state matrix, claimed-email and response-parity tests, limiter cardinality/multi-instance tests, old-token rejection and mail failure/quota paths.  
**Effort/dependencies:** **1.5–2.5 engineer-days**; production Redis-like service is not assumed—choose the smallest bounded store compatible with the approved hosting plan. Resend/domain configuration is an operator gate.

### B2 — Privacy, retention, deletion and public disclosures

**Evidence:** ShelfPick stores email/display name/BGG identity and preferences; collections/wishlists; players; plays, participants, scores and locations; picker analytics; rankings/comparisons; and Game Night guest names/ballots. No public privacy/terms/support pages, account-deletion flow or documented retention/export request process was found (`frontend/src/components/SettingsSectionView.tsx:45-73`; `README.md:288-294,484-489`). Database ownership generally supports cascading deletion, but it is not exposed or end-to-end tested; backup and analytics/expired-session retention are undefined.

**Impact:** Users cannot make an informed choice or exercise deletion/access rights; support and backup handling are ambiguous. UK GDPR privacy information normally includes controller/contact, purpose/legal basis, recipients, retention and rights ([ICO privacy information checklist](https://ico.org.uk/for-organisations/advice-for-small-organisations/getting-started-with-gdpr/data-protection-self-assessment-medium-businesses/what-information-you-must-supply-under-the-gdpr/)); erasure requests normally require a response within one month, subject to exceptions ([ICO erasure guidance](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/individual-rights/individual-rights/right-to-erasure/)). This audit does not claim legal compliance.  
**Smallest safe resolution:** Add owner-approved privacy, terms and support/contact pages; define controller, purposes/legal bases, processors/transfers, retention, guest-voting disclosure and request handling; implement confirmed authenticated account deletion across all owned data and token invalidation; document manual access/export handling and backup expiry.  
**Tests:** Deletion cascade/rollback and re-auth tests covering every user-owned table, post-deletion token rejection, page/link checks and a documented request drill.  
**Effort/dependencies:** **2–3 engineer-days**, plus owner inputs and qualified UK privacy/legal review. Self-service data export may follow launch if a tested manual process exists.

### B3 — Bounded public workloads and dependency gate

**Evidence:** BG Stats upload reads the complete body and permits unbounded plays/participants (`backend/api/routers/imports.py:22-84`; `backend/bgstats/play_parser.py:24-114`; `backend/services/bgstats_play_import_service.py:25-121`). Collection sync can cause collection-sized BGG pagination/retries and database work without per-user/global concurrency or cost bounds (`backend/api/routers/collection.py:36-124`; `backend/services/collection_service.py:70-188`; `backend/bgg/client.py:208-325`). Current dependency advisories are unknown.

**Impact:** A normal account can exhaust memory, workers, BGG allowance or database capacity.  
**Smallest safe resolution:** Add byte/record/participant/transaction limits; per-user sync cooldown and global concurrency/work caps; safe upstream timeout/retry behaviour; run lockfile-based JavaScript and Python advisory checks in CI.  
**Tests:** Boundary rejection, large-fixture, concurrent sync, timeout/retry and advisory-gate tests.  
**Effort/dependencies:** **1–2 engineer-days**; BGG test fixtures and approved CI network access.

### B4 — BGG permission and attribution

**Evidence:** The UI has a text disclaimer but no linked “Powered by BGG” logo (`frontend/src/components/SettingsSectionView.tsx:52-55`). BGG says API registration/authentication is required, public-facing applications must carry linked attribution, and commercial-benefit use requires an appropriate licence ([API access](https://boardgamegeek.com/using_the_xml_api), [terms](https://boardgamegeek.com/wiki/page/XML%20API%20Terms%20of%20Use), [licences](https://boardgamegeek.com/licenses)). Image rights generally remain with uploaders ([image guidance](https://boardgamegeek.com/wiki/page/Image_submissions)). Export cover artwork is correctly disabled by default, but in-app covers and data still need an approved basis.

**Impact:** Public launch may breach upstream terms or image rights.  
**Smallest safe resolution:** Record the owner’s commercial/non-commercial classification and approved API permission; add required linked branding; keep export covers disabled unless separately cleared.  
**Tests:** Attribution link/asset, no-cover export and missing-BGG/failure paths.  
**Effort/dependencies:** **0.5 engineer-day**, plus external BGG approval/licensing response.

### B5 — Production recovery, monitoring and controlled deployment

**Evidence:** No Render resources exist. The blueprint uses manual deployment and appropriate secret placeholders, but no live TLS/CORS/mail/BGG/health, monitoring, backup or restore evidence exists. Render paid PostgreSQL provides plan-dependent point-in-time recovery and retained logical exports; restores create a new database ([backup/restore](https://render.com/docs/postgresql-backups)). Render supports health checks and service notifications ([health checks](https://render.com/docs/health-checks), [notifications](https://render.com/docs/notifications)) and recommends external probes and tested backups ([uptime guidance](https://render.com/docs/uptime-best-practices)).

**Impact:** A failed launch or data-loss event may be undetected or unrecoverable.  
**Smallest safe resolution:** After separate approval, provision from one clean approved SHA; verify domains/TLS/CORS/secrets and `/health`; enable provider notifications plus one external probe; name an incident owner; set cost alerts; make an independent logical export and rehearse isolated restore; document rollback and RPO/RTO.  
**Tests:** Exact-SHA CI, deployed smoke/auth/mail/BGG checks, synthetic health alert, restore row-count/integrity checks and rollback rehearsal.  
**Effort/dependencies:** **0.5–1 operator-day** after implementation; explicit owner approval for provisioning, spend, credentials and deployment.

### B6 — Internal release verification

**Evidence:** Automated browser and unit coverage is substantial, but there is no current physical-device, assistive-technology or live-production evidence for the release candidate.

**Impact:** Mobile-only, PWA, share, keyboard, accessibility and provider failures could reach all public users at once.  
**Smallest safe resolution:** On the exact candidate, complete internal iPhone Safari and Android Chrome checks covering install/reopen/offline, safe areas/keyboard/200% zoom, collection/import/Picker/play/share, QR cross-device Game Night, background timers and failed networks; run VoiceOver and TalkBack critical journeys; record owner acceptance.  
**Tests:** Checklist above plus clean PostgreSQL migration and full mandatory project validation.  
**Effort/dependencies:** **1–2 days elapsed**, with physical devices, two browsers and a second device for guest voting.

## RISK — owner may accept with mitigation

1. **Bearer token in local storage:** no XSS path was found, but compromise has a 24-hour window. Add a restrictive CSP/header test and the revocation control in B1; a cookie redesign is not required for launch.
2. **Free-only commercial posture:** launch without checkout is honest only while Pro says purchase is unavailable and no price/paid entitlement is promised. Selling Pro would create a separate payment, tax, entitlement and recovery blocker.
3. **BGG dependency and unavailable Top 100:** upstream failure can degrade collection import and Discover. Keep truthful unavailable/failure states, timeouts and fallback behaviour; do not fabricate data.

## POLISH — defer

Richer play editing, photo avatars, advanced analytics, persisted discovery caches, additional onboarding, feedback tooling and product analytics. None is required for a useful Free launch. The local-development PostgreSQL port should also bind to `127.0.0.1`; this is not a production blocker.

## Minimal launch scope and SP-LAUNCH-02

Launch **Free-only** with the implemented collection, Picker/Hot, wishlist, plays, sharing, insights, settings and Game Night journeys. Keep Pro and Top 100 explicitly unavailable; keep export cover artwork disabled.

Recommended single implementation milestone: **SP-LAUNCH-02 — Public Launch Hardening**. Batch B1–B4 and the technical/documentation portion of B2, add focused tests and mandatory validation, and prepare—but do not perform—the deployment/recovery/device checklist. Estimated engineering effort: **6–9 days**. External legal/BGG responses and device/restore verification determine elapsed time.

## Approval gates and owner decisions

Before implementation: approve Free-only launch; controller/legal and public support identities; retention schedule; BGG use classification; session/RPO/RTO policy; incident owner; and whether current hosting spend remains approved.

Before deployment: clean exact SHA; green CI/advisory checks; approved privacy/terms/BGG evidence; deletion drill; physical/accessibility acceptance; explicit Render provisioning/spend/credential authority; live smoke, monitoring and isolated restore evidence. Deployment remains a separate owner-authorised action.
