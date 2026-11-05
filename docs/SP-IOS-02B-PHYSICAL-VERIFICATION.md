# SP-IOS-02B — Physical iPhone functional and accessibility verification

4 November 2026. Isolated worktree `/private/tmp/shelfpick-sp-ios-01`, branch `codex/sp-ios-01`. The owner's dirty primary checkout is untouched. No source code, backend, Render configuration, account settings, signing resource or production setting was changed. Only the approved internal account received one test game and one test play. No commit, push, merge, deployment, distribution or account deletion occurred.

## Evidence boundary

Device Hub identified the paired physical iPhone 15 Pro Max on iOS 27.0.1 and listed ShelfPick Prototype 1.0 (1), bundle ID `com.shelfpick.prototype`. Its live display showed the ShelfPick login screen. The owner entered the approved internal account credentials directly on the phone; the live display then showed the signed-in Picker. No credential or token was recorded, and no screenshot containing personal data was retained in the worktree. Findings below are direct visual interaction through Device Hub unless marked owner-reported.

## Physical journey record

| Journey | Physical-device result |
| --- | --- |
| Login and logout | Owner signed in directly; signed-in Picker loaded. Settings → Log out returned to a blank login form. Owner-reported force quit and reopen still showed the login form. |
| Cold-launch session persistence | Owner-reported force quit and reopen returned signed in; Device Hub then showed the signed-in Picker. |
| Collection search and game details | 183 owned games loaded; searching `7 Wonders` narrowed the list; game details opened. No persistent focus zoom or horizontal clipping observed. |
| Add an authorised test game | BGG search found `Hive Pocket`; Add to Owned succeeded and count changed 183→184. One new record in the internal account. |
| Picker recommendation | The three-player default and Any complexity criteria produced an `Arkadia` recommendation with explanation and match score. |
| Record and retrieve a test play | Saved a `Hive Pocket` two-player play with synthetic names `SP-IOS test A` and `SP-IOS test`; game history showed 1 play and Insights → Play showed 2 account plays total, with `Hive Pocket` last played on 4 Nov 2026. No BGG Stats submission. |
| Settings, Profile and deletion confirmation | Avatar control fully below status bar and tappable; Settings → Profile opened. Scrolling exposed password field, acknowledgement checkbox and final `Delete my account` control. No password entered; no deletion attempted. |
| Native sharing and BGG external link | Picker text share opened iOS share sheet; cancelled without sending. Play image preview generated with names hidden; Share image opened iOS share sheet; cancelled without sending. Discover `View on BGG` opened the installed BGG app at the selected game and ShelfPick resumed through iOS return navigation. |
| Safe area, bottom navigation and keyboard | Settings/profile control and five bottom tabs were fully visible in portrait. Collection search and Add Game fields stayed at normal scale. The software keyboard appeared on search; Done dismissed it. Bottom tabs were covered while the keyboard was open and returned afterward. No horizontal overflow observed. |
| Light and dark appearance | Signed-in Picker, Collection, Settings and Profile appeared in device dark mode. App Light setting showed Collection and Settings without clipping; `Use device setting` was restored. |
| Network failure and recovery | Owner disabled Wi-Fi and cellular data. Opening Discover produced an in-app `Couldn't connect to ShelfPick. Check your connection and try again.` notice with `Try again`; iOS also showed its mobile-data alert. After owner restored connectivity, Discover results loaded again. |
| Game Night join/vote | Selected only the two synthetic players, produced a five-game shortlist and revealed `7 Wonders Duel`. Phone voting showed a ShelfPick Pro gate for this account; no QR or voting session was opened, and no entitlement changed. |
| Orientation | Owner reported that ShelfPick stayed portrait when the physical iPhone was turned to landscape with Portrait Orientation Lock off. `Info.plist` declares iPhone landscape support, so the cause needs a focused native investigation. |
| VoiceOver spoken names, order and activation | Owner enabled actual physical iOS VoiceOver and reported that Email, Password, Show, Forgot password and Log in were all announced clearly on the logged-out screen. Double-tapping Email announced `insertion point at end`, and the field received a visible caret/focus ring. After the device-wide keyboard absence resolved, the owner signed in successfully with VoiceOver on and the iPhone unplugged. In Collection, VoiceOver read the whole game card and double-tap opened details. Owner reported Collection search, Picker player/time choices, selection announcements, recommendation explanation and Continue/Find a game activation worked throughout. Settings → Profile, deletion password/acknowledgement/final control and Log out were reported reachable; VoiceOver logout returned to login. No deletion was performed. Exact phrase transcript beyond `insertion point at end` was not captured. |

## Prior evidence and release considerations

The Settings safe-area and input-focus fixes from SP-IOS-01B behaved correctly in the observed portrait physical-device checks. The owner completed a spoken VoiceOver pass of the critical journeys. Release preparation still requires larger-text/zoom checks, a durable company signing path, and decisions on native authentication storage and Universal Links. The Personal Team development profile expires 11 November 2026. No App Store review outcome is inferred.

Apple's current [App Review Guideline 4.2](https://developer.apple.com/app-store/review/guidelines/) expects utility and an app experience beyond a repackaged website. The observed Collection, Picker, play tracking, native share sheets and BGG handoff provide real tasks, but this prototype's native integration and final review suitability remain open. Apple's [account-deletion guidance](https://developer.apple.com/help/app-review/guideline-reference/5-1-1-account-deletion/) requires an in-app initiation path; Settings → Profile exposes the existing confirmation form, but destructive completion was intentionally not tested.

## Open defects and limitations

1. **P1, device environment — transient on-screen keyboard loss:** After a physical logout, VoiceOver announced the login controls, but the software keyboard did not appear when Email was activated. The same occurred with VoiceOver off in ShelfPick, WhatsApp and Mail after unplugging the Mac. After device troubleshooting, the owner reported that the on-screen keyboard returned. Subsequent VoiceOver sign-in succeeded with the phone unplugged. The exact cause was not isolated; this observation cannot be attributed to ShelfPick alone.
2. **P2, native orientation — stays portrait:** The owner reported no landscape rotation with Portrait Orientation Lock off, although `frontend/ios/App/App/Info.plist` declares landscape. Confirm device-wide rotation state and reproduce independently before changing the project.
3. **Entitlement gap, expected — phone voting:** The account's Game Night shortlist works, but QR join/voting requires Pro. No entitlement change was authorised; this is not evidence of a native failure.

## Unverified and release gates

- Physical Dynamic Type/larger text and 200% zoom were not exercised. The native Settings button uses the source `--target-min: 44px`; it was visibly within the safe area and tapped successfully, but a physical point measurement was not made.
- Game Night QR joining, guest voting and native Universal Link return for email verification/reset remain unverified; phone voting is entitlement gated on this account. New-account onboarding was not exercised.
- There is **no new observed ShelfPick app blocker** from the tested physical journeys. Before App Store preparation, the provisional Personal Team signing/profile and bundle ID must be replaced through a separately approved company signing path. WebView `localStorage` token storage and Universal Links need a separate architecture decision. Apple's 4.2 outcome remains an external review decision, not a test result.

## Validation

No code change was made, so web tests and iOS builds were not rerun for this evidence-only milestone. Device Hub installation listing and live physical screen were checked. The owner supplied the spoken VoiceOver observations while the iPhone was unplugged. No physical screenshot was retained because transient notifications and share-sheet suggestions contained personal information. The added game and play affect only the approved internal account. No other user's data was changed or deleted.
