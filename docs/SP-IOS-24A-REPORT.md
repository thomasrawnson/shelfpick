# SP-IOS-24A — Onboarding Account Controls

Date: 2026-11-14 (Europe/London)

## Status

PASS WITH RISKS. Incomplete-onboarding users can now reach Account options, log out through the existing credential-clearing path, or use the existing password-confirmed deletion form. Normal application routes remain blocked until onboarding completes. No production account, deployment, database, Git remote or Apple state was changed.

## Implementation

- Added `/onboarding/account` as the only additional route allowed by the incomplete-onboarding guard.
- Added a mobile-first Account options entry to every onboarding step.
- Reused `AccountDeletion`, `deleteAccountAndClearSession`, `handleLogout` and `finishLogout`; no API or database change was introduced.
- Preserved onboarding form state while Account options is open and restores keyboard focus to its entry on return.
- Deletion failures retain the local session; success and logout return to `/login`.

## Validation

- Frontend: 115 passed, 0 failed; ESLint passed; TypeScript/production build passed.
- PWA and legal-draft gates: passed. Colour scan retained the 10 pre-existing review notices and introduced none.
- PostgreSQL 16: clean migration to `f3a8c2d4e6b1`; `alembic check` reported no drift; 377 passed, 0 skipped. Four disposable test databases and their container were removed.
- Synthetic mobile browser at 390×844: logout, incorrect password, API failure, cancellation, successful deletion, protected-route blocking, Step 2 state retention, focus restoration, 44px controls, no horizontal overflow and no console errors passed.
- Capacitor sync and a non-signing Release device compile passed. Temporary company staging verified `com.plutonightlabs.shelfpick`, version/build `1.0 (4)`, iPhone-only, production API, public legal URLs and two dependency privacy manifests.

The test runner emitted non-fatal warnings because another process already owned Vite HMR port 24678. The process was not interrupted.

## Files and release state

- Worktree: `/private/tmp/shelfpick-sp-ios-24a`
- Branch: `codex/sp-ios-24a`
- Base/current Git SHA: `bea871438e3b6ecc2cb26b014ca422887080cf53`
- Eight frontend source/test paths changed; this report is additional evidence.
- No commit, signed archive, IPA, upload or TestFlight build was created.

## Remaining risk and next action

Physical iPhone VoiceOver, Dynamic Type, keyboard/safe-area and destructive-account testing are unverified for this candidate. Owner should review the uncommitted diff, then separately authorise commit/PR and build-4 signing before device acceptance.
