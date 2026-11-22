# ShelfPick release lanes (fastlane)

Local iOS release tooling for the studio Mac. Follows `pluto-standards/standards/IOS-RELEASE-PIPELINE.md`.
Nothing here submits to App Review, goes to external testers, changes pricing, or touches App Store
Connect metadata. It builds, checks, and (only on request) uploads one exact IPA to internal TestFlight.

Lanes live in `fastlane/Fastfile`. Fastlane regenerates `fastlane/README.md` on every run; that file is git-ignored,
so this page is the human documentation.

## One-time setup

1. `bundle install` in the repo root (pinned fastlane 2.241.2; gems go to `vendor/bundle`, which is git-ignored).
2. Create `~/.config/pluto/asc/shelfpick.env` with three lines. It lives outside the repo and is never committed:

   ```
   ASC_KEY_ID=...
   ASC_ISSUER_ID=...
   ASC_KEY_PATH=/path/to/AuthKey_XXXXXXXXXX.p8
   ```

   The key is an App Store Connect API key created by the owner (Users and Access, Integrations). Ripple Links
   already has one; a team key works for every app on the team, so `ASC_KEY_PATH` may point at the same file.
   Use the smallest role that can upload builds. Override the file location with `SHELFPICK_ASC_ENV`.
3. Node 22.23.3 through `fnm` (the lanes call `fnm exec --using=22.23.3`).
4. A UTF-8 locale for fastlane: `export LC_ALL=en_US.UTF-8 LANG=en_US.UTF-8`.

Always run through bundler: `bundle exec fastlane ios <lane> ...`

## Lanes

| Lane | What it does | Changes anything remote? |
| --- | --- | --- |
| `preflight` | Checks the key file has its three names (values never shown), prints the repo commit and whether the tree is dirty, and asks TestFlight for the latest build number and the next one. | No (read-only) |
| `build version:1.2 [build:17] [purchases:true] [allow_dirty:true]` | Runs `npm test` and `npm run lint`, builds the iOS web bundle, stages the company project (`prepare-ios-company.mjs`), archives and exports a signed App Store IPA into `build/ShelfPick-<version>-<build>/`, checks the IPA, and writes `build/shelfpick-build-record.json` (path, SHA-256, source commit, dirty flag, purchases flag). Never uploads. | No (reads TestFlight only to pick the next build number when `build:` is not given) |
| `upload approve:<8 chars>` | Uploads the exact recorded IPA to **internal** TestFlight after re-checking its SHA-256. Refuses unless `approve:` is the first 8 characters of that hash, which the build lane prints. No review submission, no external testers. | Yes: one TestFlight upload |

## Safeguards

- **Purchases default to off.** `purchases:true` sets `VITE_PURCHASES_ENABLED=true` for that build only (nothing is
  committed) and prints a reminder that the live Privacy and Terms pages must cover purchases before App Review. The
  Privacy and Terms links are in every build, with purchases on or off.
- **A dirty tree is refused** unless `allow_dirty:true`, and the record says whether it was dirty.
- **Version is explicit.** There is no default, so a build can't silently reuse an approved version number
  (Apple rejects an upload to a version that is already approved).
- **The in-app version must match.** Before any tests or archive, the lane reads `APP_VERSION` and `APP_BUILD` from
  `frontend/src/app-links.ts` and refuses unless they equal the `version:` and the build number being archived. Settings,
  About, What's new and the feedback payload report these constants, and they once stayed at 1.1 (11) through builds 18
  to 21. Bump them, commit, then build.
- **IPA checks** before the record is written: bundle ID, version, build, Apple Distribution signature for team
  `9CDNVY8UKQ`, privacy manifest present, exactly one public RevenueCat key, and the web bundle's effective purchase state
  (a marker compiled in by `frontend/src/purchases-flag.ts`) equals the requested `purchases:` value, with both the
  Privacy Policy and Terms URLs present (`fastlane/bundle_flags.rb`; test: `ruby fastlane/test/bundle_flags_test.rb`).
- **Signing:** automatic, team `9CDNVY8UKQ`. If Xcode finds more than one distribution certificate, set
  `SHELFPICK_SIGNING_CERT` to the certificate's SHA-1 for that run. macOS may show a keychain prompt on export, sometimes behind other windows;
  choose Always Allow. The export step waits (it once waited over two hours) until it is answered.

## Not covered (still manual or separate)

Submitting for review, release notes and screenshots, pricing, subscription/IAP setup, App Privacy answers, and
TestFlight tester management. Device and VoiceOver checks remain the owner's.
