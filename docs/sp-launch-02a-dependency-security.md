# SP-LAUNCH-02A dependency security record

- Date: 2026-11-03
- Base: `e15d5ceed75518af9e2307e6aff60ee6a819adfb`
- Candidate branch: `codex/sp-launch-02`

## JavaScript audit

The initial `npm audit --omit=dev --json` reported 15 vulnerable package
entries: 3 low, 8 moderate and 4 high. The PWA compiler was incorrectly
classified as a runtime dependency, so every entry was build-only despite
appearing in the production audit. The exact entries and dependency paths were:

| Package | Severity | Dependency path | Resolution / exposure |
| --- | --- | --- | --- |
| `@rollup/plugin-node-resolve` | Low | `vite-plugin-pwa > workbox-build` | Residual build-only transitive; see below. |
| `@trickfilm400/rollup-plugin-off-main-thread` | Moderate | `vite-plugin-pwa > workbox-build` | Residual build-only transitive; see below. |
| `brace-expansion` | High | lint/PWA glob matchers | `5.0.9 -> 5.0.12`; nested `2.1.4 -> 2.1.7`. Not used by the browser application. Executed only against repository/build inputs. |
| `deepmerge` | Low | `vite-plugin-pwa > workbox-build > @rollup/plugin-node-resolve` | Residual build-only transitive; see below. |
| `ejs` | Moderate | `vite-plugin-pwa > workbox-build > rollup-plugin-off-main-thread` | Residual build-only transitive; see below. |
| `fast-uri` | High | `vite-plugin-pwa > workbox-build > ajv` | `3.1.6 -> 3.1.9`. Build configuration validation only; no public request path. |
| `filelist` | Moderate | `vite-plugin-pwa > workbox-build > rollup-plugin-off-main-thread > ejs > jake` | Residual build-only transitive. |
| `glob` | Moderate | `vite-plugin-pwa > workbox-build` | Residual build-only transitive. |
| `jake` | Moderate | `vite-plugin-pwa > workbox-build > rollup-plugin-off-main-thread > ejs` | Residual build-only transitive. |
| `minimatch` | Moderate | PWA and lint glob matchers | Residual build-only transitive. |
| `serialize-javascript` | Low | `vite-plugin-pwa > workbox-build > @rollup/plugin-terser` | `7.1.0 -> 7.1.4`; build-only. |
| `source-map-js` | High | `vite > postcss` | `1.2.1 -> 1.2.2`. Build processing only; no public request path. |
| `vite` | High | direct build/dev dependency | `8.2.2 -> 8.2.4` within the supported Vite 8 range. Its dev server is not deployed; local/CI build execution was nevertheless patched. |
| `vite-plugin-pwa` | Moderate | direct build dependency | Correctly moved to `devDependencies`; residual chain below. |
| `workbox-build` | Moderate | `vite-plugin-pwa` | Residual build-only transitive; see below. |

A later full-graph scan also exposed and fixed the high-severity transitive
`zod` finding (`4.4.3 -> 4.6.7`) in the lint-only
`eslint-plugin-react-hooks` path.

Post-fix results:

- `npm audit --omit=dev --audit-level=low`: **0 vulnerabilities**.
- `npm audit --audit-level=high`: **passes**, with 2 low and 19 moderate
  build/lint-only package entries remaining.
- No high or critical entries remain. No `--force`, suppression or audit
  bypass was used.

The residual entries form two tooling-only chains:

1. PWA compilation: `vite-plugin-pwa > workbox-build` reaches
   `@rollup/plugin-node-resolve`, `deepmerge`,
   `@trickfilm400/rollup-plugin-off-main-thread`, `ejs`, `jake`, `filelist`,
   `glob` and `minimatch` (2 low, 8 moderate package entries).
2. Linting: `eslint` / `typescript-eslint` reaches
   `@eslint-community/eslint-utils`, `@eslint/config-array`, `@eslint/js`,
   the five `@typescript-eslint/*` packages, `eslint-plugin-react-refresh`
   and `minimatch` (12 moderate entries; `minimatch` is shared with the first
   chain, so the full report totals 21 unique entries).

These packages never ship in the static bundle or backend. They process
repository-controlled source, glob patterns and PWA configuration in local/CI
builds. The registry's proposed fix is `npm audit fix --force`, which would
downgrade `vite-plugin-pwa` or `typescript-eslint` outside the current supported
tree and still cannot patch `deepmerge` (no fixed release is published). The
mitigation is a locked install, trusted repository inputs, a blocking
high-severity full-graph audit, and continued upgrade review. Owner review is
required to accept this low/moderate tooling-only residual risk.

## Python audit

`pip-audit 2.10.1 --strict --no-deps -r requirements.txt` initially reported
24 vulnerability records across two production packages:

| Package | Previous | Patched | Result |
| --- | --- | --- | --- |
| `certifi` | `2026.7.22` | `2026.10.18` | Clean |
| `PyJWT` | `2.10.1` | `2.15.1` | Clean |

The exact pinned requirements now report **no known vulnerabilities** on
Python 3.12.14. CI installs the pinned auditor and runs it with `--strict`, so
an audit failure or scanner error fails the job rather than silently passing.

## Targeted security findings

- Production rate-limit identities use Render edge-overwritten
  `CF-Connecting-IP`, validate it as an IP address, and fail closed to one
  shared identity if the header is absent or invalid. Client-controlled
  `X-Forwarded-For` is not used for security decisions. This protects both the
  auth limiter and Game Night limiter while retaining forwarded scheme support.
- The PostgreSQL-backed auth limiter remains shared across API processes. CI
  creates a separate launch-hardening database and runs the
  security/concurrency module explicitly with
  `LAUNCH_HARDENING_DATABASE_URL`, preventing skips without allowing that
  module's teardown to drop the full suite's migrated schema.
- Repeated PostgreSQL validation exposed and fixed a race in initial global
  lease-slot creation: concurrent workers can no longer autoflush duplicate
  fixed slots before the existing commit-time conflict recovery executes.
- `PUBLIC_REGISTRATION_ENABLED` is explicitly `false` in `render.yaml` and
  defaults to false in production configuration.
- Focused auth, revocation, account-deletion, proxy identity and configuration
  tests passed after the dependency updates.

Render documents that public traffic reaches web services through its load
balancer and that Cloudflare overwrites `CF-Connecting-IP` with the original
visitor IP:

- <https://render.com/docs/web-services>
- <https://render.com/articles/host-pocketbase-on-render>
- <https://render.com/articles/fastapi-production-best-practices>

## Local validation

- Python 3.12.14 / PostgreSQL 16: clean migration to head; `alembic check`
  reported no new operations; full backend suite **327 passed, 11 skipped**.
  The six PostgreSQL hardening tests then passed five consecutive times
  (**30/30**) against a separate disposable database.
- Node 22.23.3: frontend **93/93** tests passed; ESLint, TypeScript/Vite 8.2.4
  production build, PWA asset/precache validation and both npm audit gates
  passed.
- Strict Python audit: no known vulnerabilities. Runtime npm graph: zero
  vulnerabilities. Full npm graph: zero high/critical, with the documented
  2 low / 19 moderate tooling-only residual entries.
- Playwright exercised the production bundle's login/registration route,
  generic verification response and resend action with a mocked local API;
  no browser console warnings or errors were emitted. This is not physical
  device, live-email or deployed-host evidence.
- `git diff --check` passed. One fresh post-patch review found the shared-CI-
  database teardown defect; the isolated CI database fix above resolved it,
  and the reviewer reported no other findings in SP-LAUNCH-02A scope.

## Candidate file manifest

This is the exact SP-LAUNCH-02 plus SP-LAUNCH-02A candidate relative to the
base commit. The commit itself is the immutable final manifest.

```text
.github/workflows/ci.yml
README.md
backend/.env.example
backend/api/client_address.py
backend/api/current_user.py
backend/api/routers/auth.py
backend/api/routers/collection.py
backend/api/routers/game_night.py
backend/api/routers/imports.py
backend/auth/login_rate_limiter.py
backend/auth/one_time_tokens.py
backend/auth/schemas.py
backend/auth/security.py
backend/bgg/client.py
backend/bgg/collection_parser.py
backend/bgstats/play_parser.py
backend/config.py
backend/database/models.py
backend/migrations/versions/8d2e4f6a7b90_add_public_launch_security_state.py
backend/repositories/game_repository.py
backend/repositories/play_write_repository.py
backend/requirements.txt
backend/services/account_service.py
backend/services/bgstats_play_import_service.py
backend/services/collection_service.py
backend/services/workload_limits.py
backend/start.sh
backend/tests/conftest.py
backend/tests/test_auth.py
backend/tests/test_bgg.py
backend/tests/test_bgstats_play_import_service.py
backend/tests/test_bgstats_play_parser.py
backend/tests/test_client_address.py
backend/tests/test_collection_service.py
backend/tests/test_config.py
backend/tests/test_launch_hardening_postgres.py
backend/tests/test_profile_onboarding.py
backend/tests/test_wishlist.py
backend/tests/test_workload_limits.py
docs/bgg-attribution-and-permission.md
docs/data-retention-and-requests.md
docs/privacy-notice-draft.md
docs/production-runbook.md
docs/sp-launch-02-launch-checklist.md
docs/sp-launch-02a-dependency-security.md
docs/terms-draft.md
frontend/package-lock.json
frontend/package.json
frontend/public/branding/powered-by-bgg-rgb.svg
frontend/src/App.tsx
frontend/src/api/client.ts
frontend/src/beta-access.test.mjs
frontend/src/components/AuthView.tsx
frontend/src/components/SettingsSectionView.tsx
frontend/src/components/SettingsView.tsx
frontend/src/components/VerifyEmailView.tsx
frontend/src/settings-navigation.test.mjs
frontend/src/styles/settings.css
frontend/src/styles/tokens.css
render.yaml
```

## Eventual remote-SHA verification

After a separately authorised push, require GitHub Actions on the exact commit
to complete clean PostgreSQL migration, `alembic check`, PostgreSQL hardening
tests, full backend tests, strict Python audit, full frontend audit at the high
gate, frontend tests/lint/build and PWA validation. Compare the workflow SHA to
the reviewed local commit before any separately approved deployment. A green
workflow does not authorise registration, provisioning or deployment.
