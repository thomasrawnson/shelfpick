# SP-IOS-11 — isolated iOS release candidate

5 November 2026. Local branch `codex/sp-ios-11` at `/private/tmp/shelfpick-sp-ios-11`, based on fetched `origin/main` `b2fef84486c6dbfd4edd43650a07309b41978c69`. No commit, push, PR, merge, deployment, Apple resource change or physical-device installation occurred.

## Integration and provenance

- The protected primary checkout had 76 changed paths; the native, onboarding/avatar and visual worktrees had 45, 54 and 62 respectively before integration. They were not reset, cleaned, rebased or overwritten.
- The accepted 10B tree already contained 10A and native work. Its tracked frontend patch was applied three-way onto fetched main. Three overlaps were resolved by retaining main's fail-closed legal-draft integration and adding native session restoration, deletion cleanup and Dynamic Type. Only approved native project/assets/scripts, session tests, milestone reports and visual evidence were copied. The disposable review-fixture script was excluded.
- Main's backend, migrations, BGG search ranking, collection API and workload/retention safeguards are untouched. The compiled web and iOS assets contain the approved Render API origin and no fixture origin, synthetic token or unapproved legal-draft marker.
- The source Capacitor project remains a neutral prototype with no Personal Team ID. `prepare-ios-company.mjs` creates a separate staged copy with company team `9CDNVY8UKQ`, bundle `com.plutonightlabs.shelfpick`, iPhone-only device family, portrait-only Info.plist, icon and appearance-aware launch art. Simulator builds use local ad hoc signing; no distribution identity is claimed.
- Main's legal-draft build guard now runs in `build:ios` before Capacitor sync. The existing web build guard and PWA remain intact.
- Simulator verification at Accessibility Medium found three native-only reflow issues: bottom-nav words splitting, the Discover title splitting, and Collection filter/search text clipping. The RC's native stylesheet gives nav items readable minimum widths with horizontal scrolling, wraps the Discover header, and reflows Collection filters and search/sort. At standard Large, the five-tab and Collection layouts remain compact.

## Reproduce

Use Node 22 and existing dependencies. From `frontend/`, run `npm ci`, `npm test`, `npm run lint`, `VITE_API_BASE_URL=https://board-game-picker-api.onrender.com npm run build`, `npm run check:pwa`, `npm run build:ios`, then `node scripts/prepare-ios-company.mjs`. The final command prints a temporary staged `ios` path. Build its `App/App.xcodeproj` scheme `App` for an explicit iPhone Simulator destination with `CODE_SIGNING_ALLOWED=YES CODE_SIGN_IDENTITY=- DEVELOPMENT_TEAM=`. The staged project itself supplies the approved company identity and device settings. Development/device signing uses the existing owner-controlled resources in a separate, authorised milestone.

## Verification

| Layer | Result |
| --- | --- |
| Frontend | Node 22.23.3: 103 tests passed; ESLint, TypeScript/Vite production and iOS builds, legal-draft guard, PWA check passed. `npm ci --offline` installed the locked dependencies with zero reported vulnerabilities. |
| Backend | On a disposable SQLite database: 338 passed, 13 skipped, excluding two PostgreSQL-specific insights aggregation tests. A full SQLite attempt had those two failures because SQLite cannot compile PostgreSQL `aggregate_order_by`; this does not establish their PostgreSQL result. Focused Collection/BGG/retention tests: 28 passed. |
| PostgreSQL/migrations | Not verified locally: no disposable PostgreSQL URL or running Docker daemon was available. `alembic check` was not run against an unknown or production schema. Run full PostgreSQL CI and migration checks before integration or release. |
| Final simulator | Xcode 27.2 built and installed the Render-configured company stage on iPhone 18 Pro, iOS 27.2. `simctl launch` succeeded; the login screen was visually captured. Compiled Info.plist reports the company bundle, device family `[1]` and portrait orientation. The binary is ad hoc simulator signed, not company distribution signed. |
| Synthetic simulator | A disposable localhost fixture on a separate iPhone Air, iOS 27.2, verified login, Picker criteria/recommendation, Collection/Add Game entry, Discover, Insights Play history, Settings/Profile, deletion confirmation reachability, Keychain restoration after force quit, logout and logged-out restart. Fixture 404s limited rankings and deeper Game Night. No real account or Render write was used. The fixture app was uninstalled afterward. |
| Visual/accessibility | Light at standard Large and Dark at Accessibility Medium were inspected. The enlarged Discover heading, Collection filter/search and horizontally scrollable bottom navigation were retested after corrections; search focus and toolbar dismissal worked. Actual software-keyboard display, VoiceOver speech and physical-device behavior were not rerun in this milestone. Prior physical evidence remains historical, not proof for this RC. |
| Assets/privacy | Final `dist`, synced iOS public assets and compiled `.app` include the approved HTTPS Render origin; they contain no `127.0.0.1:8767` fixture endpoint, synthetic credential or legal draft marker. A third-party router bundle still contains an inert `http://localhost` fallback string used when no browser location exists; it is not the configured API destination. |

Reviewable captures: [final Render login](screenshots/sp-ios-11/final-render-login.png), [normal Light Collection](screenshots/sp-ios-11/collection-light-large.png), [enlarged Dark Collection](screenshots/sp-ios-11/collection-dark-accessibility-medium.png), [enlarged Dark Discover](screenshots/sp-ios-11/discover-dark-accessibility-medium.png). Earlier 10A/10B captures remain in their milestone folders.

## Open gates

**Submission blockers:** approved public ShelfPick privacy policy and in-app link; maintained Free App Review account; six rights-safe final feature screenshots; accurate App Privacy/age disclosures and legal sign-off; company distribution signing/archive and authorised App Store Connect workflow; full PostgreSQL/migration CI. The account-deletion form is reachable, but completion must use a disposable account. No account was deleted.

**Risks and unverified checks:** verification/reset and Game Night links use the web fallback without Universal Links; the launch-dark interval has not been conclusively resolved; the synthetic fixture did not cover full Game Night voting, adding/recording mutations or live Render authentication; final RC has no fresh physical VoiceOver, keyboard or pinch evidence. At enlarged text, the bottom nav scrolls horizontally to reveal all destinations. No Picker scoring, entitlement, backend or production configuration changed.
