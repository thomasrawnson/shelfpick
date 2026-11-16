# SP-IOS-19E — Vercel Safeguard and TestFlight Build 2

**Status:** PASS WITH RISKS

**Source:** `bea871438e3b6ecc2cb26b014ca422887080cf53`

## Phase A — Vercel investigation

The merge created Vercel deployment `dpl_8aYwgL5TwGRWsrsoGhsieWhK9ebE` for
project `board-game-picker-commercial` (`prj_P5mbtwJ8No3RgP49lIgqB3rE9m7x`).
The deployment source is the exact approved merge SHA and its environment is
labelled Production. Its staged domains are:

- `board-game-picker-commercial-git-main-game-night-labs.vercel.app`
- `board-game-picker-commercial-pn9nrn9u3-game-night-labs.vercel.app`

The project primary domain is `board-game-picker-commercial.vercel.app`.
Unauthenticated HTTPS requests to both the exact deployment URL and primary
domain return HTTP 302 to Vercel authentication. The dashboard confirms Vercel
Authentication applies to all deployments and shows no active shareable links.
Custom production-domain assignment was skipped, so this merge did not promote
the staged deployment onto the primary production domain.

The cause is the connected Git repository plus Production environment Branch
Tracking: every push to `main` creates a Production-environment deployment.
Auto-Assign Custom Production Domains is off, which limited the impact but did
not prevent building the staged deployment.

The approved Render frontend remains publicly available and the Render API
health endpoint reports `{"status":"ok","database":"ok"}`. The authenticated
Render dashboard still records `6eaae6cfa083799fb9fb56c8cf08e6775b429a94`
as the last successful web/API deployment. Vercel is therefore a separate,
protected staging surface rather than the approved public frontend.

### Recommended safeguard

In a separately approved Git change, add a minimal `vercel.json` setting
`git.deploymentEnabled.main` to `false`. Current Vercel documentation states
that branch-specific deployment disabling leaves unspecified branches enabled,
so PR Preview deployments can remain available while `main` stops triggering
Vercel. If Vercel is no longer required at all, disconnecting the repository is
stronger but broader. No setting, deployment or domain was changed here.

## Phase B — build 2 result

App Store Connect showed version 1.0 build 1 only; build number 2 was unused.
The production iOS build and Capacitor sync passed using
`https://board-game-picker-api.onrender.com`. A clean staged company project
used team `9CDNVY8UKQ`, bundle `com.plutonightlabs.shelfpick`, version `1.0`,
build `2`, iPhone-only device family, portrait orientation and iOS 15 minimum.

Xcode 27.2 created the archive successfully. Its metadata and embedded app
confirm the requested bundle, team, version/build, arm64 device platform,
company app icon/launch source and production API. The packaged JavaScript
contains the Game Night participant prefill and the new `PLAY(S) THIS MONTH`
recap fallback. Phone voting remains compile-time disabled; repository
production flags retain cover export, public registration, legal publication
and phone voting as disabled. Capacitor and Cordova privacy manifests are
packaged and declare no tracking/collection/accessed API categories. The
development archive contains only its application/team identifiers and the
expected development `get-task-allow=true`; a distribution entitlement set
could not be produced because export stopped.

The archive is development-signed, as expected before export. App Store export
then stopped without producing an IPA:

> Provisioning profile "iOS Team Store Provisioning Profile:
> com.plutonightlabs.shelfpick" doesn't include signing certificate "Apple
> Distribution: Pluto Night Labs Ltd (9CDNVY8UKQ)".

The local Apple Distribution identity exists. The App Store profile is valid
through 12 November 2027 but references a different Pluto Night Labs
distribution certificate than the locally available identity. Resolving that
requires allowing Xcode provisioning updates/cloud-managed signing or changing
the App Store profile, which is an Apple account change outside this task. No
certificate/profile was created, replaced, revoked or updated.

## Validation

- Frontend: 113 tests passed; ESLint, production build and PWA validation
  passed. `npm run build:ios` and Capacitor sync passed.
- Archive metadata, packaged API, company assets, privacy manifests and feature
  flags: passed.
- App Store Connect build-number availability: build 2 unused.
- Local backend run: blocked by the clean worktree's deliberately absent
  `DATABASE_URL` (44 collection errors); no local/production database was
  created or modified. Exact-SHA hosted GitHub CI had already passed the full
  PostgreSQL backend/migration job and frontend job.
- Distribution signature/IPA checksum: not available because export failed.
- Physical device and TestFlight: not run.

## Files and checksums

- Archive: `/private/tmp/shelfpick-sp-ios-19e/ShelfPick-1.0-2.xcarchive`
- Archive file-manifest SHA-256:
  `9a93a22fa7ff1c0256dd1b9d350ea876258dfb7f6a4e6b9d44e16a17d27baa2d`
- App executable SHA-256:
  `6a1b9c547a8d62359f8cbbd95b6be5dffa6deea9a3f8e585a78ec836c40d2c9c`
- Manifest: `/private/tmp/shelfpick-sp-ios-19e/archive-files.sha256`
- Export options: `/private/tmp/shelfpick-sp-ios-19e/ExportOptions-AppStore.plist`
- Export failure evidence:
  `/private/tmp/shelfpick-sp-ios-19e/AppStoreExportFailure.xcdistributionlogs`
- IPA: not produced.

The SP-IOS-18E build-1 temporary worktree, report and artifacts were already
absent when this task began; this task did not remove or modify them.

## Recommended next action

Separately authorise Xcode automatic/cloud-managed provisioning updates for
ShelfPick build 2 only, with an explicit stop if Apple requires certificate
creation, replacement or revocation; then rerun export without rebuilding.
