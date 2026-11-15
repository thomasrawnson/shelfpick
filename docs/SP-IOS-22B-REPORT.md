# SP-IOS-22B — Internal TestFlight Build 3

**STATUS:** PASS

**COMPLETED:** Uploaded only the authorised ShelfPick 1.0 (3) IPA through Apple Transporter. Apple accepted the delivery and finished processing it. The unchanged export-compliance questionnaire was answered `None of the algorithms mentioned above`, consistent with builds 1 and 2 and the verified binary. Missing Compliance cleared. Build 3 was assigned to the existing `ShelfPick Internal` group; the group remains limited to its one existing tester. App Store Connect reports build 1.0 (3) as `Testing`, expiring in 90 days.

**TESTS:** SHA-256 matched `2fe6d1917efdb5309b99040e9c671ebd713e106f8ba86d56a93b824a7c20b600`. Bundle ID `com.plutonightlabs.shelfpick`, version/build `1.0 (3)`, team `9CDNVY8UKQ`, distribution signature, embedded entitlements and trust chain were verified before upload. Transporter reported delivery accepted on 13 November 2026 at 15:52 and processing finished. App Store Connect group evidence: 1 tester, 3 builds; build record `[Apple build record ID redacted]` is `Testing` on iOS.

**RISKS:** Physical installation and device acceptance have not been performed. No external testing, App Review submission or public release was undertaken.

**FILES:**

- IPA: `/private/tmp/shelfpick-sp-ios-22a/AppStoreExport/App.ipa`
- Source SHA: `bea871438e3b6ecc2cb26b014ca422887080cf53`
- Evidence report: `/private/tmp/shelfpick-sp-ios-22a/SP-IOS-22B-REPORT.md`

**NEXT:** Install build 1.0 (3) from TestFlight on the owner's iPhone and complete the focused acceptance checklist.

## Focused iPhone acceptance checklist

- Confirm TestFlight shows ShelfPick 1.0 (3), then install/update it.
- Cold launch; log in; verify session persistence and logout.
- Open Privacy Policy and Terms in-app; confirm each reaches the correct public page and returns cleanly to ShelfPick.
- Exercise Collection, BGG artwork, Picker recommendation/explanation, Discover and Plays.
- Run Game Night with named and count-only participants; confirm Log a play has the correct editable players, game and no duplicates.
- Check monthly recap statistics, rights-safe artwork fallback and native sharing.
- Enable Airplane Mode, verify the expected error, restore connectivity and retry successfully.
- Check light/dark appearance, Dynamic Type, VoiceOver, safe areas and keyboard behaviour.
- Test account deletion only with a disposable account.
