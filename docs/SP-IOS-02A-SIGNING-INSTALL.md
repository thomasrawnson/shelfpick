# SP-IOS-02A — Apple development signing and physical installation

4 November 2026. Isolated worktree `/private/tmp/shelfpick-sp-ios-01`, branch `codex/sp-ios-01`. The dirty primary checkout was not edited. No commit, push, merge, deployment, App Store submission or TestFlight distribution.

## Signing inventory and approval

- Xcode Apple Accounts contains the owner's existing Personal Team (`QNXYJH4FMA`) and Pluto Night Labs Ltd team. The Personal Team already had the paired iPhone provisioned and one existing valid Apple Development identity. The company team showed zero provisioned devices in Xcode. No new membership was purchased.
- Normal-access Keychain inspection found **one valid** code-signing identity. The earlier sandboxed zero count in SP-IOS-02 was a false negative. Xcode's active profile location, `~/Library/Developer/Xcode/UserData/Provisioning Profiles`, held two existing Personal Team profiles for unrelated apps. Downloading available manual profiles did not add a ShelfPick profile. Their embedded public certificate matched the valid local identity.
- The owner explicitly approved registering the provisional `com.shelfpick.prototype` App ID and creating a development profile for the paired iPhone, while reusing the existing certificate. Xcode automatic signing created the matching profile under the Personal Team. No new certificate was created; the valid-identity count remained one.
- `frontend/ios/App/App.xcodeproj/project.pbxproj` now sets `DEVELOPMENT_TEAM = QNXYJH4FMA` for **Debug only**. Release configuration, Capacitor API origin, entitlements and web/PWA configuration were unchanged. The final company bundle ID still requires owner approval.

## Build and device evidence

| Check | Result |
| --- | --- |
| iOS assets | Node 22.23.3 `npm run build:ios` passed and synced the approved Render-origin assets. |
| Device build | Xcode Debug build for the paired iPhone 15 Pro Max, iOS 27.0.1, succeeded with automatic signing. It used the existing Apple Development identity and `iOS Team Provisioning Profile: com.shelfpick.prototype`. |
| Profile match | Embedded profile app ID `QNXYJH4FMA.com.shelfpick.prototype`; paired device included; development entitlement enabled; expires 11 November 2026. |
| Install | `devicectl device install app` succeeded. Device Hub lists ShelfPick Prototype 1.0 (1) on the physical iPhone. |
| Launch | `devicectl device process launch` reported success. Device Hub physical-screen mirroring showed black, but the owner then unlocked the iPhone, opened ShelfPick Prototype directly and confirmed its login screen appears. This is owner-observed basic launch, not agent-observed screen content. |
| Signature check | A separate Mac `codesign --verify --deep --strict` returned `CSSMERR_TP_NOT_TRUSTED`, despite Xcode build, iPhone installation and owner-confirmed launch succeeding. This appears to be a Mac trust-chain check limitation; the cause was not investigated further. |

No account credentials, certificate private keys, tokens or personal app data were recorded. No physical journeys beyond installation/basic launch were attempted in this milestone.

## Remaining limitations

1. **P1 signing durability:** This is a short-lived Personal Team development profile, expiring 11 November 2026. Rebuild/reprovisioning will be needed after expiry. The provisional bundle ID is not a company release identifier.
2. **P1 device testing:** SP-IOS-02 core journeys and physical VoiceOver remain separate and unverified; only installation and basic login-screen launch are confirmed on-device.
3. **P2 Mac signature check:** `codesign --verify` reported an untrusted chain on the Mac. iOS accepted and opened the app; investigate this only if later device signing or launch fails.
