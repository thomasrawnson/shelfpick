# SP-IOS-10A-V2 — Onboarding and avatar visual verification

## Environment and provenance

On 5 November 2026, the existing SP-IOS-10A candidate was built and installed as `com.shelfpick.prototype` on the booted iPhone 17e simulator (iOS 27.2). The first unsigned build launched but synthetic login failed with Keychain OS error `-34018`. A local ad hoc simulator signature, without Apple team resources, fixed login. The simulator used a disposable localhost API with an incomplete synthetic user, BGG search and collection sync responses. No Render or live account was contacted. The candidate's iOS web assets were subsequently restored to the approved HTTPS Render API origin; the fixture URL is absent from `dist` and the copied native assets.

## Screenshots

All `welcome`, `import`, `preferences`, `avatars` and `profile` images in [screenshots/sp-ios-10a-v2](screenshots/sp-ios-10a-v2/) are direct `simctl io screenshot` captures of the running candidate at 1170×2532 pixels, in light and dark appearance. `avatars-selected-light.png` shows Gold selected; `profile-light.png` and `profile-dark.png` show it after onboarding. `profile-before-sp-pb17.png` is the earlier 390×844 actual UI screenshot copied from the protected SP-PB17 evidence, for a clearly labelled before comparison; it is a different fixture and viewport. `simulator-initial.png` and `after-finish.png` captured launch/app-switch transitions and are not visual acceptance evidence.

## Interaction evidence

- Simulator: synthetic login reached fresh onboarding; Continue, Skip and Back advanced or returned to the expected steps. Manual search returned Ticket to Ride and Add changed to Added. Successful synthetic BGG collection import advanced to preferences. Gold selection remained visible in Profile after completion. Restarting with an incomplete fixture account returned to onboarding. Import guidance and all six avatar choices rendered in both themes. Scrolling exposed continuation controls below the first fold.
- Browser fixture: at 390px and 320px, document width equalled viewport width. A synthetic HTTP 503 BGG import displayed `Synthetic BGG import unavailable` as an alert and retained the username. Manual search/Add, Skip and Back preserved the query and Added state. This failure and narrow-viewport check was browser evidence, not simulator evidence.
- Existing frontend suite: 98 passed; ESLint, TypeScript/Vite production build, PWA check and `git diff --check` passed in SP-IOS-10A. The unsigned and local ad hoc iOS simulator builds succeeded in V2.

## Findings

- **POLISH:** On iPhone 17e, the five-column avatar grid breaks `Meeple rust` inside “Meeple” and compresses `Dice teal`; the motifs and selected check remain visible. Owner should decide whether to adjust labels/grid before release.
- **RISK:** BG Stats guidance sits below the first viewport on the import step; it is reachable by scrolling. The actual BG Stats file import was not exercised in this onboarding fixture because that flow is available after setup.
- **RISK:** The older before screenshot uses a separate fixture and 390×844 browser capture, so it demonstrates the prior avatar treatment but is not a controlled pixel comparison.

No source design changes were made during V2. The protected iOS worktree and dirty primary checkout were not edited. No commit, push, deployment or distribution occurred.
