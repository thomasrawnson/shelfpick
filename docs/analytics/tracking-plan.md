# ShelfPick tracking plan (SP-ANL-001)

Anonymous product analytics through PostHog EU Cloud (`https://eu.i.posthog.com`). Source of truth in code: `frontend/src/analytics/core.ts` (`EVENT_SPECS`). `frontend/src/analytics.test.mjs` fails if this table and the code disagree.

## Rules

- Anonymous only: no `identify`, no email, name or account ID, no person profiles (`person_profiles: "never"`). PostHog assigns a random device ID stored in `localStorage` (no cookies).
- No free text, ever. Every property is an enumerated value, a whole-number count (0 to 999) or a boolean. The wrapper drops the whole event if a property is unknown, out of range or looks like an email.
- No game IDs or names are sent today. Public-catalogue IDs may be added later by editing `EVENT_SPECS` and this plan together.
- Off until the person chooses. The one-time first-launch choice ("Share usage data" / "Not now") stores the answer; nothing is initialised or sent without a stored "on", and a missing or unreadable preference counts as off. Settings > Help > About ("Share anonymous usage analytics") withdraws it: the SDK is opted out and nothing more is sent. (SP-HOTFIX-01)
- Disabled in the SDK: session replay, autocapture, rage/dead clicks, heatmaps, pageviews, exception capture, performance capture, feature flags, surveys, web experiments. `before_send` also drops anything not listed below and strips URL/path/referrer properties (reset-password links carry tokens).
- Every event also carries `environment` (`dev` or `production`), `platform` (`ios` or `web`) and `app_version` (build commit SHA). `environment` is `production` only for a production build made with `VITE_ANALYTICS_ENV=production`; every other build is tagged `dev`. Filter dev out in PostHog (`environment = production`).

## Features

Onboarding, BoardGameGeek and BG Stats collection import, collection search/add, wishlist ("Want to Play"), Picker, Game Night (hosted voting), Discover, play logging, Insights and recaps, rankings, live timer, Settings.

## Events

| Event | When it fires | Properties | Question it answers |
|---|---|---|---|
| `app_installed` | First launch of the app on a device after analytics shipped | none | How many new devices start using ShelfPick? (Existing users fire this once after updating to this release.) |
| `app_updated` | First launch after the build changed | none | How quickly do users move to a new version? |
| `app_opened` | App launched or brought to the foreground | none | How often is the app used, and is retention healthy (daily/weekly return)? |
| `app_backgrounded` | App sent to the background | none | How long are sessions? |
| `onboarding_completed` | User finishes the setup flow | `player_count`, `time_band` | How many sign-ups finish onboarding, and what are the starting preferences? |
| `collection_import_completed` | A BGG sync or BG Stats import succeeds | `source`, `result_count` | Which import route is used and how large are the shelves? |
| `game_added` | A game is added to Owned (onboarding search, Add Game search, or moved from Want to Play) | `source` | Where do collections grow from? |
| `wishlist_added` | A game is added to Want to Play | `source` | Does Discover drive wishlist adds? |
| `pick_started` | Picker requests matches | `source`, `player_count`, `time_band` | How often is the core feature used, with what group size and time? |
| `picker_completed` | Picker returns a result | `source`, `player_count`, `time_band`, `result_count` | Where does Picker fail to find matches (`result_count` 0)? Compare with `pick_started` for drop-off. |
| `game_night_completed` | A Game Night game is chosen (once per session) | `source`, `player_count`, `time_band`, `result_count` | Is the group flow finished? |
| `discover_opened` | A Discover tab is shown | `tab` | Which discovery source is used? |
| `play_logged` | A play is saved | `source`, `player_count`, `has_scores` | Do users keep logging plays (retention driver)? |
| `settings_changed` | Theme changed, or analytics switched on | `setting`, `value` | Which settings matter? (Switching analytics off sends nothing.) |

## Property values

| Property | Values |
|---|---|
| `source` | `onboarding_bgg`, `settings_bgg`, `settings_bgstats` (import); `onboarding_search`, `collection_search`, `wishlist_move` (game_added); `discover`, `collection_search` (wishlist_added); `pick`; `game_night`; `play_log_form` |
| `tab` | `hot`, `top500`, `for_you` |
| `time_band` | `any`, `up_to_30`, `up_to_60`, `up_to_90`, `up_to_120`, `over_120` |
| `player_count`, `result_count` | whole number 0 to 999 |
| `has_scores` | `true` / `false` |
| `setting` / `value` | `theme` with `system`, `light`, `dark`, `black`; `analytics` with `on` |
