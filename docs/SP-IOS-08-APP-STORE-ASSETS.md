# SP-IOS-08 — App Store assets and submission preparation

**State:** Local review candidate. No distribution, App Store Connect record, production change, or owner visual/legal approval.

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
| Keywords | board games,collection,picker,game night,play history,tabletop | 62/100 UTF-8 bytes; verify final terms and trademark use |
| Support URL | `https://plutonightlabs.com/contact/` | Public general contact page exists; owner must confirm ShelfPick support coverage |
| Marketing URL | `https://plutonightlabs.com/` | Optional; current site describes ShelfPick as in progress, so update before publication or omit |
| Privacy Policy URL | **Required: approved, public ShelfPick-specific URL** | The current `https://plutonightlabs.com/privacy/` covers the website only and must not be represented as the app policy |
| Promotional text | Leave blank | Optional, 170-character limit |

### Description draft

ShelfPick helps you get your board games to the table.

Keep a collection of games you own and search it when you are ready to play. Tell Picker about your group and the time available, then explore recommendations with reasons for each suggestion. Record plays and look back at your history. Use basic Game Night to make a shortlist and choose a game together.

Collection, basic Picker, Plays and basic Game Night are available with Free access.

The public description is 447 characters, within Apple's 4,000-character limit. Recheck the published build against every claim before submitting. No subscription price, testimonial, or unsupported capability is claimed. It contains no internal test or review instructions.

### App Review notes draft

Use the separately supplied maintained Free review account; **never put its credentials in this repository**. Open Collection to see and search the sample games; use Picker to choose group size and time and view a recommendation; use Plays to view sample history; use basic Game Night to create a shortlist and choose a game. Phone/QR voting is unavailable to all accounts in this V1 candidate and must not appear in review instructions or screenshots. Settings → Profile exposes account deletion. The final destructive action must use a disposable review account. The application has no available Pro purchase or active public registration. Verification/reset HTTPS links currently use the web fallback. Add precise reviewer instructions and credentials privately in App Store Connect only after the sample account and URL flows are ready.

### Age rating preparation

The owner records that Apple calculated a **4+** content rating. Preserve that App Store Connect result only while the submitted answers still match the final app and linked BGG content. The 4+ storefront content rating does not lower ShelfPick's account-registration rule: registration continues to require an explicit declaration that the person is 13 or over. Recheck user-created names, external links/content, gambling-related board-game themes, advertising and in-app purchases against the final build before submission; qualified review of children's-data obligations remains required.

## Screenshot plan and capture gate

Apple permits 1–10 screenshots per required iPhone display size, PNG/JPEG without alpha. For this iPhone-only portrait candidate, use the accepted 6.9-inch 1320 × 2868 portrait size; confirm App Store Connect's currently requested display class at upload. Capture **actual app UI** at the final appearance, with clean 9:41 status bar and approved icon. Suggested Free-only order: (1) Collection overview with rights-safe sample games; (2) Collection search/detail; (3) Picker group/time selection; (4) recommendation and explanation; (5) Plays history/recording; (6) basic Game Night shortlist and host choice. Do not show phone voting or QR joining in V1 screenshots. Optional marketing compositions must be separately labelled and must accurately reflect captured UI.

The authenticated feature set was **not captured**: the simulator has no disposable, populated review account, and the owner's internal account may expose personal data or third-party game-cover art. Prepare a representative rights-safe review account and permitted sample content before final screenshot capture. Never paste credentials into documentation or export unlicensed covers.

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

## Validation record

Apple references: [icon asset catalog](https://developer.apple.com/documentation/xcode/configuring-your-app-icon), [screenshot specifications](https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications/), [metadata fields](https://developer.apple.com/help/app-store-connect/reference/app-information/app-information), [version metadata limits](https://developer.apple.com/help/app-store-connect/reference/app-information/platform-version-information), [age rating](https://developer.apple.com/help/app-store-connect/manage-app-information/set-an-app-age-rating/), [review guidelines](https://developer.apple.com/app-store/review/guidelines/).

Validation: the company stage built for iOS Simulator with Xcode, installed and launched on iPhone 17 and iPhone 17 Pro Max simulators, and the compiled Info.plist showed `com.plutonightlabs.shelfpick`, display name ShelfPick, iPhone-only `UIDeviceFamily`, portrait-only orientation and `LaunchScreen`. The approved icon and both captures are opaque PNGs at the stated sizes. Frontend tests: 98/98 passed; ESLint and `tsc -b`/production build passed; `check:pwa` passed. `check:colors` exited successfully but listed ten pre-existing raw colours for review; none came from this company asset stage. `git diff --check` passed. No physical installation or production change occurred in SP-IOS-08.
