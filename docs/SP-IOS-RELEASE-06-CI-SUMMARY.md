# SP-IOS-RELEASE-06 — CI candidate summary

This branch adds the reviewed V1 presentation and regression changes to draft PR #10's release source. It makes no database migration, entitlement change, Picker algorithm change, or dependency addition.

- Discover shows Hot and For You while omitting the unavailable Top 100 entry and V1 comparison claim. Its underlying implementation remains.
- The server-side phone-voting gate from PR #10 defaults off; Free host-led Game Night and credential-scoped guest correction/removal remain. Registration still requires the 13+ declaration.
- Settings gains a support email link. Public Privacy/Terms links require an explicit build flag and remain off by default; unpublished legal drafts are excluded from the build.
- Password-reset tests cover the generated link, account states, replacement, expiry, single use, and old-session revocation. The reset-email failure log no longer records an account ID. Temporary reset-issuance diagnostics are excluded.

Local verification on a fresh disposable SQLite database: backend **362 passed, 13 skipped** when excluding the PostgreSQL-only compiler module. Frontend **107 passed**, ESLint, TypeScript/web build, PWA check, iOS web build and Capacitor sync, unsigned simulator build, and `git diff --check` passed. PostgreSQL migration, concurrency and full-suite behavior must be established by GitHub Actions on this exact commit; earlier PR #10 CI does not cover these additions. No production or physical-device verification is claimed.
