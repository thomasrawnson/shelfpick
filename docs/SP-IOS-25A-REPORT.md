# SP-IOS-25A — ShelfPick 1.0 (4) Distribution Build

Date: 14 November 2026 (Europe/London)

## Status

PASS WITH RISKS. One Apple Distribution-signed App Store IPA and its archive were produced from the exact approved merge commit. Nothing was uploaded to Apple, assigned to testers, deployed, committed, pushed or merged.

## Source and environment

- Source SHA: `7aa5a81be53405affdd3b51d65ed3a8aa28d7b4e`
- Isolated detached worktree: `/private/tmp/shelfpick-sp-ios-25a`
- Approved delta from build 3: exactly the eight frontend files from PR #14; no backend, migration, Render or native-project source file changed.
- Node: 22.23.3; Python: 3.12.14; Xcode: 27.2 (27B52).
- App Store Connect showed builds 1, 2 and 3 only; build 4 was unused before packaging.
- Privacy and Terms URLs returned HTTP 200 and contained the approved company identity and number.

## Build and signing

- Bundle ID: `com.plutonightlabs.shelfpick`
- Team: `9CDNVY8UKQ`
- Version/build: `1.0 (4)`
- Architecture/device/target: arm64, iPhone-only, portrait, iOS 15.0 minimum.
- Existing Apple Distribution identity reused: SHA-1 `[distribution certificate SHA-1 redacted]`, expiring 12 November 2027.
- Existing Xcode-managed App Store profile reused: `iOS Team Store Provisioning Profile: com.plutonightlabs.shelfpick`, UUID `[profile UUID redacted]`, expiring 12 November 2027.
- Archive used automatic signing; export reused the pinned distribution identity and completed without `-allowProvisioningUpdates`. No signing asset was created or changed.
- `codesign --verify --deep --strict` passed when given the existing login keychain explicitly. `security verify-cert` independently validated the embedded leaf, WWDR G3 intermediate and Apple Root chain. A sandboxed trust lookup initially returned `CSSMERR_TP_NOT_TRUSTED`; the identical check against the accepted build-3 control passed, and the explicit keychain/chain checks resolved this as keychain search visibility rather than an artifact defect.
- Final entitlements: `application-identifier=9CDNVY8UKQ.com.plutonightlabs.shelfpick`, `beta-reports-active=true`, `get-task-allow=false`.

## Packaged release configuration

- Production API occurs once: `https://board-game-picker-api.onrender.com`.
- Privacy and Terms URLs each occur once; the legal-draft marker is absent.
- The packaged bundle contains Account options, Delete account, logout and the 13+ registration confirmation/unavailable-phone-voting copy.
- Full tests retain Free-only presentation, no Pro purchase action, disabled phone voting and fail-closed cover-bearing exports. Checked-in Render safeguards remain `GAME_NIGHT_PHONE_VOTING_ENABLED=false` and `EXPORT_COVER_ARTWORK_ENABLED=false`; no production configuration was changed.
- Capacitor and Cordova privacy manifests are packaged and declare no tracking, tracking domains, collected-data types or required-reason APIs.
- App icon assets and the compiled launch screen are present.

## Tests and evidence

- Frontend: 115 passed, 0 failed. Non-fatal Vite HMR socket warnings occurred because sandbox networking denied port 24678; assertions completed successfully.
- Focused onboarding, account-control, routing and public-legal checks: 24 passed, 0 failed.
- ESLint: passed.
- Production frontend build with public legal links enabled and legal drafts disabled: passed.
- PWA validation: passed.
- Capacitor iOS build and sync: passed.
- App Store archive/export: passed.
- IPA identifiers, signature, chain, profile, entitlements, privacy manifests, assets and packaged configuration: passed.
- Production dependency audit: 0 vulnerabilities. Full install audit reported 2 low and 12 moderate development/build dependency advisories; no dependency change was authorised.
- Hosted exact-SHA CI run `43539046747`: frontend and PostgreSQL backend/migration jobs passed. Backend was not rerun locally because PR #14 contains no backend changes.
- Physical-device installation, VoiceOver/Dynamic Type acceptance, Apple processing and TestFlight installation were not performed.

## Artifacts

- Archive: `/private/tmp/shelfpick-sp-ios-25a/ShelfPick-1.0-4.xcarchive`
- IPA: `/private/tmp/shelfpick-sp-ios-25a/AppStoreExport/App.ipa`
- IPA SHA-256: `af72e3e68d93c6a85b56c810b074a5771a1f3508bb9d58b87b352f5adab79ee8`
- Distribution summary: `/private/tmp/shelfpick-sp-ios-25a/AppStoreExport/DistributionSummary.plist`
- Export logs: `/private/tmp/shelfpick-sp-ios-25a/AppStoreExport.xcdistributionlogs`
- Decoded profile: `/private/tmp/shelfpick-sp-ios-25a/embedded-profile.plist`

## Remaining risk and next action

The binary has not been uploaded, processed by Apple or installed from TestFlight. Obtain separate owner authorization pinned to the exact IPA path and checksum before uploading build 4 for internal testing.
