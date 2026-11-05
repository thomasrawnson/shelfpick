# SP-IOS-10A-V3 — Avatar layout verification

On 5 November 2026, the isolated SP-IOS-10A candidate was installed and launched on the dedicated iPhone 17e simulator (iOS 27.2). A disposable localhost onboarding fixture supplied a synthetic player. No Render account or data was changed.

The iOS Dynamic Type override had replaced the shared three-column avatar grid with an auto-fit layout, yielding five cramped columns at this width. The native override now retains three columns. Visible labels are Forest, Gold, Clay, Dice, Meeple and Cards; IDs, motifs and accessible descriptions are unchanged. Native labels no longer break within words.

Actual `simctl io screenshot` captures at 1170×2532:

- [Onboarding avatar selection, light](screenshots/sp-ios-10a-v3/avatar-onboarding-light.png)
- [Onboarding avatar selection, dark](screenshots/sp-ios-10a-v3/avatar-onboarding-dark.png)
- [Saved Gold avatar in Profile, light](screenshots/sp-ios-10a-v3/avatar-profile-light.png)
- [Saved Gold avatar in Profile, dark](screenshots/sp-ios-10a-v3/avatar-profile-dark.png)

Visual inspection: all six choices form two balanced rows, labels remain intact, and the selected outline/check is clear in both themes. Gold selected during onboarding appears selected again in Profile. The earlier five-column result is documented in [SP-IOS-10A-V2](SP-IOS-10A-V2-VISUAL-VERIFICATION.md).

Validation: 98 frontend tests, ESLint, TypeScript/Vite iOS build, Capacitor sync, ad hoc signed simulator build/install/launch, PWA asset check and `git diff --check` passed. After captures, the candidate web/native assets were rebuilt with the approved HTTPS Render API origin; the fixture origin is absent from built assets. The protected iOS worktree and primary checkout were not edited. No physical-device check was performed for this layout change.
