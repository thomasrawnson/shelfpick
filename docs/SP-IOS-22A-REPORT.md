# SP-IOS-22A — ShelfPick 1.0 Build 3

Date: 2026-11-13 (Europe/London)

## Status

PASS WITH RISKS. A distribution-signed App Store IPA and archive were produced from the approved immutable source. No upload, tester change, App Review submission, production operation, database operation, commit, push or merge was performed.

## Source and Apple record

- Source SHA: `bea871438e3b6ecc2cb26b014ca422887080cf53`
- Isolated detached worktree: `/private/tmp/shelfpick-sp-ios-22a`
- Bundle ID: `com.plutonightlabs.shelfpick`
- Team: `9CDNVY8UKQ`
- Version/build: `1.0 (3)`
- App Store Connect: the iOS Builds page showed only builds 1 and 2; build 3 was unused before export.
- Both public legal URLs returned HTTP 200 without authentication and contained the approved company identity, registered office and contact details.

## Build and signing

- Xcode: 27.2 (27B52)
- Company staging was prepared outside the checked-in prototype project.
- Existing Apple Distribution identity reused: SHA-1 `[distribution certificate SHA-1 redacted]`.
- Existing Xcode-managed App Store profile reused: UUID `[profile UUID redacted]`, expiry 2027-11-12.
- Export completed without `-allowProvisioningUpdates`; no certificate or profile was created or modified.
- Independent macOS trust validation: `codesign --verify --deep --strict` passed.
- Final entitlements: `application-identifier=9CDNVY8UKQ.com.plutonightlabs.shelfpick`, `beta-reports-active=true`, `get-task-allow=false`.

## Packaged configuration

- Production API: `https://board-game-picker-api.onrender.com`
- Privacy: `https://plutonightlabs.com/shelfpick/privacy/`
- Terms: `https://plutonightlabs.com/shelfpick/terms/`
- Each approved URL occurs once in the compiled entry bundle; the legal-draft marker is absent.
- iPhone-only, portrait, arm64, minimum iOS 15.0.
- Capacitor and Cordova privacy manifests are present; each declares no tracking, tracking domains, collected data or required-reason APIs.
- App icon and launch assets are present.
- Source safeguards remain unchanged: 13+ registration confirmation; no Pro purchase action; phone voting disabled in frontend and Render configuration; cover-bearing export disabled in Render configuration.

## Tests

- Frontend: 113 passed, 0 failed. Non-fatal Vite port 24678 warnings occurred while concurrent test servers ran.
- Focused public-legal/Free-plan checks: 8 passed, 0 failed.
- ESLint: passed.
- Production frontend build: passed with public legal links enabled and legal drafts disabled.
- Capacitor iOS build and sync: passed.
- PWA validation: passed.
- App Store archive and export: passed.
- IPA signature, profile, entitlements, identifiers, privacy manifests, assets and packaged origins: passed.
- Backend/PostgreSQL: prior 377-test release evidence reused because the source SHA is unchanged; not rerun.
- Physical iPhone, TestFlight processing and installation: not performed.

## Artifacts

- Archive: `/private/tmp/shelfpick-sp-ios-22a/ShelfPick-1.0-3.xcarchive`
- IPA: `/private/tmp/shelfpick-sp-ios-22a/AppStoreExport/App.ipa`
- IPA SHA-256: `2fe6d1917efdb5309b99040e9c671ebd713e106f8ba86d56a93b824a7c20b600`
- Distribution summary: `/private/tmp/shelfpick-sp-ios-22a/AppStoreExport/DistributionSummary.plist`
- Export logs: `/private/tmp/shelfpick-sp-ios-22a/AppStoreExport.xcdistributionlogs`

## Risks and next action

The artifact has not been uploaded or processed by Apple and has not been installed from TestFlight. Owner review should pin the exact IPA path and checksum before separately authorising a build-3 upload.
