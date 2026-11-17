# Privacy — ShelfPick

> Single source of truth for what ShelfPick collects. The hosted privacy policy, the iOS privacy manifest and the App Store "App Privacy" answers are derived from this file. Update it in the same commit as any SDK/plugin change.
> DRAFT written 2026-11-17 from the repository (dependencies, backend models) and the existing privacy notice draft. It is an inventory, not legal advice. Every `TODO` is an owner decision or an App Store Connect value that cannot be read from this repository; `privacy-check.sh --release` is expected to fail until they are resolved.

- **Policy URL:** https://plutonightlabs.com/shelfpick/privacy/ (published before phone voting; see "Open items")
- **Last reviewed:** 2026-11-17
- **Collects any personal data?** Yes (account email, display name, collection and play data; Game Night guest nicknames and ballots)
- **Tracking (ATT prompt needed)?** No. No analytics, advertising or crash-reporting SDK is connected; no cross-app or cross-site tracking.
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
| qrcode.react | ^4.2.0 | Draws the Game Night join QR code on-device | None | No | No | None |
| react | ^19.2.8 | UI | None | No | No | None |
| react-dom | ^19.2.8 | UI | None | No | No | None |
| react-router-dom | ^7.18.3 | Routing | None | No | No | None |

## Data our own code collects or stores

| Data | Where stored (device / our server / none) | Why | Retention |
|------|-------------------------------------------|-----|-----------|
| Email, password hash, display name, verification state, tier, optional BGG username, preferences | Our server (Render PostgreSQL) | Accounts and sign-in | Until account deletion (in-app, after password confirmation) |
| Collection, wishlist, plays (dates, duration, optional location, participant names and scores), rankings, Picker criteria and events, timer drafts | Our server | Core features | Until account deletion |
| Game Night host sessions and candidate lists | Our server | Hosted votes | Access expires after 12 hours; rows are not yet deleted automatically |
| Game Night guest nickname, hashed guest credential, ballot | Our server | Phone voting without an account | Access 12 hours; provisional 30-day deletion after expiry is **not implemented or approved** |
| Guest credential and bearer access token | Device (browser local storage on web; Keychain on iOS for the sign-in token) | Keep a guest or user signed in | Until sign-out, expiry or app deletion |
| Review-prompt state (last request date, saved-play count) | Device only (local storage) | Limit the review prompt to once per 90 days | Until app data is cleared |
| One-time verification/reset token hashes, keyed-hash abuse counters, request IDs, server logs | Our server | Security and operations | Render logs 7 days; abuse rows removed on a later write after 24 hours; expired tokens have no scheduled cleanup (per SP-IOS-21B) |
| Email address and message for verification/reset mail | Resend (processor) | Transactional email | Resend log retention 30 days (per SP-IOS-21B); confirm |
| BGG username (public collection requests) | Sent to BoardGameGeek | Import a public collection | Per BGG |
| Game cover images | Loaded by the user's browser or app directly from BGG | Show cover art | None held by ShelfPick; BGG may see IP address and request headers |

Processors and integrations: Render (hosting, database, logs), Resend (email), BoardGameGeek (collection data and images). Contracting roles and UK transfer mechanisms have not been independently verified (see `docs/SP-IOS-21B-LEGAL-PAGES-AND-BUILD-3-PREPARATION.md`).

The Get ShelfPick link shown to guests is a plain App Store link. It carries no tracking parameters.

## Apple App Privacy answers (App Store Connect)

The owner enters these; this repository cannot read them.

- Data types declared: TODO (copy from App Store Connect; SP-IOS-21B planned a conservative six-type matrix. Guest nicknames and ballots, added by SP-UNLOCK-01, need to be compared with it.)
- Linked to identity: TODO
- Used for tracking: TODO (expected: No)

## Privacy manifest (PrivacyInfo.xcprivacy)

- Source: **No app-level `PrivacyInfo.xcprivacy` exists in this repository** (`frontend/ios`). Only the manifests shipped inside `@capacitor/ios` are present; earlier release reports record that they declare no tracking, collected data or required-reason APIs.
- Required-reason API declarations: TODO (owner to decide whether the app target needs its own manifest, for example for the Keychain and local-storage use above)

## Google Play Data safety (when shipping to Android)

- Not yet applicable.

## Open items

1. **Published policy is out of date for phone voting.** The public policy states there is no phone or QR voting. It must be updated and approved before `GAME_NIGHT_PHONE_VOTING_ENABLED` is turned on in production.
2. **Guest-data wording.** `docs/privacy-notice-draft.md` and the in-app draft describe nicknames, ballots, the 12-hour window and the provisional 30-day retention. The owner approved the wording on 2026-11-17; no lawyer has reviewed it, and the retention is not implemented.
3. **App Store Connect answers** need checking against the guest data above before the build that enables phone voting ships.
4. **App-level privacy manifest** is absent (see above).
5. This repository's `privacy-check.sh` reads only a root `package.json`; ShelfPick's dependencies are in `frontend/package.json`, so the dependency table above is maintained by hand.

## Change log

| Date | Change | By |
|------|--------|----|
| 2026-11-17 | Initial privacy inventory (SP-POLISH-02), including SP-UNLOCK-01 additions: guest nicknames and ballots, haptics and in-app review plugins | Claude Code, for owner review |
