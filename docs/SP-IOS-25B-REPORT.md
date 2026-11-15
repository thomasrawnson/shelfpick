# SP-IOS-25B — Upload ShelfPick Build 4

**STATUS:** PASS

**COMPLETED:** The checksum-pinned ShelfPick 1.0 (4) IPA was uploaded once through the authenticated Apple Transporter workflow. Apple accepted and processed the delivery. The export-compliance state was cleared using the previously approved classification, **None of the algorithms mentioned above**, supported by the unchanged system HTTPS/Keychain encryption evidence. Build 4 was assigned only to the existing `ShelfPick Internal` group and its existing single tester. App Store Connect reports the build as `Testing`.

**TESTS:**

- IPA SHA-256 matched `af72e3e68d93c6a85b56c810b074a5771a1f3508bb9d58b87b352f5adab79ee8`.
- Signature: Apple Distribution, Pluto Night Labs Ltd; Team `9CDNVY8UKQ`.
- Bundle/version/build: `com.plutonightlabs.shelfpick`, `1.0 (4)`.
- Entitlements included `application-identifier=9CDNVY8UKQ.com.plutonightlabs.shelfpick`, `beta-reports-active=true`, and `get-task-allow=false`.
- Transporter delivery accepted on 14 November 2026 at 07:05.
- Apple build record: `[Apple build record ID redacted]`.
- Internal group verification: `ShelfPick Internal`, one tester, four builds; build `1.0 (4)` status `Testing`.

**RISKS:** Physical iPhone acceptance has not been performed for build 4. App Store submission and public release remain unauthorised and unverified.

**FILES:**

- IPA: `/private/tmp/shelfpick-sp-ios-25a/AppStoreExport/App.ipa`
- Source SHA: `7aa5a81be53405affdd3b51d65ed3a8aa28d7b4e`
- Evidence report: `/private/tmp/shelfpick-sp-ios-25a/SP-IOS-25B-REPORT.md`

## Focused physical-iPhone acceptance checklist

1. In TestFlight, confirm ShelfPick `1.0 (4)` is offered, then install or update it.
2. From incomplete onboarding, open **Account options** and verify logout returns to the signed-out entry screen.
3. Re-enter incomplete onboarding and verify **Delete Account** opens the existing password-confirmed flow; test cancellation and incorrect-password handling without deleting a real or reviewer account.
4. Confirm completed-onboarding account controls remain unchanged.
5. Open Privacy Policy and Terms and verify both public pages load.
6. Smoke-test Collection, Picker, Discover, Plays, and Free Game Night.
7. Enable Airplane Mode, verify the offline state, restore connectivity, and retry successfully.
8. Check light/dark appearance, Dynamic Type, VoiceOver labels/focus, keyboard avoidance, touch targets, and safe areas.

**NEXT:** Perform and record the focused physical-iPhone acceptance checklist for build 4.
