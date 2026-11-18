# Privacy — ShelfPick

> Single source of truth for what ShelfPick collects. The hosted privacy policy, the iOS privacy manifest and the App Store "App Privacy" answers are derived from this file. Update it in the same commit as any SDK/plugin change.
> DRAFT written 2026-11-17 from the repository (dependencies, backend models) and the existing privacy notice draft. It is an inventory, not legal advice. Every `TODO` is an owner decision or an App Store Connect value that cannot be read from this repository; `privacy-check.sh --release` is expected to fail until they are resolved.

- **Policy URL:** https://plutonightlabs.com/shelfpick/privacy/ (published before phone voting; see "Open items")
- **Last reviewed:** 2026-11-18 (SP-PRO-01 purchase data added)
- **Collects any personal data?** Yes (account email, display name, collection and play data; Game Night guest nicknames and ballots)
- **Tracking (ATT prompt needed)?** No. Anonymous product analytics (PostHog EU, SP-ANL-001) are collected but not used for tracking; no advertising or crash-reporting SDK is connected; no cross-app or cross-site tracking.
- **Children's audience?** No. Accounts require a 13+ self-declaration; App Store age rating 4+ (owner decisions of 2026-11-15). Children's Code applicability has not been independently reviewed.

## SDKs and plugins

Runtime packages from `frontend/package.json` that ship in the web and iOS builds.

| Name | Version | Purpose | Data collected | Linked to user? | Used for tracking? | Required-reason APIs |
|------|---------|---------|----------------|-----------------|--------------------|----------------------|
| @capacitor/core | 8.6.0 | Native bridge | None | No | No | None declared by its own manifest |
| @capacitor/ios | 8.6.0 | iOS runtime (ships its own `PrivacyInfo.xcprivacy`) | None | No | No | None declared by its own manifest |
| @aparajita/capacitor-secure-storage | 8.0.1 | Keeps the sign-in token in the iOS Keychain | None sent off-device | n/a | No | None expected (Keychain); confirm |
| @capacitor/haptics | 8.0.2 | Light haptic feedback | None | No | No | None |
| @capacitor-community/in-app-review | 8.0.0 | Asks iOS to show the system review prompt (throttled locally) | None; Apple controls the prompt and any rating | No | No | None |
| @revenuecat/purchases-capacitor | 14.1.1 | Buy, restore and manage ShelfPick Pro through the App Store (RevenueCat, SP-PRO-01). Signed in with a random account ID, never the email address | Random account public ID (RevenueCat app user ID), App Store purchase and subscription records for the Pro products, and the device, OS and network details RevenueCat's SDK sends (including IP address); no IDFA; confirm against RevenueCat's current disclosures before release | Yes (the account public ID links purchases to the ShelfPick account) | No | Ships its own manifest (PurchasesHybridCommon); confirm it is picked up in the archive |
| posthog-js | 1.450.0 | Anonymous product analytics (EU Cloud); user can switch off in Settings > About | Event name and enumerated properties, random device ID, app version, OS/device context; no account data, free text or IDFA | No (not linked to an account; device ID is device-level, see `docs/analytics/privacy-disclosure.md`) | No | Local storage only; no required-reason API declared by the package: confirm |
| qrcode.react | ^4.2.0 | Draws the Game Night join QR code on-device | None | No | No | None |
| react | ^19.2.8 | UI | None | No | No | None |
| react-dom | ^19.2.8 | UI | None | No | No | None |
| react-router-dom | ^7.18.3 | Routing | None | No | No | None |

## Data our own code collects or stores

| Data | Where stored (device / our server / none) | Why | Retention |
|------|-------------------------------------------|-----|-----------|
| Email, password hash, display name, verification state, tier, optional BGG username, preferences | Our server (Render PostgreSQL) | Accounts and sign-in | Until account deletion (in-app, after password confirmation) |
| Account public ID (random UUID, not the email or numeric ID) and a purchase record: plan (lifetime or yearly), product ID, status, expiry, store, sandbox or production, last check time | Our server (`users.public_id`, `purchase_entitlements`) and RevenueCat (processor) | Apply Pro to the account only after the server has checked the purchase with RevenueCat | Until account deletion: the purchase row is deleted with the account, and the server then asks RevenueCat to erase the customer (best effort: if that call fails the account stays deleted and the random ID is logged as a warning for manual erasure, kept in Render logs for 7 days). Erasing the customer does not cancel an Apple subscription; Apple keeps the payment record |
| Collection, wishlist, plays (dates, duration, optional location, participant names, scores and per-category scoresheet entries), custom scoresheets a Pro user builds (name, categories, rules), rankings, Picker criteria and events, timer drafts | Our server | Core features | Until account deletion |
| Game Night host sessions and candidate lists | Our server | Hosted votes | Access expires after 12 hours; rows are not yet deleted automatically |
| Game Night guest nickname, hashed guest credential, ballot | Our server | Phone voting without an account | Access 12 hours; provisional 30-day deletion after expiry is **not implemented or approved** |
| Guest credential and bearer access token | Device (browser local storage on web; Keychain on iOS for the sign-in token) | Keep a guest or user signed in | Until sign-out, expiry or app deletion |
| Analytics events and random anonymous ID | PostHog EU Cloud (processor); ID and opt-out choice in device local storage | Count feature use, drop-off and retention | PostHog project retention (owner to confirm); stops when the user opts out |
| Review-prompt state (last request date, saved-play count) | Device only (local storage) | Limit the review prompt to once per 90 days | Until app data is cleared |
| Year in Review banner dismissal (one flag per year) | Device only (local storage) | Stop showing the Pick banner after it is dismissed | Until app data is cleared |
| In-app feedback: type, message, "email me back" choice; optionally app version, build, OS version and device type (only when "Include app and device info" is on) | Our server (`feedback` table, linked to the account) and emailed to hello@plutonightlabs.com through Resend. The account email is included in that email only when the user asks for a reply | Feature ideas and problem reports (SP-SETTINGS-01) | Until account deletion (rows are deleted with the account); the inbox copy follows the mailbox's own retention. Owner to confirm a retention period |
| Feedback written while offline | Device only (local storage outbox, per account) until it is sent | Avoid losing a message with no connection | Removed once sent, or when the account is deleted on this device |
| Tip count (Supporter badge) | Device only (local storage) | Thank users who tipped | Until app data is cleared. The tip jar is hidden in release builds until a StoreKit purchase layer exists |
| Shelf layout choice (grid or list) | Device only (local storage) | Remember how the Shelf is shown | Until app data is cleared |
| One-time verification/reset token hashes, keyed-hash abuse counters, request IDs, server logs | Our server | Security and operations | Render logs 7 days; abuse rows removed on a later write after 24 hours; expired tokens have no scheduled cleanup (per SP-IOS-21B) |
| Email address and message for verification/reset mail | Resend (processor) | Transactional email | Resend log retention 30 days (per SP-IOS-21B); confirm |
| BGG username (public collection requests) | Sent to BoardGameGeek | Import a public collection | Per BGG |
| Game cover images | Loaded by the user's browser or app directly from BGG | Show cover art | None held by ShelfPick; BGG may see IP address and request headers |

Processors and integrations: Render (hosting, database, logs), Resend (email), PostHog (anonymous analytics, EU), RevenueCat (purchase verification; receives the random account ID and App Store purchase data), BoardGameGeek (collection data and images). Contracting roles and UK transfer mechanisms have not been independently verified (see `docs/SP-IOS-21B-LEGAL-PAGES-AND-BUILD-3-PREPARATION.md`).

The Get ShelfPick link shown to guests is a plain App Store link. It carries no tracking parameters.

## Apple App Privacy answers (App Store Connect)

The owner enters these; this repository cannot read them.

- Data types declared (published by the owner 2026-11-18): Name, Email Address, User ID, Other User Content (App Functionality); Device ID and Product Interaction (Analytics, from SP-ANL-001 PostHog); Other Diagnostic Data (App Functionality, not linked).
- Linked to identity: Yes for every type except Other Diagnostic Data. Device ID and Product Interaction are declared linked as the conservative choice.
- Used for tracking: No for all types.
- **TODO (SP-PRO-01):** before the build that sells Pro, add **Purchases > Purchase History** (App Functionality, linked to identity, not used for tracking) in App Store Connect. RevenueCat also processes the User ID already declared, plus device identifiers and IP address; confirm the declared types against RevenueCat's published App Store privacy guidance.
- TODO: compare guest nicknames and ballots (SP-UNLOCK-01) with this list; confirm Other Diagnostic Data should not also list Analytics, because PostHog events carry app version and OS/device model.

## Privacy manifest (PrivacyInfo.xcprivacy)

- Source: `frontend/ios/App/App/PrivacyInfo.xcprivacy`, part of the App target (draft, owner to review). It declares no tracking and no tracking domains, collected data of Email Address, Name and Other User Content (linked, not for tracking, App Functionality), Purchase History (linked, not for tracking, App Functionality, added by SP-PRO-01) and Device ID and Product Interaction (linked, not for tracking, Analytics). The manifests inside `@capacitor/ios` declare nothing.
- Required-reason API declarations: none. No required-reason API use was found in the app or plugin Swift sources (checked 2026-11-17). The manifest types (the first five) match the App Store Connect answers published 2026-11-18; Other Diagnostic Data is declared in App Store Connect but not in the manifest.

## Google Play Data safety (when shipping to Android)

- Not yet applicable.

## Open items

1. **Published policy is out of date for phone voting.** The public policy states there is no phone or QR voting. It must be updated and approved before `GAME_NIGHT_PHONE_VOTING_ENABLED` is turned on in production.
2. **Guest-data wording.** `docs/privacy-notice-draft.md` and the in-app draft describe nicknames, ballots, the 12-hour window and the provisional 30-day retention. The owner approved the wording on 2026-11-17; no lawyer has reviewed it, and the retention is not implemented.
3. **App Store Connect answers** need checking against the guest data above before the build that enables phone voting ships.
4. **App-level privacy manifest** was added on 2026-11-17 and is not yet in a released build; confirm it matches the App Store Connect answers.
5. **Feedback (SP-SETTINGS-01).** The feedback message is user content linked to the account, and device details are optional. The App Store Connect answers and `PrivacyInfo.xcprivacy` already declare Other User Content (linked, App Functionality); the owner should confirm that covers feedback and decide whether optional device details need declaring. Add feedback to the hosted privacy policy before the build that ships it.
6. **Tip jar.** Still hidden in release builds. Purchase History is now declared for Pro (SP-PRO-01); tips would use the same type.
8. **RevenueCat (SP-PRO-01).** New processor. Add it, the purchase data above and the account ID to the hosted privacy policy, record the processing agreement and data location. Account deletion now erases the RevenueCat customer through its API with the existing version 1 secret key (no permission setting exists for it); confirm with a sandbox account deletion that the customer disappears from the RevenueCat dashboard. Required before the build that sells Pro ships.
7. This repository's `privacy-check.sh` reads only a root `package.json`; ShelfPick's dependencies are in `frontend/package.json`, so the dependency table above is maintained by hand.

## Change log

| Date | Change | By |
|------|--------|----|
| 2026-11-18 | In-app feedback (server table, Resend notification, offline outbox) and device-only tip count added (SP-SETTINGS-01) | Claude Code, for owner review |
| 2026-11-17 | App privacy manifest added; manifest section updated | Claude Code, for owner review |
| 2026-11-17 | Initial privacy inventory (SP-POLISH-02), including SP-UNLOCK-01 additions: guest nicknames and ballots, haptics and in-app review plugins | Claude Code, for owner review |
