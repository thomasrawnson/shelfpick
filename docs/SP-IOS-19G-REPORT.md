# SP-IOS-19G — TestFlight Build 2 Upload

**STATUS:** PASS WITH RISKS

**COMPLETED:** Verified and uploaded only `/private/tmp/shelfpick-sp-ios-19e/AppStoreExport/App.ipa` through Apple Transporter while authenticated as the Pluto Night Labs Ltd provider. Transporter reported delivery at 10:03 on 13 November 2026. App Store Connect created ShelfPick 1.0 build 2 and currently reports `Missing Compliance`; no compliance declaration or group assignment was made.

**TESTS:** SHA-256 matched `eb88d07b0275cea762e777fce48d283692dacf21eb6098480f2d059e513dd9db`. Strict/deep signature verification passed. Distribution authority was Pluto Night Labs Ltd, Team ID `9CDNVY8UKQ`; bundle ID `com.plutonightlabs.shelfpick`; version/build `1.0 (2)`; approved source SHA `bea871438e3b6ecc2cb26b014ca422887080cf53`. Apple delivery acceptance passed. Processing produced build record `[Apple build record ID redacted]`. Internal assignment and installation eligibility are blocked/unverified.

**RISKS:** Build 2 cannot be assigned to `ShelfPick Internal` until its export-encryption compliance declaration is completed. SP-IOS-19G did not authorise making that declaration. No tester, external-testing, App Review, signing, production, or Git changes were made.

**FILES:** IPA above; this report. No replacement artifact or rebuild.

**PHYSICAL IPHONE ACCEPTANCE CHECKLIST (after eligibility):**

- Install/update from TestFlight and confirm 1.0 (2).
- Cold launch; login; session persistence; logout.
- Game Night named and count-only participants → Log a play: correct editable prefill, game retained, no duplicates.
- Monthly recap: intentional rights-safe fallback, accurate stats, PNG download/native share.
- Collection/BGG, Picker, Discover, record/view play, and Free Game Night.
- Airplane Mode error and recovery after connectivity returns.
- Light/dark, Dynamic Type, VoiceOver, safe areas, and keyboard behaviour.
- Account deletion only with a disposable account.

**NEXT:** Separately authorise the verified export-compliance declaration for build 2; then assign it to the existing internal group and confirm tester eligibility.
