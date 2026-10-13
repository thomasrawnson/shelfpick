# SP-BETA-08 — Safe artwork exports

**Date:** 12 October 2026

**Status:** Complete locally; uncommitted and not deployed

**Branch:** `feature/sp-beta-08-safe-artwork-exports`
**Base:** `c4811cf69a7bff63b94fdea608b73783ddf5efd4`

## Export restriction

The backend owns `EXPORT_COVER_ARTWORK_ENABLED`. It defaults to `false`, is
declared false in `backend/.env.example` and `render.yaml`, and rejects invalid
values at startup. `GET /export-config` exposes only the resulting boolean.

The saved-play and monthly-recap dialogs resolve this policy before invoking
their existing canvas renderer. Only the exact boolean `true` enables cover
loading. A missing endpoint, failed request or malformed response becomes
fallback-only. There is no user-facing control, URL switch or persisted browser
preference. Both preview and the download/native-share actions use the same
blob, so their artwork cannot diverge within the application flow.

The renderer default itself is fallback-only, providing a second fail-closed
boundary for direct internal calls. Ordinary in-app cover images are not
filtered or rewritten. The existing privacy defaults, email redaction, factual
play/recap content, Free entitlement and BoardGameGeek data attribution remain.

## Validation

- Backend policy/config/API focus: 7 passed, 32 deselected.
- Full backend suite with PostgreSQL 16: 303 passed, 5 skipped. The five skips
  are the existing timer-integrity tests gated by their opt-in environment.
- Alembic check: no new upgrade operations.
- Full frontend suite: 92 passed, 0 failed/skipped.
- ESLint, TypeScript production build, PWA validation and `git diff --check`:
  passed.
- Google Chrome Playwright: saved-play and recap flows each passed 390x844
  mobile and 1440x900 desktop in light and dark. Checks covered visible focus,
  modal containment, horizontal overflow, action/navigation clearance,
  1200x1500 dimensions, matching preview/download bytes and zero additional
  cover requests during fallback export.
- Visual inspection: `play-card-fallback.png` and
  `monthly-recap-fallback.png` retain the established layout, branded initials,
  readable long-title handling, factual data, logo and BGG attribution.

The initial non-escalated full backend run reported 23 failures because the
filesystem/network sandbox denied connections to the running PostgreSQL service
on localhost:5433. Re-running the identical suite with authorised local database
access passed; this was an execution-environment failure, not an application
failure. Frontend tests emitted benign Vite HMR port warnings but passed.

## Remaining licensing and release limits

The implementation does not establish that BoardGameGeek cover redistribution
is permitted. Keep the production value false until written permission covers
the intended commercial PNG/native-share use and attribution. If permission is
later approved, enabling covers is a reviewed server configuration promotion,
not a frontend entitlement or user choice.

No physical iOS/Android share sheet, production deployment or live hosted
configuration was tested. Those operational/device gates remain separate from
this completed application slice.
