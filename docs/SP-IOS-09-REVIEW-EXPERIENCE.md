# SP-IOS-09 — App Review experience and feature screenshots

**Status:** Prepared for owner review, with feature capture blocked. No live account, Render change, public registration, distribution or App Store Connect record was created.

## Free reviewer account plan

1. After separate owner approval for production account creation, use a company-controlled email alias/inbox dedicated to App Review. Provision through the existing invitation and verification path or another already-authorised account workflow. Do not change registration rules to make this possible. Verify the email and complete onboarding through the app.
2. Keep the account on the ordinary `FREE` tier. Confirm `/auth/me` reports `game_night_basic` and **not** `game_night_enhanced`, `advanced_recommendations` or other Pro grants. The central map in `backend/services/entitlements.py` keeps basic shortlist and host choice Free; the V1 availability gate blocks phone/QR voting for every tier. Do not grant Pro to the reviewer or bypass the server check.
3. Use a synthetic profile such as **Review Player**, avatar from the approved catalogue, preferred **2 players**, **60 minutes**, play style **Either**. Add three to five existing catalogue games using the normal Collection flow. Select items with useful player/time variety and use only cover assets whose in-app display and screenshot rights have been cleared; otherwise use the branded fallback art. Add two or three synthetic, account-owned play records across at least two games, with no real names, location or scores. Do not import anyone's collection.
4. Test the account in the **final company build against the existing API**: cold login, Collection/search/detail, Picker criteria and explanation, Plays/history, basic Game Night shortlist and host choice, Settings/Profile, logout and return. Record each result. Current code and tests establish the intended Free paths; **no provisioned reviewer account was tested in SP-IOS-09**.
5. Create a unique random password in the owner's password manager, with the account email and recovery method there only. Do not store credentials, JWTs, verification/reset links or the inbox address in Git, screenshots, logs or chat. Supply reviewer credentials privately in App Store Connect's review information after the account is validated. Keep the account available through review and any appeal; rotate the password and invalidate active sessions when access is no longer needed. Recheck the private reviewer notes after each rotation. Use a separate disposable account for any full deletion test.

**Reviewer-only note template:** “Public registration is closed. Use the private credentials supplied in this field. Collection contains sample games and Plays contains sample history. Picker is available from bottom navigation. Game Night demonstrates a Free shortlist and host choice; phone/QR voting is unavailable in this release for all accounts. Account deletion is under Settings → Profile. Email verification and password reset use HTTPS web fallback. Contact [approved support address] if account access fails.” Replace brackets and verify every statement against the release build before submission.

## Public listing correction and screenshot order

[SP-IOS-08's editable listing](SP-IOS-08-APP-STORE-ASSETS.md) removes internal test language from its public description and describes basic Game Night without promising phone/QR voting. This is a draft requiring owner approval and final feature verification. The App Review notes remain private and separate from the public description.

| Order | Caption draft | Actual Free screen to capture |
| --- | --- | --- |
| 1 | Your games, ready to play | Collection overview with three rights-safe sample games |
| 2 | Find a game on your shelf | Collection search result or a game detail with fallback art |
| 3 | Choose for your group | Picker player count and time criteria |
| 4 | See why it fits | Picker recommendation and visible explanation |
| 5 | Remember the plays | Plays history with synthetic records |
| 6 | Plan a Game Night together | Basic Game Night shortlist and host choice, **without** phone voting or QR |

Capture on the final iPhone-only portrait company candidate at Apple's current accepted 6.9-inch portrait size (1320 × 2868 in SP-IOS-08), opaque PNG/JPEG, no credentials, real personal data, unapproved exported cover art, alert or notification. Each image should be an unaltered actual-app capture; any optional marketing composition needs a separate source and label. Final captions are editorial draft text, not baked into screenshots. Owner must approve visual selection and rights before upload.

**Capture result:** 0/6 final feature screenshots. An isolated localhost fixture was prepared in `frontend/scripts/ios-review-fixture.mjs` and served synthetic Free data on `127.0.0.1:8765` with no Render calls. A fixture-only company simulator build compiled and launched on the disposable 6.9-inch simulator. Native login reached the local API but failed when saving the session in Keychain with `An OS error occurred (-34018)`. The Xcode simulator build was ad hoc signed despite requesting the existing company team. A local manual certificate/entitlement signing experiment yielded team `9CDNVY8UKQ` but then failed to launch (`FBSOpenApplicationServiceErrorDomain` code 3). This experimental app was confined to the disposable simulator; the production-targeted candidate and physical iPhone were not changed. The fixture does not constitute a release reviewer account, and its screenshots could not be captured as an authenticated native session. The SP-IOS-08 login light/dark captures remain clean review evidence only.

## Launch interval

The SP-IOS-08 9.97-second simulator recording showed the Home Screen, an approximately two-second near-black interval, then ShelfPick's loading/login UI. The staged `UILaunchStoryboardName`, compiled storyboard, approved launch art and light/dark color asset are present in the simulator app. Capacitor replaces the native launch view with a `WKWebView`; its default background is `systemBackground` until content paints. The recording does not distinguish an absent launch storyboard from WebView startup time. A static color override would not address both appearances, and a native loading overlay changes launch lifecycle. No speculative code change was made. Next investigation should capture a cold-start frame trace on a signed device and identify the blank stage before a bounded fix.

## Validation and gates

- Backend entitlement source keeps the Free shortlist and Pro enhanced entitlement distinct. The later SP-IOS-14E-B V1 availability gate blocks phone voting for both tiers; this historical SP-IOS-09 fixture is not reviewer-account testing of that gate.
- Local fixture GET `/games` returned HTTP 200; the experiment used synthetic data only. No auth token, credential or personal record was logged or exported.
- The local fixture script binds loopback only and is not included in production web or iOS assets. It must never be used as an App Review backend.
- Remaining gates: owner-authorised maintained review account and representative data, artwork display/export rights, six final feature captures, privacy policy and in-app access, legal/support approval, App Privacy/age answers, distribution signing and submission approval. App Review account deletion completion requires a separate disposable account.

## Local test record — 5 November 2026

- Frontend: Node 22.23.3, **98/98 tests**, ESLint, TypeScript and production Vite build passed. PWA asset check passed. The local fixture script passed `node --check`; a loopback GET returned HTTP 200. `git diff --check` passed.
- Native: production-targeted `npm run build:ios` and Capacitor sync passed; staged company Xcode simulator build passed. The built app reports `com.plutonightlabs.shelfpick`, display name ShelfPick, `UIDeviceFamily=[1]` and portrait-only orientation. Icon and launch art SHA-256 exactly match the approved 1024-pixel export. After the fixture attempt, the disposable 6.9-inch simulator was restored to the production-targeted candidate and visibly showed the ShelfPick login screen.
- Screenshot experiment: localhost fixture compiled and launched, but native login failed at Keychain error `-34018`; a manual signing experiment failed to launch. **No authenticated feature capture passed.** No physical-device test occurred in this milestone.

No production, Apple portal, or physical-device state changed in this milestone. The dirty primary checkout and Personal Team prototype were preserved. No commit, push, merge or distribution occurred.
