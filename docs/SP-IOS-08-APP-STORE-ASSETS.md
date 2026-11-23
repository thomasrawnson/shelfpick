# SP-IOS-08 — App Store assets and submission preparation

**State (updated 22 November 2026):** ShelfPick **1.2 (build 22) is live on the App Store**, released by the owner on 20 November 2026 after Apple approved it. 1.0 was released earlier and 1.1 (build 10) was released on 19 November 2026. This document began as the SP-IOS-08 local review-candidate record; the sections below keep that history where it is still true and replace it where it is not. App Store Connect, not this file, is the source of truth for the live listing: re-read it before relying on any field.

**1.2.1 (23, 23 November 2026):** version 1.2.1 was created in App Store Connect with release type **Manual**, build 23, the 1.2 listing text carried over and a new What's New, and **submitted to App Review the same day** (state Waiting for Review). Its screenshot set is described under Screenshots below. Whether Apple approves it, and the owner's release, are not recorded here.

The 1.2 additions are the optional ShelfPick Pro in-app purchases, redesigned recaps and share cards, Stats 2.0 and a new Tonight screen. See `docs/SP-PRO-01-REPORT.md` and `docs/SP-PRO-01-APP-REVIEW-NOTES.md`.

## Native assets and isolation

- Approved brand source: `frontend/public/branding/shelfpick-icon-source.png` (1254 × 1254). The approved opaque sRGB 1024 × 1024 export is `frontend/public/branding/social-profile-1024.png` (SHA-256 `32373f` prefix). The icon and centered launch art in the staged company project are byte-for-byte copies of that export. No game covers or generated art were used.
- `npm run build:ios` syncs the Personal Team prototype; `node scripts/prepare-ios-company.mjs` creates a separate temporary company copy. Only that copy receives the ShelfPick icon, appearance-aware launch background, launch storyboard, company name and bundle ID. The source prototype and its assets remain intact. This asset package requires owner visual approval before a release archive.
- The 1024 × 1024 opaque default icon renders on the light and dark simulator Home Screens. Dark and tinted icon variants are optional future branding decisions. The storyboard and light/dark catalog assets compile, but a simulator recording of a warm launch showed an approximately two-second dark interval before the login screen. A clean transition is **not verified**; resolve and inspect a cold launch on device before submission.
- Captured actual company app UI: [light login](screenshots/sp-ios-08/iphone-17-pro-max-login-light.png) and [dark login](screenshots/sp-ios-08/iphone-17-pro-max-login-dark.png). Both are 1320 × 2868 RGB PNGs with no alpha, captured on a disposable iPhone 17 Pro Max simulator. They contain no credentials or game covers. These are **review evidence**, not a final feature screenshot set.

## Editable English (UK) listing draft

| Field | Draft | Review gate |
| --- | --- | --- |
| Name | ShelfPick | Owner brand approval; 9/30 characters |
| Subtitle | Pick your next board game | 25/30 characters |
| Short value proposition | Organise your games, choose what to play and remember the nights you shared. | Draft, not a separate App Store field |
| Primary category | Lifestyle | Suggested because ShelfPick organises a hobby; owner selects final category |
| Secondary category | Entertainment | Optional; owner selects final category |
| Keywords | board games,game night,collection,game picker,play tracker,tabletop,wishlist,score tracker | 90/100 UTF-8 bytes in App Store Connect for 1.2; verify terms and trademark use if changed |
| Support URL | `https://plutonightlabs.com/shelfpick/support/` | ShelfPick-specific support page, which now has a Pro and purchases topic |
| Marketing URL | `https://plutonightlabs.com/shelfpick/` | ShelfPick landing page, updated for 1.2 on 20 November 2026 |
| Privacy Policy URL | `https://plutonightlabs.com/shelfpick/privacy/` | Product-specific policy, updated 19 November 2026 for purchases, RevenueCat, feedback and exported covers. The website-wide `https://plutonightlabs.com/privacy/` is not the app policy |
| Promotional text | Free to download. Find a game for your group, log every play and share a monthly recap. Optional ShelfPick Pro adds deeper stats, custom scoresheets and a live timer. | 166/170 characters; set on the 1.2 version |

### Description (1.2)

The 1.1 description is kept and extended. Opening and the sections Find the right game, Your collection sorted, Discover your next favourite, Remember every game night and Make game night easier are unchanged. Two sections were added before "Make game night easier", and a links block before the closing attribution:

> **SEE YOUR YEAR AT THE TABLE**
> Explore trends, records and streaks in Stats, then turn your month or year into a recap card with your game covers, ready to share.
>
> **SHELFPICK PRO (OPTIONAL)**
> ShelfPick is free to download and use. ShelfPick Pro is an optional upgrade, either Pro Yearly (auto-renewing subscription) or Pro Lifetime (one-time purchase), that unlocks deeper statistics (records and head-to-head), Help my H-index in the Picker, custom scoresheets, For You suggestions and a live game timer. Everything that is free today stays free.
>
> Pro Yearly renews automatically every year at the price shown in the app unless you cancel at least 24 hours before the end of the current period. Manage or cancel it in your Apple Account settings. Payment is charged to your Apple Account.

The links block lists the Terms of Use (`https://plutonightlabs.com/shelfpick/terms/`), the Privacy Policy and Apple's standard terms (`https://www.apple.com/legal/internet-services/itunes/dev/stdeula/`). The 1.2 What's New text matches the in-app What's new screen: Pro, Stats trends, records and head-to-head, monthly and yearly recaps, the new Tonight buttons, and the Your Pro plan page. The earlier sentence "Collection, basic Picker, Plays and basic Game Night are available with Free access" and the claim that no purchase exists are **superseded**. Recheck every claim against the shipped build when the description changes.

### App Review notes (1.2)

The notes in App Store Connect for 1.2 replace the earlier draft ("no available Pro purchase or active public registration", "phone/QR voting unavailable"), which was true only of the 1.0 candidate. The 1.2 notes explain how to reach the paywall (Discover, then Compare Free and Pro), how to buy with a sandbox Apple Account, that the server verifies each purchase with RevenueCat, how Restore purchases and Settings, Your Pro plan work, where account deletion is, and that public registration is open to people aged 13 and over. Phone voting is enabled in production, so a host can start a group vote from Tonight. The sign-in account is held only in App Store Connect and the owner's password manager: **never put its credentials in this repository**. The full text is in `docs/SP-PRO-01-APP-REVIEW-NOTES.md`.

### Age rating preparation

The owner records that Apple calculated a **4+** content rating. Preserve that App Store Connect result only while the submitted answers still match the final app and linked BGG content. The 4+ storefront content rating does not lower ShelfPick's account-registration rule: registration continues to require an explicit declaration that the person is 13 or over. Recheck user-created names, external links/content, gambling-related board-game themes, advertising and in-app purchases against the final build before submission; qualified review of children's-data obligations remains required. In-app purchases are now present (1.2). Apple's age-rating banner in App Store Connect, shown on 20 November 2026, asks developers to update the location-sharing and dating answers by 15 January 2027.

## Screenshots

Apple permits 1 to 10 screenshots per display class, PNG or JPEG without alpha. **1.2 set (uploaded 20 November 2026):** seven rights-safe screenshots, in this order: Tonight, Shelf, Plays, Stats Trends, Stats Recaps, the monthly share card with a cover collage, and Pro stats records. They are browser captures (Playwright WebKit) of the web build of main at `a1c3d7a`, using local synthetic accounts, 12 fictional games and generated cover art. They are **not Simulator or device captures** and have no iOS status bar. Phone voting is enabled in production, so the Tonight screenshot shows the new "Start a group vote" button.

- **Size:** App Store Connect rejected the 1320 x 2868 originals for the "iPhone with Dynamic Island (medium display)" slot, which accepts 1206 x 2622 and 1179 x 2556. The uploaded files are the same images resized to 1206 x 2622 (an aspect change of about 0.07%). The 1320 x 2868 originals stay on the owner's machine, not in this repository.
- **Pro page:** a Pro comparison screenshot is attached to each in-app purchase as its App Review screenshot, not to the product page. Its prices (£3.99 Yearly, £9.99 Lifetime) come from the development stand-in. In App Store Connect, Pro Lifetime is £9.99 and Pro Yearly shows $3.99 in USD; the UK Yearly price was not checked.
- **Rights:** no BoardGameGeek artwork appears in any screenshot. A real-covers set was not produced because the cover-rights decision for the App Store listing is the owner's. Exported share cards in the app do use real BoardGameGeek covers (`EXPORT_COVER_ARTWORK_ENABLED` is true in production, set by the owner on 19 November 2026).
- **Optional:** a Simulator recapture would add a clean 9:41 status bar. The original SP-IOS-08 login captures remain review evidence only.

### 1.2.1 set (uploaded 23 November 2026)

Eight screenshots in the same iPhone 6.3-inch slot (1206 x 2622, RGB, no alpha): Tonight, Shelf, **Game detail** (new), Plays and Stats Trends were recaptured for SP-UI-03/04/05; Stats Recaps, the monthly share card and Pro stats records are the **1.2 images, unchanged**, so those three still show the earlier styling (gold numerals, old selected state). Recapture them when next convenient. The new five come from `frontend/e2e/app-store-screenshots.spec.ts` (`APP_STORE_SHOTS=1 npx playwright test e2e/app-store-screenshots.spec.ts --project="iPhone 15"`, output `docs/screenshots/app-store-1.2.1/`): browser captures (Playwright WebKit, 402 x 874 at 3x) of the web build of main at `9a890bd`, with mocked synthetic data, generated cover art and no BoardGameGeek artwork, converted to RGB with `ffmpeg -pix_fmt rgb24`. They are **not Simulator or device captures** and have no iOS status bar. The same four Tonight, Shelf, Plays and Stats images (resized to 736 x 1600) went live on plutonightlabs.com/shelfpick on 23 November 2026 (site commit `976752d`).

## Submission gates

Status as of 22 November 2026. Items marked done were done for the 1.2 submission.

| Priority | Gate | Status |
| --- | --- | --- |
| Required | Public app Privacy Policy and Terms | **Done.** Published 19 November 2026 at `https://plutonightlabs.com/shelfpick/privacy/` and `/terms/`, including Pro purchases, RevenueCat and feedback. The website-wide policy is separate. |
| Required | App Review access | **Done.** A maintained reviewer account is in App Store Connect only. Public registration is open (13+ declaration, email verification) and phone voting is enabled. |
| Required | App privacy and age rating | **Done for 1.2.** Purchases, Purchase History was added on 20 November 2026 (App Functionality, linked to the user, not used for tracking). 4+ rating preserved. Age-rating questionnaire update due 15 January 2027. |
| Required | Brand, content rights and screenshots | Icon approved. Screenshots are rights-safe (see above). Real BoardGameGeek covers in marketing remain an owner decision. |
| Required | Company distribution | **Done.** Builds are signed with Apple Distribution for team `9CDNVY8UKQ` and uploaded by the owner through Transporter. Release lanes (`preflight`, `build`, `upload`) are on main (PR 55) but have not yet run against App Store Connect. |
| Required before claiming native links | Email verification, reset and Game Night URLs | Unchanged: HTTPS web fallback only; Universal Links, Associated Domains, AASA and native routing remain absent. |
| Release risk | Launch transition | Not re-verified. The earlier simulator observation of a dark interval after launch has no device recheck on record. |
| Open | Pro purchase testing | A sandbox purchase on a debug build and TestFlight plans loading are recorded in `docs/SP-PRO-01-REPORT.md`. Restore purchases and account deletion (RevenueCat customer erasure) have not been confirmed on the live 1.2 build. |
| Accepted scope | Accessibility and device policy | SP-IOS-07A records physical larger-text growth and earlier VoiceOver checks. No new accessibility audit here. V1 is iPhone portrait by owner decision. |

Account deletion entry and confirmation were reached on the physical device in SP-IOS-02B/07. Live account deletion with a RevenueCat customer was not executed as part of this document's work.

## Submission gates

| Priority | Gate | Evidence / action |
| --- | --- | --- |
| Required | Public app Privacy Policy and in-app access | `docs/privacy-notice-draft.md` is unapproved; the company website policy is website-only. Approve and publish product-specific terms, support and policy; add in-app policy access before review. |
| Required | App Review access | Maintain a reviewer account with sample Collection, Plays and Game Night data; provide private credentials and explicit steps in App Store Connect. Public registration remains closed. |
| Required | App privacy and age rating | Complete accurate App Store Connect data disclosures and age questionnaire from the shipped backend, analytics, external content and retention practices; owner/legal sign-off. |
| Required | Brand, content rights and screenshots | Owner approve icon/launch appearance; confirm rights to any BGG imagery or use rights-safe placeholders; capture feature screenshots from final build. |
| Required | Company distribution | Current company Apple Development signing supports device testing, not App Store release. Distribution signing, archive, App Store Connect setup, TestFlight and submission require separate authority and checks. |
| Required before claiming native links | Email verification, reset and Game Night URLs | Existing HTTPS web fallback works; Universal Links/Associated Domains/AASA/native routing are absent. Decide whether web fallback is acceptable for review and document the reviewer path; native deep links require a separate milestone and approval. |
| Release risk | Launch transition | Simulator showed a dark interval after launch; confirm whether it is storyboard or WebView loading and assess on a physical device. |
| Accepted scope | Accessibility and device policy | SP-IOS-07A records physical larger-text growth and earlier VoiceOver checks. No new accessibility audit here. V1 is iPhone portrait by owner decision. |

Account deletion entry and confirmation were reached on the physical device in SP-IOS-02B/07; final live account deletion was intentionally not executed. Privacy, reviewer account, rights and distribution gates remain open.

## Validation record (SP-IOS-08, historical)

The checks below record the original SP-IOS-08 asset package. They have not been repeated for 1.2; 1.2's own checks are in `docs/SP-PRO-01-REPORT.md` and the build evidence in the release worktrees.

Apple references: [icon asset catalog](https://developer.apple.com/documentation/xcode/configuring-your-app-icon), [screenshot specifications](https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications/), [metadata fields](https://developer.apple.com/help/app-store-connect/reference/app-information/app-information), [version metadata limits](https://developer.apple.com/help/app-store-connect/reference/app-information/platform-version-information), [age rating](https://developer.apple.com/help/app-store-connect/manage-app-information/set-an-app-age-rating/), [review guidelines](https://developer.apple.com/app-store/review/guidelines/).

Validation: the company stage built for iOS Simulator with Xcode, installed and launched on iPhone 17 and iPhone 17 Pro Max simulators, and the compiled Info.plist showed `com.plutonightlabs.shelfpick`, display name ShelfPick, iPhone-only `UIDeviceFamily`, portrait-only orientation and `LaunchScreen`. The approved icon and both captures are opaque PNGs at the stated sizes. Frontend tests: 98/98 passed; ESLint and `tsc -b`/production build passed; `check:pwa` passed. `check:colors` exited successfully but listed ten pre-existing raw colours for review; none came from this company asset stage. `git diff --check` passed. No physical installation or production change occurred in SP-IOS-08.
