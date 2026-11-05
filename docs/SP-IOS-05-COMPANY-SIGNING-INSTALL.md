# SP-IOS-05 — Company signing and physical installation

4 November 2026. Isolated worktree `/private/tmp/shelfpick-sp-ios-01`, branch `codex/sp-ios-01`. The Personal Team prototype and dirty primary checkout remain untouched.

## Preflight before Apple resource creation

- Xcode shows Pluto Night Labs Ltd as an Admin-access Developer Team, team ID `9CDNVY8UKQ`, with zero provisioned devices. The company Developer portal device list is empty. SP-IOS-04 checked empty company App ID, certificate and profile lists and advanced `com.plutonightlabs.shelfpick` to the confirmation screen without registering it. Final identifier availability remains unproven until registration succeeds.
- The owner's paired iPhone 15 Pro Max is connected through Xcode. The prior physical-device report records iOS 27.0.1 and Developer Mode enabled. The device identifier is intentionally omitted here.
- Keychain has one valid Apple Development identity for the Personal Team and no company Apple Development identity. Existing local provisioning profiles are preserved.
- The SP-IOS-04 staging script copied the native project to a fresh temporary directory. An **unsigned Release build for generic physical iOS** succeeded with `arm64`. Its compiled metadata identifies `ShelfPick`, `com.plutonightlabs.shelfpick`, iPhone family only (`UIDeviceFamily = [1]`), and portrait only. Its bundled Capacitor runtime config matches the company identity. It has no embedded provisioning profile and cannot be installed yet.
- `git diff --check` passed. No company certificate, App ID, device registration or profile has been created in this milestone so far.

## Owner approval gate

Before any Apple account mutation, obtain explicit owner approval for these four resource classes under company team `9CDNVY8UKQ`: (1) explicit App ID `com.plutonightlabs.shelfpick`, (2) registration of the already-authorised iPhone 15 Pro Max, (3) one Apple Development signing certificate if no suitable company identity exists, and (4) one matching iOS development provisioning profile. Reuse a suitable existing identity if one appears. Do not create capabilities, distribution resources, additional devices or paid services. Stop if Apple demands anything outside this list.

After approval, use only a staged company project copy for signing. Verify the signed `.app` bundle ID, team entitlement, iPhone device family, portrait orientation, embedded profile validity and expiry before installation. Install alongside the Personal Team prototype, launch, and check login screen and basic HTTPS API connectivity using the approved internal account without recording credentials or tokens.

## Authorised signing and installation result

The owner explicitly approved the four resource classes in this milestone on 4 November 2026. Xcode automatic signing then registered the connected iPhone and created one company Apple Development certificate. The certificate's subject identifies Pluto Night Labs Ltd, team `9CDNVY8UKQ`; its validity ends **4 November 2027, 20:34:53 UTC**. Two valid Apple Development identities now exist locally, including the preserved Personal Team identity.

**Unexpected automatic-signing side effect:** Xcode initially created an `XC Wildcard` (`*`) App ID and a local Xcode-managed `iOS Team Provisioning Profile: *`. This happened because the staged source config's `CODE_SIGNING_ALLOWED = NO` initially kept a command-line build unsigned; after removing that line in the **temporary copy only**, automatic signing picked a wildcard identity before the explicit ID existed. The wildcard App ID was visible in the company portal after the build; SP-IOS-04 had found no company App IDs. These extra resources were not requested. They were **not deleted**, since deletion was not authorised. The first incremental artifact later failed strict signature verification after changing profiles, so it was replaced with a clean build.

The explicit `ShelfPick` App ID `com.plutonightlabs.shelfpick` was then registered in the company portal with no optional capabilities selected. A named **iOS App Development** profile, `ShelfPick iPhone Development`, was generated for that explicit App ID, the new company certificate and **only** the authorised iPhone, with standard online validity. Its UUID is `71c62155-9c8c-4652-86ea-230289fa00e2`, and it expires **4 November 2027, 20:47:16 UTC**. This is a development profile, not a distribution profile.

A clean Debug `iphoneos` build from a staged temporary project succeeded with manual signing and `PROVISIONING_PROFILE_SPECIFIER='ShelfPick iPhone Development'`. `codesign --verify --deep --strict` reported **valid on disk** and **satisfies its Designated Requirement**. The embedded profile has the exact `9CDNVY8UKQ.com.plutonightlabs.shelfpick` application identifier and includes the authorised iPhone. The compiled app has bundle ID `com.plutonightlabs.shelfpick`, display name `ShelfPick`, `UIDeviceFamily=[1]`, `UISupportedInterfaceOrientations=[UIInterfaceOrientationPortrait]`, and matching Capacitor runtime ID. No Associated Domains or other optional capability was enabled.

`devicectl` installed the clean build on the iPhone 15 Pro Max (iOS 27.0.1) and reported a successful launch. Device Hub displayed the signed-in Picker screen after the final install; the owner had signed in directly on the phone and confirmed that the app opened. This is evidence for basic authenticated Render API connectivity, not a repeat of all SP-IOS-02B journeys. Device Hub listed both `ShelfPick` and `ShelfPick Prototype` with their separate bundle IDs, so the Personal Team app remains installed. No credentials or JWTs were collected or logged.

No repository source, production API, backend, database, entitlement, release or distribution state was changed. Only this report was added in SP-IOS-05; the SP-IOS-04 company configuration remains uncommitted in the isolated worktree. `git diff --check` passed. No new web tests were needed because no app code changed. No commit, push, merge, TestFlight or App Store submission occurred.

**Next owner decision:** review whether to remove the unintended `XC Wildcard` App ID and Xcode-managed wildcard profile in a separate authorised cleanup. The explicit profile and clean build should be retained for the next physical accessibility and App Store preparation milestone. Release gates from SP-IOS-04 remain: final assets, privacy-policy access, App Review demo account, native secure token storage and return links, plus larger-text and 200% zoom verification.
