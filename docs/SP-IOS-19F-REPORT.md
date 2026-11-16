# SP-IOS-19F — App Store Provisioning Repair

**Status:** PASS

**Source:** `bea871438e3b6ecc2cb26b014ca422887080cf53`

## Completed

The existing archive was reverified before export. Its archive file-manifest
SHA-256 remained
`9a93a22fa7ff1c0256dd1b9d350ea876258dfb7f6a4e6b9d44e16a17d27baa2d`
before and after export, proving that the archive was not rebuilt or modified.
It identifies team `9CDNVY8UKQ`, bundle `com.plutonightlabs.shelfpick` and
version/build `1.0 (2)`.

Before provisioning repair, the valid local Apple Distribution identity was
`[distribution certificate SHA-1 redacted]`. The existing ShelfPick App Store
profile referenced a different distribution certificate. Xcode export was
therefore constrained to the existing identity fingerprint and authorised to
update provisioning.

Xcode replaced only the ShelfPick App Store profile:

- old UUID: `[profile UUID redacted]`;
- new UUID: `[profile UUID redacted]`;
- name: `iOS Team Store Provisioning Profile:
  com.plutonightlabs.shelfpick`;
- application identifier: `9CDNVY8UKQ.com.plutonightlabs.shelfpick`;
- embedded certificate SHA-1:
  `[distribution certificate SHA-1 redacted]`;
- expiry: 12 November 2027.

The signing-identity inventory remained exactly three valid identities before
and after export, including the same single Pluto Night Labs distribution
identity. The six non-App-Store-profile UUIDs remained unchanged. No
certificate was created, revoked, replaced or invalidated, and no unrelated
application profile changed.

## Export and independent verification

Xcode 27.2 exported the existing archive successfully without uploading it.
Independent extraction and inspection found:

- Apple Distribution signature chains through Apple Worldwide Developer
  Relations Certification Authority to Apple Root CA;
- `codesign --verify --deep --strict` passed;
- team `9CDNVY8UKQ`, bundle `com.plutonightlabs.shelfpick`, arm64, iPhone-only,
  minimum iOS 15, portrait, version/build `1.0 (2)`;
- distribution entitlements contain the exact application/team identifiers,
  `beta-reports-active=true` and `get-task-allow=false`;
- the embedded App Store profile and certificate match the pinned local
  distribution identity;
- Capacitor and Cordova privacy manifests are packaged and declare no tracking,
  collected data or required-reason API categories;
- the packaged JavaScript contains the approved Render production API origin
  and monthly-recap fallback, while legal-draft and phone-voting UI strings are
  absent;
- source and repository settings retain phone voting, cover export, public
  registration and public legal links as disabled.

App Store Connect still showed version 1.0 build 1 only. Build 2 remains unused.
No upload, tester change, submission, production change or Git operation was
performed.

## Files

- Archive: `/private/tmp/shelfpick-sp-ios-19e/ShelfPick-1.0-2.xcarchive`
- IPA: `/private/tmp/shelfpick-sp-ios-19e/AppStoreExport/App.ipa`
- IPA SHA-256:
  `eb88d07b0275cea762e777fce48d283692dacf21eb6098480f2d059e513dd9db`
- Xcode distribution summary:
  `/private/tmp/shelfpick-sp-ios-19e/AppStoreExport/DistributionSummary.plist`
- Successful export evidence:
  `/private/tmp/shelfpick-sp-ios-19e/AppStoreExportSuccess.xcdistributionlogs`

## Remaining risks

Apple transport validation, TestFlight processing and physical-device
acceptance have not been performed. The IPA is ready for a separately
authorised upload of this exact checksum.

## Recommended next action

Authorise uploading only the exact IPA and checksum above to the existing
ShelfPick App Store Connect record for internal TestFlight processing.
