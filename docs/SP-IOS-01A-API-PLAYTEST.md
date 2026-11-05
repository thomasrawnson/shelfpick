# SP-IOS-01A — API-connected iOS simulator playtest

4 November 2026. Worktree: `codex/sp-ios-01` at `/private/tmp/shelfpick-sp-ios-01`. The dirty primary checkout was not edited. No commit, push, Render setting, backend, database schema, registration policy, entitlement or deployed web application was changed.

## Build configuration

`frontend/.env.ios` contains the approved public development/test API origin, `https://board-game-picker-api.onrender.com`. The root `.gitignore` explicitly allows this public iOS-only file while continuing to ignore other `.env.*` files. `npm run build:ios` validates that the value is an HTTPS origin, builds Vite in `ios` mode, and syncs the assets into the Capacitor project. The shared `npm run build` and production frontend default have not changed. The prior invalid placeholder is absent from the current native bundle.

The prototype retains Capacitor's built-in native HTTP bridge (`CapacitorHttp.enabled`) so native `fetch` can use HTTPS without changing the deployed API's CORS allowlist. The WebView's local origin is `capacitor://localhost`; a direct preflight from that origin to `/auth/login` returned **HTTP 400, `Disallowed CORS origin`**, with no `Access-Control-Allow-Origin`. A browser/WebView fetch without the native bridge therefore cannot call this API. The smallest safe path is to validate the existing native bridge. No Render CORS change is proposed for this prototype; the deployed backend configuration only accepts HTTPS origins.

## Evidence

| Check | Result |
| --- | --- |
| Host API `/health` | HTTP 200; body `{"status":"ok","database":"ok"}`. Read-only host request, not native-app proof. |
| iOS bundle | Built asset contains the approved origin and no `api.shelfpick.invalid` placeholder. |
| Xcode | Unsigned Debug build for generic iOS Simulator succeeded after iOS sync. |
| Simulator | Installed and launched `com.shelfpick.prototype` on iPhone 17, iOS 27.2. Login screen visible in Device Hub. |
| Native HTTP bridge | A temporary, untracked `/health` probe inside the app on a separate iPhone 18 Pro simulator returned **HTTP 200, database ok**. [Probe screenshot](screenshots/sp-ios-01a/native-health-probe.png). The probe was removed by `cap sync ios`, the clean iOS-mode app was rebuilt successfully and reinstalled. |
| Appearance | Clean login screen rendered in [light](screenshots/sp-ios-01a/login-light.png) and [dark](screenshots/sp-ios-01a/login-dark.png) mode on iPhone 18 Pro simulator. |
| Web regression | 93 tests passed; lint, PWA asset check and separate web production build passed. |
| Authenticated journeys | Owner signed in directly on iPhone 17 in Device Hub. No credentials, JWTs or personal data were recorded in files or this report. Native authenticated reads and writes then succeeded. |

## Simulator journey record

| Journey | Evidence / result |
| --- | --- |
| Login and native HTTP connectivity | Owner completed login in the simulator; Picker loaded. Native HTTPS GET to `/health` and authenticated collection, search, add-game and play requests succeeded through the bridge. This confirms more than host connectivity. |
| Onboarding/avatar | Account was already onboarded. New-account onboarding was not tested; no second account was created. Avatar/profile editing was not reached because Settings control was clipped. |
| Collection and search | Owned collection loaded with 182 games before test. Filtering for an existing title returned matching games. Add game searched BoardGameGeek for `The Crew`; `The Crew: The Quest for Planet Nine` was added to Owned in this account. UI confirmed success and count 183. No other account was touched. |
| Picker and play history | Picker returned a recommendation from the account shelf. A solo test play of an already owned game was saved with a synthetic participant (`SP-IOS test`); game detail changed from zero to one play. After app restart, Insights → Play showed one play and the correct last-played game/date. No score, location or personal details were entered. |
| Logout and persistence after restart | Session restored after two app process restarts, with no new login. Logout could not be tested: the profile/settings control appears clipped into the status-bar area and taps on its visible edge did not open Settings. No token was cleared. |
| Failed network | Existing frontend request/retry tests passed. Device Hub exposed no network toggle and Settings search did not reveal an airplane-mode control, so native offline/error UI was not verified. No connectivity or Render setting was changed. |
| Email verification and reset | Existing backend generates HTTPS web links; no Universal Link registration or in-app return handling is configured. |
| Sharing and external links | Picker share opened the native iOS share sheet and was cancelled without sending. Discover's `View on BGG` opened Safari at the BGG HTTPS domain; BGG displayed its own security-verification page, so page content was not verified. |
| Keyboard, safe areas, accessibility | Light/dark login screens fit. Native bottom navigation was usable at normal scale. Focusing Collection search zoomed the WebView and clipped right-side content/navigation; the zoom remained after blur and route change, then reset on app restart. Device Hub hardware-keyboard capture allowed Page Down through the play form. VoiceOver was not tested. |

## Native gaps, in priority order

1. **P0 — Settings reachability:** The profile/settings button is clipped into the simulator status-bar area. Fix its safe-area placement and verify a full 44px tap target, then test logout and the existing Settings → Profile → Delete account path. Apple [5.1.1(v)](https://developer.apple.com/help/app-review/guideline-reference/5-1-1-account-deletion) requires deletion to be accessible in the app. Do not delete the test account as part of this check.
2. **P1 — Input zoom:** Focusing Collection search enlarged the WebView, clipped the Add game button/right side and bottom navigation, and persisted after focus left. Check input font size, viewport and safe-area behavior on iPhone; verify keyboard focus and recovery. The prototype JWT remains in WebView `localStorage`, not Keychain.
3. **P1 — Network/deep links:** Native failed-network recovery remains untested. Verification/reset emails and Game Night join URLs still target HTTPS web routes; no Universal Links or in-app return handling is configured.
4. **P2 — Review polish:** Native text sharing and BGG Safari handoff worked. File/image sharing, VoiceOver, splash/icon assets and [App Review 4.2](https://developer.apple.com/app-store/review/guidelines/) suitability still need review. The existing app has substantive collection, Picker and play tasks; approval remains Apple's decision.

The only live account changes were one owned test game and one solo test play in the authorised internal account. No physical iPhone test was performed. Simulator observations and screenshots are separate from device, human accessibility and App Store review evidence.
