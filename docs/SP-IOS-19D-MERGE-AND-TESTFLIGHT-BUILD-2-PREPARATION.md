# SP-IOS-19D — Merge and TestFlight Build 2 Preparation

**Status:** PASS WITH RISKS

**PR:** <https://github.com/thomasrawnson/shelfpick/pull/13>

**Approved head:** `3f202d319ab73d38f288d656fa284d536aebc503`

**Resulting main:** `bea871438e3b6ecc2cb26b014ca422887080cf53`

## Merge safeguards and result

Immediately before merge, PR #13 was open, cleanly mergeable and still at the
approved head. Its delta from `origin/main` was exactly the seven approved
frontend source/test files recorded in SP-IOS-19C. All six required PR checks
were successful. `origin/main` was still the previously verified
`6eaae6cfa083799fb9fb56c8cf08e6775b429a94`; no intervening commit was present.

The PR was marked ready and merged with the repository's established merge-
commit method and a head-SHA guard. The resulting commit has exactly two
parents: the verified base and approved PR head. No local owner changes or
untracked task evidence were included.

## Post-merge evidence

- GitHub Actions run <https://github.com/thomasrawnson/shelfpick/actions/runs/43392653356>
  completed successfully for the exact resulting `main` SHA. Both `Backend
  tests and migrations` and `Frontend tests, lint and build` passed, including
  clean PostgreSQL migration/alignment, no-skip backend suites, dependency
  audits, frontend tests, ESLint, production build and PWA validation.
- Render API and web dashboards both still identify
  `6eaae6cfa083799fb9fb56c8cf08e6775b429a94` as their last successfully
  deployed commit. No Render deployment was requested or triggered. The
  Blueprint continues to declare `autoDeployTrigger: "off"` for both services.
- The repository's Vercel integration automatically created a successful
  GitHub deployment record labelled `Production` for the merge SHA at
  `board-game-picker-commercial-pn9nrn9u3-game-night-labs.vercel.app`. This was
  an automatic consequence of merging frontend paths, not a manually requested
  deployment. No rollback or Vercel configuration change was made.
- Railway reported `No deployment needed - watched paths not modified`.

## TestFlight build 2 requirements

Use a new isolated worktree pinned to the immutable merge SHA. Run the existing
production iOS build and Capacitor sync with
`VITE_API_BASE_URL=https://board-game-picker-api.onrender.com`, then stage the
company project without modifying the checked-in prototype project. The archive
must use:

- Apple team `9CDNVY8UKQ` and automatic signing with the existing Apple
  Distribution identity/profile;
- bundle ID `com.plutonightlabs.shelfpick`;
- App Store Connect app ID `6833957995`;
- marketing version `1.0`, build number `2`;
- iPhone-only device family and minimum iOS 15;
- the approved company icon, launch assets, privacy manifests and entitlements.

Before any archive, confirm build 2 is unused in App Store Connect. Build and
export only; upload remains separately authorised. Validate the final IPA's
signature/team, bundle/version/build, entitlements, privacy manifests, packaged
production API origin and Free-only behaviour. The release remains Free-only:
phone voting and cover export are disabled, public legal links/drafts are
disabled, and the existing registration enforcement is unchanged.

## Risks and remaining gates

- The checked-in Xcode project intentionally remains the prototype identity
  `com.shelfpick.prototype`, version/build `1.0 (1)`, with no default team and
  iPhone+iPad device family. Build 2 must use the controlled staged company
  configuration and set `CURRENT_PROJECT_VERSION=2`; archiving the repository
  project directly would be incorrect.
- Render production remains on the prior release SHA. The merged fixes are
  frontend-only and can be packaged into iOS build 2, but the unexpected Vercel
  production deployment must be acknowledged by the owner.
- App Store Connect build-number availability, signing access, archive/export,
  Apple processing, export compliance and physical TestFlight acceptance are
  not established by this task.

## Recommended next action

Owner reviews the automatic Vercel deployment implication, then separately
authorises a build-only SP-IOS-19E run from the immutable merge SHA (no upload).
