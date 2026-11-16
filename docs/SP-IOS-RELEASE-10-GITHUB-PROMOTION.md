# SP-IOS-RELEASE-10 — GitHub promotion evidence

Date: 8 November 2026. Local evidence only; this document is uncommitted.

## Identity and scope

- GitHub main at reconstruction and push: `83ccffd7bea86184712b7645a87f66bb76a5acc5`.
- Integrated source: `7e55a31fee6ae412627eedeee65bbeeb872959bc` on `codex/sp-ios-release-06-v1`, verified equal to its GitHub branch before reconstruction.
- Isolated worktree: `~/Developer/shelfpick-sp-ios-release-10`; branch `codex/sp-ios-release-10-v1`; sole new commit `fec46b74e2b5735818bdab1a22d244bc486b8ed0`.
- Draft PR: https://github.com/thomasrawnson/shelfpick/pull/11 (main base, one commit, 41 changed files). Existing PR #10 remained open, draft, unmerged and was not edited.
- All 41 committed file blobs are byte-identical to the integrated source. No database migration or entitlement change appears in the diff. The selected source patch was applied to current main, not cherry-picked, so the four excluded files never entered this branch's new commit history.
- The primary checkout and integrated source worktree were not cleaned, reset, rebased or edited.

## Exact committed manifest (41 paths)

- `.github/workflows/ci.yml`
- `backend/.env.example`
- `backend/api/routers/auth.py`
- `backend/api/routers/game_night.py`
- `backend/auth/schemas.py`
- `backend/config.py`
- `backend/repositories/game_night_voting_repository.py`
- `backend/services/game_night_voting_service.py`
- `backend/tests/test_auth.py`
- `backend/tests/test_config.py`
- `backend/tests/test_game_night_api.py`
- `backend/tests/test_game_night_voting_api.py`
- `docs/SP-IOS-08-APP-STORE-ASSETS.md`
- `docs/SP-IOS-09-REVIEW-EXPERIENCE.md`
- `docs/SP-IOS-09A-REVIEWER-ACCESS-SCREENSHOTS.md`
- `docs/SP-IOS-14E-B-V1-AVAILABILITY-GATE.md`
- `docs/SP-IOS-RELEASE-06-CI-SUMMARY.md`
- `frontend/package.json`
- `frontend/src/api/client.ts`
- `frontend/src/beta-access.test.mjs`
- `frontend/src/components/AuthView.tsx`
- `frontend/src/components/DiscoverView.tsx`
- `frontend/src/components/GameNightGuestVotingView.tsx`
- `frontend/src/components/GameNightView.tsx`
- `frontend/src/components/ProComparisonView.tsx`
- `frontend/src/components/ResetPasswordView.tsx`
- `frontend/src/components/SettingsSectionView.tsx`
- `frontend/src/discover-state.test.mjs`
- `frontend/src/discover-state.ts`
- `frontend/src/game-night-availability.ts`
- `frontend/src/game-night-voting.test.mjs`
- `frontend/src/pro-comparison.test.mjs`
- `frontend/src/public-legal-links.test.mjs`
- `frontend/src/public-legal-links.ts`
- `frontend/src/reset-link.test.ts`
- `frontend/src/reset-link.ts`
- `frontend/src/settings-navigation.test.mjs`
- `frontend/src/styles/auth.css`
- `frontend/src/styles/game-night.css`
- `frontend/src/styles/native-dynamic-type.css`
- `frontend/vite.config.ts`

## Explicit exclusions

- `docs/SP-IOS-14E-DPIA-CANDIDATE.md` — absent from HEAD and the new commit history.
- `docs/SP-IOS-14E-LAWFUL-BASIS-DECISION.md` — absent from HEAD and the new commit history.
- `docs/SP-IOS-14E-RECOVERY-AND-VERIFICATION.md` — absent from HEAD and the new commit history.
- `docs/SP-IOS-14E-V-ACCEPTANCE-PACKAGE.md` — absent from HEAD and the new commit history.

The source worktree's uncommitted legal, retention and privacy drafts, private evidence, screenshots, database exports, credentials, and generated build artifacts were not transferred. Existing files already on main were not rewritten by this promotion.

## Validation

- Local disposable SQLite backend: 362 passed, 13 skipped. An initial rerun against a reused disposable database had one fixture collision; a fresh initialized database passed. PostgreSQL-specific coverage is CI evidence only.
- Local frontend on Node 22: 109 passed; ESLint, TypeScript/production build, legal-draft guard and PWA asset check passed. `git diff --check` passed.
- First local frontend attempt used incomplete dependencies from the primary checkout; rerun against the installed integrated-candidate dependencies passed. This did not alter tracked files.
- Fresh exact-SHA GitHub Actions CI: https://github.com/thomasrawnson/shelfpick/actions/runs/42535757346 — completed successfully. Backend and migrations job passed Python 3.12.14 setup, Python dependency audit, clean PostgreSQL migration, model/schema alignment, full backend suite without PostgreSQL skips, and PostgreSQL launch-hardening, timer-integrity and retention tests. Frontend job passed dependency audit, tests, ESLint, production build, PWA and legal-draft guards.
- The CI workflow specifies PostgreSQL 16 and Ubuntu 24.04; the exact run's successful jobs provide remote verification. No local PostgreSQL instance was used.

## Remaining release gates

Draft PR remains for owner code review and an explicit merge decision. Public legal pages and links require approved publication; reviewer access and physical iPhone acceptance remain separate. This promotion did not deploy to Render, change production data, alter Apple resources, install an app, or distribute a build.
