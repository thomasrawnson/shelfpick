# SP-IOS-01 — native iOS feasibility, 4 November 2026

## Scope and result

This is a local prototype on `codex/sp-ios-01`, based on clean `origin/main` at `7855f01`. The primary `main` checkout had 37 tracked modifications and many untracked files; it was not edited. Remote inspection found two older open draft documentation PRs (#1 and #2). No commit, push, deployment, Render setting, database, entitlement or public web release was changed.

The React/Vite production output is bundled into a Capacitor 8.6 iOS project. The provisional bundle ID is `com.shelfpick.prototype`; it is **not** the final company ID. Native service-worker registration is skipped; web/PWA registration remains active. The built-in Capacitor HTTP bridge is enabled for native cross-origin requests so the production backend need not accept a `capacitor://localhost` CORS origin. API contracts and browser routes are unchanged. This bridge needs real API testing before reliance.

## Environment and build

| Item | Observed |
| --- | --- |
| Host | macOS 27.0.1, Xcode 27.2, Swift 6.4.2, iOS SDK 27.2 |
| Node | 22.23.3 available and used for prototype build; shell default in worktree was 24.21.0, so select Node 22 explicitly |
| Capacitor | 8.6.0; [official iOS docs](https://capacitorjs.com/docs/ios) specify iOS 15+ and Xcode 26.0+; [environment setup](https://capacitorjs.com/docs/getting-started/environment-setup) specifies Xcode tooling |
| Simulator | iPhone 17, iOS 27.2 booted; unsigned Debug simulator build succeeded, installed and launched |
| Physical device | Owner-named iPhone 15 Pro Max visible to `devicectl`; no signing team was configured or verified, and no device installation was attempted |

`VITE_API_BASE_URL` is a public build-time value. No approved current Render API origin was available in the checkout or release package. The simulator evidence used `https://api.shelfpick.invalid` **only** to compile and open the shell. It does not demonstrate backend connectivity. The normal iOS build script rejects missing, non-HTTPS or path-bearing API values.

### Rebuild and install locally

From `frontend/` in this worktree, select Node 22, then:

```sh
npm ci
VITE_API_BASE_URL=https://APPROVED-API-ORIGIN npm run build:ios
xcodebuild -project ios/App/App.xcodeproj -scheme App -configuration Debug \
  -destination 'generic/platform=iOS Simulator' -derivedDataPath /private/tmp/shelfpick-sp-ios-01-derived \
  CODE_SIGNING_ALLOWED=NO build
xcrun simctl install booted /private/tmp/shelfpick-sp-ios-01-derived/Build/Products/Debug-iphonesimulator/App.app
xcrun simctl launch booted com.shelfpick.prototype
```

Use the real approved HTTPS API origin in place of the example. The value is embedded in JavaScript; rebuild after changing it. The iOS app needs a separate Xcode signing team/profile for device installation. Apple says personal-device testing requires signing into an Apple Account in Xcode; App Store distribution requires the appropriate Developer Program team ([account overview](https://developer.apple.com/help/account/basics/about-your-developer-account)).

## Functional evidence

| Flow | Result |
| --- | --- |
| Launch and splash | App process launched and login screen rendered. Generated Capacitor splash/icon remains placeholder; splash behavior was not timed. |
| Light/dark | Login screen visually checked in iPhone 17 simulator; [light](screenshots/sp-ios-01/login-light.png), [dark](screenshots/sp-ios-01/login-dark.png). |
| Login, verification, token persistence, logout | Unverified against API. Existing token is in WebView `localStorage`, not Keychain. Verification/reset email links target the HTTPS web domain. |
| Onboarding/avatar, collection, game search/add, Picker, plays/history | Existing UI and API code is bundled; no authenticated simulator session or live API test occurred. |
| BGG links | Existing external HTTPS anchors present; native browser handoff untested. |
| Game Night QR join | Host QR and HTTPS guest join URL remain in UI; scanning and return-to-app untested. |
| Sharing | Existing `navigator.share` branches remain; iOS WebView share-sheet/file behavior untested. |
| Safe area, keyboard, bottom navigation, focus, VoiceOver | Existing CSS uses safe-area insets. Authenticated navigation and keyboard/VoiceOver behavior were not checked. |
| Offline/failed network | Existing frontend retry/empty-state unit tests passed; native offline UI not exercised. |
| Account deletion | Existing Settings → Profile → Delete account form is in the bundled UI; requires authenticated API test. |

Frontend: 93 tests passed; lint, production build, and PWA asset check passed. Color guard reported ten existing raw colors for review but exited successfully. iOS simulator build succeeded; install and launch succeeded. No physical-device or human accessibility test was run.

## Prioritized native gaps and App Store assessment

1. **P0 — API and auth proof.** Supply an approved non-production or explicitly authorized HTTPS Render API origin and test native HTTP response/error behavior, login, session persistence/logout, all core CRUD paths and account deletion. Do not point this prototype at production user data by default.
2. **P1 — Return links.** Verification/reset emails currently use web URLs, and the join QR uses a web URL. Decide whether HTTPS Universal Links should open the app; configure Associated Domains, an `apple-app-site-association` file and route/token handling only after domain and entitlement approval. Existing links can continue opening the web flow meanwhile.
3. **P1 — Native polish and security.** Replace generated launch/icon assets; verify keyboard and safe-area behavior, VoiceOver focus/order, external BGG opening, offline errors and share sheet. Evaluate Keychain-backed token storage before treating `localStorage` persistence as production-ready.
4. **P2 — App review.** [Guideline 4.2](https://developer.apple.com/app-store/review/guidelines/) requires utility beyond a repackaged website. ShelfPick has substantive collection, Picker, play history and Game Night tasks, but this prototype adds no verified native advantage yet. A working native share sheet and Universal Links, plus iPhone-quality navigation and offline states, are the smallest credible improvement set. Approval is Apple's decision. [Guideline 5.1.1(v)](https://developer.apple.com/help/app-review/guideline-reference/5-1-1-account-deletion) requires in-app account deletion; the current form appears reachable under Settings → Profile, pending device/API verification.

**Recommended next milestone:** SP-IOS-02, a private API-connected iPhone simulator playtest with native HTTP validation, auth and account deletion, deep-link decision, share-sheet check and accessibility pass. Keep signing, production configuration and App Store distribution outside that milestone until separately approved.
