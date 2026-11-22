# SP-HOTFIX-01: 1.2.1 hotfix

Branch `sp-hotfix-01` from `origin/main` e84a2eb. Five findings from the 22 Nov 2026 review of 1.2 (22). Nothing deployed,
submitted, tagged or pushed. In-app version prepared as 1.2.1 (23); the release lane still takes the build number from
TestFlight and refuses a mismatch.

| Finding | Change |
| --- | --- |
| SP-STORE-R01 | Analytics start only from a stored "on". `AnalyticsChoice` asks once at first launch (Share usage data / Not now); Settings > Help > About withdraws. Missing, unreadable or unrecognised preference is off and loads no SDK. Guests on `/game-night/join` are not asked. |
| SP-STORE-R02 | `VITE_PURCHASES_ENABLED` replaces `VITE_PUBLIC_LEGAL_LINKS_ENABLED`. Privacy and Terms links show in Settings and the paywall in every build. `fastlane/bundle_flags.rb` reads the effective purchase state and both URLs out of the archived bundle. |
| SP-SCORE-R01 | An edited play whose pinned sheet fails to load shows Retry, disables Save, and offers no sheet picker. "Convert to plain scores" needs an inline confirmation, also when the sheet is loaded. |
| SP-PRO-R01 | `ProStore` split into `bind` and `loadOffers`; `restore` and `purchase` take the account and sign the SDK in first, in order. Restore is enabled once the SDK is bound to the current account, whether or not plans loaded. Flows stop and discard answers once the account is no longer current. |
| SP-PRO-R04 | Only an explicit null expiry on the one-time product is lifetime. A present but unreadable expiry (or grace expiry), a missing key, or null on a subscription raises `RevenueCatUnavailableError`: row untouched, 502, warning logged with the product ID. |

Unchanged: server-verified user-scoped checks and access-time expiry, the plain-object SDK adapter, scoresheet versions and
ranking, schema and migrations.

Behaviour changes for the owner to know: existing installs with no stored choice see the prompt once (1.2 collected by
default); the PWA now shows Privacy and Terms in Settings.
