# SP-IOS-04 — Company release configuration and accessibility

4 November 2026. Isolated worktree `/private/tmp/shelfpick-sp-ios-01`, branch `codex/sp-ios-01`. This prepares an **unsigned local candidate** for owner review. The dirty primary checkout, existing Personal Team Xcode settings, and installed physical iPhone prototype were preserved. No App ID, certificate, device registration, profile, entitlement, Apple app record, deployment, distribution, commit, push or merge was created.

## Approved V1 identity and local build

The owner approved the name **ShelfPick**, proposed bundle ID `com.plutonightlabs.shelfpick`, company team `9CDNVY8UKQ`, **iPhone only**, and **portrait only**. The existing prototype remains `com.shelfpick.prototype`, display name “ShelfPick Prototype,” Personal Team Debug signing, iPhone/iPad target family, and portrait/landscape `Info.plist`.

The separate local candidate uses `frontend/ios/company-release.xcconfig` to set the company bundle ID, iPhone device family (`1`), a separate Info.plist, and `CODE_SIGNING_ALLOWED = NO`. `Info-Company.plist` gives the approved display name and only `UIInterfaceOrientationPortrait`. `frontend/scripts/prepare-ios-company.mjs` copies the synced native project to a unique temporary directory and changes **only that copy's** Capacitor runtime app ID/name. It refuses to stage if the source no longer identifies as the expected prototype or if iOS pinch zoom was not synced. The source `capacitor.config.ts`, `Info.plist`, Xcode project and signing settings remain unchanged. [Apple documents](https://developer.apple.com/documentation/bundleresources/information-property-list/uisupportedinterfaceorientations) the orientation key; the compiled `UIDeviceFamily` is the decisive check for iPhone-only targeting.

From `frontend/`, with Node 22 and the existing approved `.env.ios`:

```sh
npm run build:ios
node scripts/prepare-ios-company.mjs
# Use the printed /.../ios path as STAGED_IOS; it is a temporary copy.
xcodebuild -project "$STAGED_IOS/App/App.xcodeproj" -scheme App \
  -configuration Release -xcconfig "$STAGED_IOS/company-release.xcconfig" \
  -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' \
  -derivedDataPath /private/tmp/shelfpick-company-derived \
  CODE_SIGNING_ALLOWED=NO build
```

The actual unsigned Release simulator build succeeded. Compiled `App.app/Info.plist` contained `CFBundleDisplayName = ShelfPick`, `CFBundleIdentifier = com.plutonightlabs.shelfpick`, `UIDeviceFamily = [1]`, and `UISupportedInterfaceOrientations = [UIInterfaceOrientationPortrait]` with no iPad-specific orientation key. Bundled `capacitor.config.json` contained the company ID/name and `ios.zoomEnabled = true`. On iPhone 17 simulator (iOS 27.2), the company candidate installed **alongside** the prototype, launched to login, and stayed in its portrait layout when Device Hub rotated the device. The simulator was returned to portrait. The candidate was not installed on the physical phone.

The default Xcode scheme and ordinary Release settings still identify the prototype. **Do not use Xcode Product → Archive for company distribution** from that default scheme; a separately approved signing milestone must make the company archive path explicit and verify its embedded identity before any upload.

## Identifier availability and company signing gate

Read-only Apple Developer inspection under Pluto Night Labs Ltd showed an empty company App ID list, certificates list, devices list and profiles list; Xcode also showed no company signing certificates and zero provisioned devices. The explicit proposed ID advanced to Apple's **“Confirm your App ID”** screen without a visible validation conflict. **Register was not pressed.** This is evidence that the portal accepted the entered syntax and showed no conflict before registration; it is not a global reservation or guarantee that final registration will succeed. The form was abandoned and the empty App ID list was rechecked. The organisation membership and team ID were confirmed in SP-IOS-03.

The next signing action needs a separate owner approval for each resource class: register the explicit App ID, register the authorised iPhone under the company team, create or obtain a company Apple Development identity, and create a matching development profile. Only then should a separately staged **company-signed** device build replace `CODE_SIGNING_ALLOWED=NO`. Later TestFlight/App Store work needs an App Store Connect record and distribution signing/archive, with separate distribution and submission approval ([Apple profile guidance](https://developer.apple.com/help/account/provisioning-profiles/create-an-app-store-provisioning-profile)). The Personal Team development profile expires 11 November 2026. No company signing was activated here.

Current app code needs no special entitlement for ordinary HTTPS API requests or native share sheets. A future **Universal Links** implementation requires an Associated Domains capability and `applinks:<approved-host>` entitlement, plus a matching hosted AASA file ([Apple associated domains](https://developer.apple.com/documentation/xcode/supporting-associated-domains)). App-local Keychain storage uses the app's default access group; a Keychain Sharing capability is unnecessary unless sharing credentials with another app ([Apple Keychain access groups](https://developer.apple.com/documentation/security/sharing-access-to-keychain-items-among-a-collection-of-apps)). Neither capability was changed.

## Accessibility and simulator evidence

| Check | Result and boundary |
| --- | --- |
| Native pinch setting | Source and staged runtime config both have `ios.zoomEnabled = true`; this is Capacitor 8.6's documented iOS WebView zoom option ([Capacitor configuration](https://capacitorjs.com/docs/config)). No global viewport scaling restriction was added. |
| Actual 200% pinch | **Unverified.** Device Hub did not expose a usable multi-touch gesture, and the working physical Personal Team app predates the zoom-enabled rebuild. Testing it physically would require a separately signed update or replacement, outside this milestone. Source configuration and launch are not a physical pinch result. |
| Larger text | On iPhone 17 and smaller iPhone 17e simulators (iOS 27.2), changing `content_size` from `large` to `accessibility-extra-extra-large` did not visibly enlarge the ShelfPick login text; iPhone 17 company candidate remained unchanged after cold launch. The text category was restored to `large` on both simulators, and 17e was returned to its prior shutdown state. This is a native Dynamic Type gap, although normal-size screens were not clipped. |
| Signed-in screens | At the same large accessibility category, the existing signed-in prototype's Picker, Collection and Settings rendered on iPhone 17 with the Settings control and bottom navigation visible. Text still appeared at normal size, so these are **layout observations, not larger-text success**. This did not require an account write or login. |
| Safe areas and keyboard | Company candidate login and its fields fit in portrait on iPhone 17 and 17e. Email focus showed a caret and no automatic WebView zoom; Done dismissed focus and the layout stayed at normal scale. Device Hub showed its input accessory bar rather than a full software keyboard, so keyboard occlusion in this rebuilt candidate was not proved. SP-IOS-02B records an earlier physical software-keyboard/safe-area pass for the Personal Team prototype. |
| VoiceOver | The physical human VoiceOver pass from SP-IOS-02B remains prior evidence. It was not repeated on this unsigned company candidate. |

No directly related clipping defect appeared in these normal-size checks, so no CSS was changed. **Before App Store submission**, implement a bounded iOS larger-text approach and verify actual scaling, reflow, 200% pinch/pan, keyboard reachability, and VoiceOver on a signed company build. Do not count an iOS text-category toggle alone as a pass when WebView text does not respond.

## Native security and return-link decision

**Recommended authentication approach:** The new bundle ID has a separate app/WebView storage container from the Personal Team prototype, so require a fresh sign-in rather than attempting to transfer its `localStorage` JWT. Before company distribution, add a small iOS-only Keychain-backed token adapter while keeping web/PWA localStorage behaviour; load it asynchronously at startup and clear it on logout, expired session and completed account deletion. Keep “Log out all devices” server invalidation separate. Test cold launch, logout, deletion cleanup and migration from any **company-ID** localStorage development builds. Never store passwords or tokens in logs. This is a scoped design decision, not an implementation in SP-IOS-04.

**Recommended link approach:** Keep existing HTTPS web fallback for `/verify-email`, `/reset-password` and `/game-night/join/:token`. In a later authorised milestone, identify the exact frontend host, publish its AASA file, enable Associated Domains for the company App ID, and add an allowlisted Capacitor App URL listener for both cold and warm starts. Validate link tokens and avoid recording query strings. The backend `FRONTEND_URL`, Render and production domain were not changed. Phone voting remains entitlement-gated for the current internal account.

## Remaining release gates and validation

The company candidate still carries provisional Capacitor icon/splash assets. The privacy notice remains an owner/legal draft with no in-app link, and a maintained App Review demo account is not ready; these remain genuine submission blockers from [SP-IOS-03](SP-IOS-03-APP-STORE-TECHNICAL-READINESS.md) and [Apple's review guidelines](https://developer.apple.com/app-store/review/guidelines/). Account-deletion controls were previously reached on the physical device, but final deletion was not performed. iPad and landscape are intentionally deferred by owner decision.

Frontend verification: 93/93 tests, ESLint, TypeScript/production build, PWA asset validation, and iOS asset sync passed. `plutil -lint` passed for the company Info.plist. The unsigned Xcode Release simulator build passed, and its compiled identity/orientation/family/runtime metadata was inspected. The candidate launched on iPhone 17 and 17e simulators. `git diff --check` passed. No physical iPhone update, company signing, actual 200% pinch, hosted Universal Link test, backend change, production web change, or App Store submission occurred.

**Recommended next action:** owner review and separately approve the exact company Apple resource creation needed for a signed test build; then run the physical pinch and larger-text checks before any distribution decision.
