# SP-IOS-02 — physical iPhone and VoiceOver verification

4 November 2026. Worktree `/private/tmp/shelfpick-sp-ios-01`, branch `codex/sp-ios-01`. **Status: BLOCKED before physical installation.** No production, backend, Render, entitlement, account, or database change; no commit, push, merge, TestFlight, App Store submission or deployment. The dirty primary checkout was not edited.

**SP-IOS-02A correction:** The zero-identity and zero-profile counts below came from a sandboxed Keychain query and the older MobileDevice profile path. A later normal-access check found one valid Apple Development identity and two profiles under Xcode's `UserData/Provisioning Profiles` path. Both profiles target other apps; neither matches ShelfPick. The physical install blocker was the missing matching profile, not a missing certificate.

## Device and signing evidence

| Check | Evidence |
| --- | --- |
| Authorised device | Owner-named iPhone 15 Pro Max (`iPhone16,2`), iOS 27.0.1, connected over wire and paired in Xcode CoreDevice. Developer Mode is enabled. |
| Existing signing resources | `security find-identity -v -p codesigning` found **0 valid identities**. The local provisioning-profile directory contains **0 profiles**. The prototype project has automatic signing style but no `DEVELOPMENT_TEAM`. |
| Non-provisioning device build | Manual-signing Xcode build for the physical iPhone failed: `"App" requires a provisioning profile. Select a provisioning profile in the Signing & Capabilities editor.` No `-allowProvisioningUpdates` was used, so the check did not create certificates, App IDs or profiles. |
| Installation | `com.shelfpick.prototype` is not installed on the physical iPhone. No install or launch was attempted after the signing failure. |

**Required to resume:** the owner must supply an existing valid Apple Development signing identity, team and provisioning profile for the provisional bundle ID, or separately approve Xcode to create the necessary development signing resources. The final company bundle ID remains a separate owner decision. No paid service is required or authorised by this report.

## Checks completed without the physical app

- Node 22.23.3 `npm run build:ios` passed with the approved HTTPS Render API origin, then Capacitor sync succeeded. An unsigned Debug iOS Simulator Xcode build passed. The physical device build failed only at signing.
- Frontend: 93 tests passed; ESLint, TypeScript/web production build and PWA asset validation passed. `git diff --check` passed.
- The prior SP-IOS-01B iPhone 17 simulator checks established safe-area placement, search focus/keyboard recovery, logout, fresh login, session restoration, Collection, Picker, Plays and account-deletion entry-point reachability. Those results are simulator evidence only.
- Actual iOS VoiceOver was enabled on the **iPhone 17 simulator**, verified enabled via CoreDevice, then disabled and verified disabled afterward. Visual focus rectangles appeared on the ShelfPick icon, Profile row, Collection tab, search field and Picker tab. VoiceOver double activation opened the app, Profile and Collection, focused Collection search with the iOS keyboard, dismissed it, and opened Picker. The focused search caused the page to scroll upward while the keyboard was open; it returned to normal layout after dismissal. Speech output, accessible names, swipe focus order and human comprehension were not captured, so no full VoiceOver pass is claimed.

## Unverified on the physical iPhone

Every requested native journey remains untested on the device: startup/restart, login/logout/session persistence, Settings, Collection add/search, Picker, play recording/history, sharing, BGG, Game Night QR/link, failed-network recovery, safe areas, keyboard/zoom, orientation, appearance, Dynamic Type/200% zoom, touch targets, background recovery and VoiceOver. No test data was created or deleted during SP-IOS-02.

## Priority

1. **P0 — Signing and install:** Resolve the missing development identity/profile through an owner-approved signing path, then install the unchanged isolated prototype on the paired phone.
2. **P1 — Device and VoiceOver evidence:** Run the physical journey and real VoiceOver speech/focus checklist after installation. Classify any observed issues by severity; do not infer a pass from simulator focus rectangles.
3. **P1 — App Store preparation:** Address the already documented WebView token storage, Universal Links and App Review 4.2 risks only in a separately scoped milestone.
