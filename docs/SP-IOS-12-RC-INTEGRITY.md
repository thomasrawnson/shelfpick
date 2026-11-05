# SP-IOS-12 — release-candidate integrity and local gate

5 November 2026. Candidate: `codex/sp-ios-11`, based on `b2fef84486c6dbfd4edd43650a07309b41978c69`. `origin/main` still pointed to that SHA. Its latest CI run, [42023371095](https://github.com/thomasrawnson/shelfpick/actions/runs/42023371095), passed the frontend and PostgreSQL backend jobs. This candidate has **not** run remote CI.

## Manifest and scope

The commit contains the approved Capacitor project, company staging configuration and assets, Keychain session adapter and tests, iOS Dynamic Type and safe-area styles, accepted onboarding/import guidance and six compatible avatar choices, accepted SP-IOS-10B visual corrections, milestone reports and their simulator evidence. The backend, migrations, BGG search, Picker scoring, entitlements and production configuration are unchanged. The exact path manifest is supplied separately with the review package.

The staged source contains no review-fixture script, test credentials, local API origin, built `dist`, synced WebView assets, `node_modules` or DerivedData. Historical reports mention localhost fixture testing; this is evidence, not application configuration. One existing frontend API fallback references localhost for development. The built iOS application contains the approved HTTPS Render API origin and no synthetic fixture origin. The source Capacitor project retains its provisional bundle ID; `prepare-ios-company.mjs` produces the company candidate. Its compiled Info.plist has `com.plutonightlabs.shelfpick`, device family `[1]` and portrait orientation. No Apple signing resource changed.

## Local checks

| Check | Result |
| --- | --- |
| Frontend `npm test`, ESLint | 103 passed; lint passed under Node 22.23.3. |
| Web `npm run build`, legal-draft guard, `check:pwa` | Passed with explicit approved Render origin. The initial build without that environment variable failed its fail-closed legal-draft guard; the configured rerun passed. |
| `npm run build:ios` and Capacitor sync | Passed; HTTPS API-origin and disabled legal-draft checks passed. |
| Backend pytest, disposable SQLite with model tables created | 338 passed, 13 skipped, 2 PostgreSQL-specific tests deselected. The initial attempt without tables failed; the fresh, schema-initialised rerun passed. |
| PostgreSQL tests and `alembic check` | **Unverified locally.** Docker daemon and a verified disposable PostgreSQL instance were unavailable. SQLite is not a substitute. Require candidate PR CI with clean PostgreSQL migrations, model alignment and all PostgreSQL tests. |
| Xcode iPhone Simulator build, install and launch | Passed on iPhone 18 Pro, iOS 27.2, using an unsigned staged company build. Logged-out login UI visibly rendered. No real account or physical iPhone was used. |
| Enlarged text | Existing SP-IOS-11 simulator Collection/Discover evidence inspected. Focused repeat at Accessibility Medium on login showed larger text, wrapped heading and reachable controls. It does not repeat authenticated navigation or physical VoiceOver. |
| `git diff --check` | Passed before commit. |

Evidence: [Large login](screenshots/sp-ios-12/login-large.png), [Accessibility Medium login](screenshots/sp-ios-12/login-accessibility-medium.png), [enlarged Collection](screenshots/sp-ios-11/collection-dark-accessibility-medium.png), [enlarged Discover](screenshots/sp-ios-11/discover-dark-accessibility-medium.png).

## Release gates

The in-app account-deletion form remains reachable, but was not executed. Settings links to Privacy Policy and Terms are still explicitly labelled **draft** and disabled in production/iOS builds. Before submission, publish an approved public ShelfPick privacy policy and link it in the app. A maintained Free App Review account, rights-safe final feature screenshots, App Privacy/age and legal approval, and company distribution signing/archive are also outstanding. Verification/reset and Game Night links still use web fallback rather than Universal Links. Physical accessibility, keyboard and session checks from earlier milestones are historical and were not rerun for this commit.

No push, PR, merge, deployment, production data operation or App Store action occurred.
