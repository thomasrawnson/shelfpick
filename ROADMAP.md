# ShelfPick engineering roadmap

This is ShelfPick's development-facing delivery roadmap for Codex and
contributors. Notion remains the broader product and business source of truth.
The production runbook continues to own deployment, email, migration and
backup verification; those release safeguards remain required even when the
product work below is the current engineering priority.

## How Codex should use this roadmap

- Treat `ROADMAP.md` as the engineering delivery roadmap.
- Work one slice at a time.
- Do not pull later-slice features forward unless they are required as a
  dependency for the active slice.
- Prefer the smallest complete implementation that satisfies the active
  slice's acceptance criteria.
- Preserve the existing architecture unless there is a strong, documented
  reason to change it.
- Read `DESIGN.md` before UI work.
- Read the applicable `AGENTS.md` files before making changes.
- Update the status in this roadmap when a slice is completed.
- Do not mark a slice complete until its tests and required validation pass.

## Current priority — beta on hold (28 September 2026)

**External beta testing is ON HOLD at Tom's request.** The requested pre-beta
backlog and acceptance criteria are in `docs/pre-beta-work-plan-2026-09-28.md`.
Complete SP-PB01–20 in the documented sequence, resolve the marked decisions,
and validate the work before asking Tom to resume beta. Internal testing
continues. This instruction supersedes older immediate-beta and post-launch
timing below; existing completed slices remain historical implementation facts.

SP-PB01 is complete. Picker Log a play now opens a dedicated `/picker/log-play`
screen while the parent Picker route remains mounted, preserving its selected
game, named players or count-only rows, criteria, recommendation set and result
position for Cancel and browser Back. The shared play form and API remain in
use. Save is single-submit guarded, retains values on validation/network errors,
returns to the same result with confirmation, and direct navigation without an
active result offers a safe route back to Picker.

Evidence: focused frontend route/render tests, lint, build and colour checks
passed; mocked Playwright covered prefill, validation and network recovery,
rapid duplicate clicks, one-save confirmation, Cancel/Back restoration, direct
navigation, keyboard focus, action reachability, navigation clearance and no
horizontal overflow at 390, 768, 1024 and 1440px in light/dark. The configured
non-production PostgreSQL repository/API checks passed with isolated test data.
Screenshots are in `docs/screenshots/sp-pb01/`. Beta remains on hold.

SP-PB02 is blocked on an authorised ranked-data source. Investigation confirmed
that the existing implementation already enforces original BGG ranks 1–100
before ownership filtering and candidate limiting, preserves Hot and For You
cache/scoring behaviour, and reports an unavailable ranked source as an error
rather than an empty list. The remaining live failure is source retrieval: the
runtime ranked-page request returns HTTP 403, while the configured development
BGG application token is not authorised to download BGG's official ranks data
dump. No Hot substitution, rank >100 backfill or unpermitted scraper was added.

Evidence: 38 focused backend tests and 35 frontend tests passed, as did the
frontend build, lint, colour-token guard and PWA checks. Mocked Playwright
covered the Top 100 boundary result and source-error/retry states at 390 and
1440px in light/dark with no horizontal overflow; captures are in
`docs/screenshots/sp-pb02/`. Cold live retrieval remains unavailable, so the
required cold/warm/stale/restart acceptance sequence cannot pass and SP-PB02 is
not complete. Resume it when the configured application receives official BGG
ranks-dump access or an authorised official dump is supplied for ingestion.

SP-PB05 is complete as an independent UI slice. Settings is now a grouped
overview whose Profile, Preferences, Appearance, Collection & Data, Plays, Pro,
Help and About rows open focused routes. Existing save/import APIs and `/setup`,
Profile and Pro deep links remain intact. Collection & Data no longer renders
unrelated account/profile controls, and both explicit Back and browser Back
restore focus to the originating overview row. Focused tests and all frontend
checks passed; mocked Playwright covered navigation, direct routes, persisted
theme/profile preferences, keyboard focus, nav clearance and overflow at 390
and 1440px in both themes. Captures are in `docs/screenshots/sp-pb05/`. That
slice left Add game to SP-PB09 and broader copy cleanup to SP-PB20; both are
recorded complete below.

SP-PB09 add-game discoverability is complete. Collection now presents a
labelled Add game action on populated and filtered-no-match shelves, plus a
primary empty-shelf action and the existing Collection & Data BGG-import route.
The existing search/add API flow is unchanged; it now provides labelled input,
focus entry/return and explicit success/no-results feedback while retaining
duplicate and failed-add recovery. Filters, sorting and Collection state survive
Cancel and browser Back. Forty-two frontend tests and all frontend checks
passed; mocked Playwright covered the flow at 390 and 1440px in both themes.
Captures are in `docs/screenshots/sp-pb09/`. Broader proposed filters were not
pulled into this bounded discoverability slice; SP-PB20 is recorded complete
below.

SP-PB20 is complete. Picker, Collection, Discover, Rankings, Insights, Game
Night and Settings now use one clear page heading in their validated primary
states, without repeated category eyebrows or generic subtitles. Ranking's two
page headings were consolidated, and Insights keeps a stable heading while
loading or reporting an error. Decision-supporting, personalised/fallback,
empty/error recovery, entitlement, attribution, validation and accessibility
copy remains intact. All 42 frontend tests and checks passed; mocked Playwright
covered all seven screens at 390 and 1440px in both themes with one `h1`, visible
keyboard focus, navigation clearance and no overflow. Captures are in
`docs/screenshots/sp-pb20/`.

SP-PB03 is complete. The Picker no longer presents an editable numeric count
alongside a named-player selection. Named-player mode derives and displays one
authoritative count, keeps the selected names available through Edit players,
and offers an explicit switch to count-only mode; the numeric control remains
available when no names are selected. Forward/Back navigation, recommendation
requests and the SP-PB01 play-entry prefill continue to consume that same
session state. Forty-four frontend tests and all frontend checks passed.
Mocked Playwright covered the state transitions, play-entry prefill and result
restoration at 390 and 1440px in light/dark; captures are in
`docs/screenshots/sp-pb03/`. SP-PB04 is recorded complete below; SP-PB02
remains blocked and beta remains on hold.

SP-PB04 is complete with its scope expanded to all saved Picker defaults.
Settings → Preferences persists usual player count, preferred play time and
play style through the existing profile endpoint; preference-only saves no
longer resubmit hidden identity fields. A fresh Picker snapshots the latest
saved values, named players remain authoritative, session overrides survive
forward/Back and play entry without changing the profile, and Start over
reapplies the latest defaults. Missing/legacy play style falls back to no
preference. Frontend and focused backend tests/checks passed. The new nullable
column migrated cleanly and save/reload was verified with isolated PostgreSQL
data that was removed afterward. Mocked responsive browser evidence is in
`docs/screenshots/sp-pb04/`. SP-PB02 remains blocked and beta remains on hold.

After SP-PB02 is unblocked, address
Picker defaults/navigation, UI and Settings, plays/statistics/sharing, ranking
intelligence, scanning, avatars, Game Night voting and Pro challenges. New Pro
scope is live duration, ranking-based recommendation enhancements and challenges.
Picker scoring use is optional pending Discover evaluation; other new access
boundaries are not silently changed. Keep purchase claims limited to working
features.

**Pre-beta priority 1 — UI/layout redesign (UI-1, UI-2A and UI-2B complete)**

Before Private Beta, product work is prioritised in this order:

1. UI/layout redesign;
2. logo/brand correction (approved illustrated shelf icon complete);
3. Free versus Pro proposition.

The UI/layout work proceeds as UI-1 confirmed defects, UI-2 core visual polish,
then UI-3 full-width, content-forward desktop redesign. UI-1 covers resilient
BoardGameGeek artwork, bottom-navigation clearance, dark-mode inactive-control
contrast, more readable Collection rows, accurate sparse/empty-state copy, and
targeted legacy colour/`!important` cleanup. UI-2 refines hierarchy, typography,
spacing, component consistency and responsive polish after those defects are
stable. UI-3 gives artwork and content more desktop space without pulling its
future card/grid treatment into UI-1.

UI-1B is complete. The fixed primary navigation now retains the intended
128px content clearance plus the device safe-area inset because its definitive
spacing is no longer reduced by a later app-shell shorthand. Playwright
verified the end of long Collection, Discover and Insights pages remains above
the navigation at mobile widths, and enabled inactive controls use the existing
primary-text token in dark mode.

The **Top 100** correction is complete. For `mode="top100"`, candidates must
have an original ranked-source position from 1 through 100 before ownership
filtering and the existing 30-item metadata limit. Missing, invalid and
above-100 ranks are not eligible, and owned games do not cause lower-ranked
games to fill vacancies. The ranked source and its 500-candidate fresh, warm
and stale caches remain available to personalised Discover.

Customer-facing Discover, empty-state and Free/Pro comparison copy now says
**Top 100**. API identifiers, routes/query parameters, saved state, telemetry
keys, recommendation scoring and access rules are unchanged. BoardGameGeek's
ranked-page 403 remains an external availability issue.

UI-1C is complete. Collection now distinguishes an empty shelf from active
filters with no matches; Picker identifies an empty owned shelf without
blaming the selected criteria; and Insights separates no recorded plays from
recorded plays that lack participant data for group insights. Want to
Play, Discover and each changed Insights state provide an existing-route or
existing-control recovery action. Discover source errors, genuine no-match
results, locally dismissed lists and the locked For You state remain distinct.
Focused backend/frontend tests, lint, build and colour validation passed.
Deterministic Playwright fixtures covered 40 mobile/desktop light/dark state
checks, while a separate read-only live-account pass confirmed the five main
routes across the established responsive widths.

UI-2A is complete. Picker results now present artwork, the unchanged match
value, game name, fit explanation and actions in a clearer reading order. The
match value is no longer overlaid on artwork; supporting fit details and the
existing reason disclosure remain available without competing with the primary
Log a play action. Try another and Start over retain their existing behaviour
as secondary and tertiary actions. No recommendation, suitability, flow,
route, state or access logic changed. Deterministic Playwright fixtures covered
populated, long-title, missing-artwork, no-match and error states at 390, 768,
1024 and 1440px in both themes, including keyboard focus, reachable actions,
horizontal overflow and the one-play Insights facts regression.

UI-2B is complete. Owned and Want to Play lists now give contained cover art,
wrapping game titles and factual game metadata a consistent scan order. Owned
rows show positive play counts without repeating the ambiguous “Not played”
label, and both detail paths use the established resilient artwork fallback.
The existing bounded desktop list, actions, filters, sorting, section state,
routes and scroll restoration remain unchanged. Frontend checks passed, and
deterministic mocked Playwright coverage exercised both lists and details at
390, 768, 1024 and 1440px in light and dark themes, including empty,
filtered-empty, loading, error, long-title, missing/failed-artwork, keyboard,
overflow, both list → detail → browser Back paths, and independent Owned/Want
to Play scroll restoration. No live account or backend data was used or
changed.

The Roadmap Slice 4 Free versus Pro presentation reconciliation completed on
28 September 2026. The comparison now leads with three implemented Pro
benefits: more personal For You and count-based Picker recommendations, live
play timing with an in-app indicator, and host-created Game Night phone voting.
It keeps Collection, core Picker, manual play logging/duration, locations,
personal rankings, branded play sharing and basic Game Night visibly Free.
Creating a phone-voting session is Pro; joining one as a browser guest does not
require an account or Pro. Picker ranking influence is described accurately as
count-based only, not a named-player group preference.

The presentation also records current limitations rather than marketing around
them. Top 100 remains a Free capability by policy but is labelled unavailable
while SP-PB02's authorised ranked source is blocked. Timer copy is limited to
the in-app experience; photo upload is not claimed. The agreed launch model
remains a £3.99 one-off purchase, not a subscription, but no price is configured
and checkout is not implemented. The app therefore shows neither a price nor a
fake Buy/unlock action. Entitlement checks and purchase behaviour are unchanged.
`advanced_stats` remains a granted Pro capability name without a corresponding
separate product surface and is deliberately not marketed.

The truthful For You personalisation-state slice completed on 26 September
2026. The unchanged recommendation path now reports whether collection matches,
recorded play history or saved preferences actually influenced the returned
list. For You labels source-only results as popular fallback, explains their
BoardGameGeek basis and links to existing Profile preferences. Personalised,
fallback, empty, source-error, dismissed and Free-locked states remain distinct;
Hot-only results can still be personalised when ranked candidates are
unavailable. Persistent source resilience and entitlement cleanup remain later
work.

Across all three stages, use “warm shelf, confident choices” as the visual
principle. Game Night remains a separate primary-navigation destination; it is
not merged with Picker. Preserve recommendation rules, exact-player-count
suitability, the BoardGameGeek Not Recommended >=30% exclusion, routes and deep
links, browser Back behaviour, collection state and scroll restoration. Do not
change backend/domain behaviour except where strictly needed for artwork
fallbacks, and do not change the logo or Free/Pro proposition as part of UI-1.

## Status legend

- **NOT STARTED** — no scoped implementation work is underway.
- **IN PROGRESS** — implementation or validation is underway.
- **BLOCKED** — progress requires an unresolved dependency or decision.
- **COMPLETE** — all acceptance criteria and required validation have passed.

## Delivery order

1. SP-PB01 dedicated Picker play logging — COMPLETE.
2. SP-PB02: restore reported Top 100 availability — **BLOCKED** pending an
   authorised official BGG ranked-data source; existing boundary logic verified.
3. SP-PB03–04: selected-player count and saved play-style defaults.
4. SP-PB05 Settings navigation, SP-PB09 Add game discoverability and SP-PB20
   heading/copy cleanup — COMPLETE; SP-PB06–08 remain pending.
5. SP-PB10–11 location and Pro live duration — COMPLETE; SP-PB14 statistics
   remains pending.
6. SP-PB12 branded saved-play sharing — COMPLETE; SP-PB13 monthly recap
   sharing remains pending.
7. SP-PB15 Pro ranking recommendations are COMPLETE; SP-PB16 scanning remains pending;
   SP-PB17 preset avatars are complete. Photo upload is a post-beta follow-up,
   not a beta blocker.
8. SP-PB18 Game Night phone voting — COMPLETE; SP-PB19 Pro challenges remain
   pending.
9. Reconcile Free/Pro claims, complete validation and existing release gates.
10. Resume private beta only after Tom's explicit decision, then public launch.

Outside-app timer visibility is a separate, unsequenced future Pro task rather
than part of SP-PB11. It must begin with a platform and packaging assessment for
the current PWA and any native wrapper. Lock-screen/Live Activity and Android
ongoing-notification approaches are considered only where the supported
platform exposes a reliable lifecycle. A continuously visible timer is not the
same as a one-off notification. Do not promise background execution or request
notification permission until that assessment selects a supported design.

See `docs/pre-beta-work-plan-2026-09-28.md` for dependencies, acceptance criteria
and unresolved choices. Historical slice numbers below are retained.

SP-PB10 and SP-PB11 completed on 28 September 2026. Optional play location is
Free and shared by existing play-entry routes. The Pro timer is account-scoped,
timestamp-derived and recoverable across navigation/refresh, with one persistent
in-app indicator and explicit review before save. Local migration/schema checks,
isolated PostgreSQL persistence, focused frontend/backend tests and mocked
responsive browser validation passed. Follow-up PostgreSQL concurrency checks
also proved one active timer per account, one play per timer session, strict
account/game scoping and retention across tier loss. A real-phone
background/reopen check remains on the pre-beta checklist. Outside-app timer
and notification work remains separate. SP-PB02 remains BLOCKED and beta
remains on hold.

SP-PB12 completed on 28 September 2026 with existing Free access. Persisted
plays now expose a labelled Share play action and an accessible preview that
preserves Collection detail state and returns focus on Close or Escape. One
1200×1500 canvas renderer supplies the preview, native file share and PNG
download; it uses the approved ShelfPick logo, defaults names/location/scores
to private choices, redacts email-like labels, preserves missing scores and
recorded cooperative, tie and shared-win results, and substitutes a branded fallback when
artwork is missing or CORS-blocked. Focused tests, build, changed-file lint and
a mocked 390×844 browser pass passed; actual normal and long-title/fallback PNGs
were inspected. Native OS sharing, real artwork hosts and physical-device
rendering remain pre-beta validation. SP-PB13 remains separate, SP-PB02 remains
BLOCKED and beta remains on hold.

The bounded SP-PB17 preset-avatar subtask completed on 28 September 2026 with
the existing authenticated-user access and no new entitlement. The three
stored avatar IDs remain valid; a shared accessible radio grid adds three
board-game-themed token treatments and feeds the existing initials renderer in
Profile, onboarding, navigation and named-player surfaces. The unchanged
profile save flow retains a new choice after failure and preserves unrelated
preferences. Focused frontend/backend tests, build, changed-file lint, mocked
mobile keyboard/save/reload/Picker checks and `git diff --check` passed; the
capture is under `docs/screenshots/sp-pb17/`. The database schema did not
change. SP-PB17 is complete for its pre-beta preset scope. Photo upload and its
image storage/security acceptance criteria remain recorded as post-beta work
and do not block beta.
SP-PB02 remains BLOCKED and beta remains on hold.

SP-PB15 completed on 28 September 2026. Pro For You now reuses current
per-user Elo-style ranking rows to derive a category/mechanic affinity from at
least four explicitly compared owned games. Low-ranked affinities cancel
high-ranked ones, sparse/tied/unranked data is neutral, and one combined
positive contribution is capped at +3.0 points. A ranking reason and response
signal appear only when that bounded contribution affects a returned result.
The existing backend `personalized_discover` entitlement remains authoritative;
Free personal ranking, Hot and Top 100 behavior is unchanged. Hard ownership,
player/time and exact-count Not Recommended safeguards remain ahead of this
ranking refinement. Focused backend and frontend tests, build, changed-file
lint, mocked mobile copy validation and `git diff --check` passed. Picker
ranking integration then completed as the bounded SP-PB15 follow-up: Pro
count-based Picker requests apply each owned candidate's current ShelfPick Elo
rating directly, require at least four compared games with a non-zero spread,
and add at most -5 to +5 points on Picker's 0–100 scale. Unranked, sparse and
tied data is neutral; Free Picker does not query the signal, and named-player
sessions do not apply it. Hard suitability checks remain authoritative,
and the ranking explanation appears only when the final score actually changes.
No live ranked-source claim is made; SP-PB02 remains BLOCKED, photo upload is
post-beta and beta remains on hold.

## Foundation — Core Picker improvements

**Status:** COMPLETE

### Objective

Make recommendations more useful, explainable and player-count aware.

The repository already provides deterministic recommendation scoring,
play-time and recency signals, exact-count BoardGameGeek poll data, and the
30% Not Recommended exclusion rule. This slice turns those foundations into a
clearer shortlist experience and completes the user-facing controls and
fallback behavior.

### In scope

- Return a 3–5 game shortlist rather than one definitive result.
- Use exact player-count suitability from BoardGameGeek voting data.
- Exclude games where Not Recommended is at least 30% at the selected player
  count.
- Improve recommendation explanations so they cover:
  - player-count fit;
  - time fit;
  - recency;
  - relevant group or history signals.
- Improve empty and fallback states.
- Use buttons or chips for player count.
- Use these initial time presets:
  - `<=30m`;
  - `<=60m`;
  - `<=90m`;
  - `<=120m`;
  - `Any`.

### Explicitly out of scope

- A custom time slider unless later user testing justifies it.
- A major recommendation-engine rewrite unless the scoped behavior cannot be
  delivered safely within the current engine.

### Acceptance criteria

- A completed Picker request returns three to five eligible games when enough
  candidates exist and presents them as a shortlist rather than implying one
  objectively correct choice.
- Exact-count poll evidence drives suitability for the selected player count;
  games with at least 30% Not Recommended votes at that count are excluded
  under the repository's established minimum-evidence rule.
- Every shortlist item explains the player-count and time fit and includes
  relevant recency or history context when data is available.
- Player count is selected with accessible buttons or chips and time is
  selected from the five defined presets.
- Empty, insufficient-data and relaxed-filter outcomes explain what happened
  and provide a useful recovery action without discarding the user's inputs.
- Existing Picker analytics, expansion exclusion, deterministic fallback,
  keyboard operation and responsive behavior continue to work.
- Focused backend and frontend tests pass, along with the validation required
  by the applicable `AGENTS.md` files.

### Dependencies

- Existing BoardGameGeek player-count poll ingestion and stored poll evidence.
- Existing Picker service, eligibility rules, scoring, analytics and API
  contracts.
- Existing play history and reusable participant data for available history
  signals.
- `DESIGN.md` controls, accessibility targets and narrow guided-flow layout.

## Slice 2 — Discover v3

**Status:** COMPLETE

### Objective

Turn Discover into a stronger acquisition and retention feature.

### In scope

- Add three clear tabs:
  - **Hot** — free;
  - **Top 500** — free;
  - **For You** — the personalised, Pro-oriented experience.
- Preserve the current separation between owned games and Want to Play.
- Prepare personalised sections such as:
  - Because you liked…;
  - Great at your usual player count;
  - Under 60 minutes;
  - Matches your preferred complexity;
  - Similar to favourites;
  - Trending games matching your tastes;
  - Good for your regular group.
- Use existing collection, wishlist, plays and available preference data where
  practical.
- Keep Hot and Top 500 on their existing BoardGameGeek sources while exposing
  them as separate lists.
- Gate For You through the central `personalized_discover` entitlement.
- Rank For You candidates using collection affinities, recorded play frequency,
  typical recorded player count and median recorded session duration.
- Reuse Picker exact-count eligibility and BoardGameGeek Not Recommended safety
  when a reliable usual player count is available.
- Fall back to truthful popularity and shelf signals when play history is too
  limited for stronger personalisation.

### Explicitly out of scope

- A completely separate recommendation platform.
- Advanced machine learning.
- Learned preference models, collaborative filtering and cross-user signals.

### Acceptance criteria

- Hot, Top 500 and For You are distinct, accessible tab destinations with
  clear loading, empty, error and retry states.
- Hot and Top 500 remain useful without Pro access.
- For You uses available user signals to produce explainable sections and
  clearly communicates its Pro-oriented status without weakening the free
  tabs.
- Owned games are excluded and Want to Play actions preserve existing
  behavior, rollback and recovery guarantees.
- Direct navigation, mobile layouts and bounded tablet/desktop layouts pass
  the repository's frontend validation.

### Dependencies

- Slice 1 explanation and recommendation patterns where shared.
- Existing Discover hot/ranked sources, caching and fail-open behavior.
- Existing collection, Want to Play and play-history data.
- Preference and entitlement boundaries agreed for the initial For You
  experience.

## Slice 3 — Onboarding + Player Profiles

**Status:** COMPLETE

### Objective

Create a clear first-run experience and establish player identity for future
group features.

### In scope

#### Onboarding

- Welcome screen.
- Message: **“Spend less time choosing. Spend more time playing.”**
- Import from BoardGameGeek.
- Add manually.
- Skip for now.
- Ask typical player count.
- Ask typical play time.
- Ask an optional complexity preference when it remains low-friction.
- Take the user into their first Picker experience.
- Do not lead with a Pro paywall.

#### Player profiles

- Player name.
- Player avatar.
- Replace the generic Settings icon with the current user's avatar where
  appropriate.
- Open Profile / Settings from the avatar.
- Extend the data model only as needed to support future group history and
  preferences without overbuilding them now.

### Explicitly out of scope

- Rich social profiles.
- Messaging.
- Friends or followers.
- Advanced player statistics.

### Acceptance criteria

- A new user can import from BoardGameGeek, add a game manually or skip, then
  set the core Picker defaults and reach a first Picker run without a Pro
  paywall blocking progress.
- Onboarding retains input and offers recovery when import or submission
  fails.
- The current user can set a name and avatar, see that avatar in the
  appropriate app control, and open Profile / Settings from it with an
  accurate accessible name.
- Existing play-participant identities remain intact and are not silently
  conflated with authenticated accounts.
- Any schema change has a compatible Alembic migration and the relevant
  backend, frontend and responsive validation passes.

### Dependencies

- Slice 1's first-Picker destination and preset choices.
- Existing authentication onboarding, collection import and manual-add flows.
- A documented distinction between the authenticated user's profile and the
  reusable participant identities already attached to plays.
- Existing avatar-capable navigation and settings patterns from `DESIGN.md`.

### Implementation notes

- New accounts complete a four-step welcome, shelf, usual-play and identity flow, then enter Pick. BGG sync and manual collection search/add reuse the existing endpoints; BG Stats import remains available in Setup.
- `users.onboarding_completed` is the first-run gate. The additive migration marks all accounts present at upgrade as completed, so established users are not forced through setup. New accounts begin incomplete and can safely skip shelf and preferences.
- `users.preferred_player_count` and `users.preferred_play_time` are the single saved preference source. Pick uses both as editable defaults, Discover For You reads both, and Game Night uses the time default while its headcount continues to come from selected players. `0` means no time limit. Complexity remains a per-session Pick choice.
- The signed-in user links explicitly to a `Player` row through `users.profile_player_id`. Matching names are not silently merged with historical participants; existing accounts without a link retain a name/initials fallback and can create their linked identity in Profile. `players.avatar_key` uses three token-based initials treatments, with no image hosting.
- Profile editing lives within the existing Setup route. The broader Settings and Pro foundations work remains Slice 4, followed by Private Beta readiness in Slice 5.

## Slice 4 — Settings + Pro foundations

**Status:** IN PROGRESS — comparison presentation complete; checkout and remaining commercial foundations pending

The shared FREE/PRO tier resolution, frontend-facing entitlement list, central
feature-capability checks and truthful Free/Pro comparison are complete. The
agreed launch price is £3.99 as a one-off purchase, but no price is configured
and checkout is not implemented; purchase and recovery work remains pending.

The launch offer is a useful Free version plus a £3.99 one-off ShelfPick Pro
unlock. Pro is not a subscription.

### Objective

Create a structured, production-quality settings experience and clearly
communicate Free versus Pro.

### In scope

- **Profile**
  - avatar;
  - player name and details.
- **ShelfPick Pro**
  - Unlock Pro;
  - Free versus Pro comparison;
  - one-off purchase placeholder until checkout is implemented.
- **Collection & Data**
  - Sync Collection with BoardGameGeek;
  - Cloud Sync;
  - Import Data;
  - Export Data.
- **Appearance**
  - System;
  - Light;
  - Dark.
- **Plays**
  - Play Challenges entry point;
  - future live-play defaults and location preferences.
- **Help**
  - What's New;
  - Feedback;
  - Report a Bug;
  - Roadmap;
  - Privacy Policy.
- **About**
  - app version;
  - Pluto Night Labs;
  - Pluto Night Labs landing-page link.
- **Support ShelfPick**
  - Tip Jar.

Free functionality remains useful and includes Collection, Wishlist, Core
Picker, basic play tracking, Discover Hot and Discover Top 100. Pro candidates
include personalised Discover, advanced recommendation intelligence, richer
statistics and enhanced Game Night features. Basic backup and data safety are
treated separately from arbitrary Pro gating.

### Explicitly out of scope

- Fully implementing payment infrastructure unless it is already part of the
  scoped system when this slice begins.
- Language and internationalisation support.

### Acceptance criteria

- Settings presents the listed sections with clear information hierarchy,
  accessible navigation and honest labels for functional, placeholder and
  future controls.
- System, Light and Dark appearance choices work consistently with the
  established ShelfPick themes.
- Free versus Pro messaging matches the boundaries in this roadmap and does
  not put basic collection, Picker, play tracking or data safety behind Pro.
- Data actions reuse established import, export and sync behavior and retain
  existing recovery protections.
- Placeholder purchase actions cannot imply that an unlock occurred.
- Relevant tests, accessibility checks and responsive validation pass.

### Dependencies

- Slice 2 entitlement boundary for For You.
- Slice 3 profile and avatar model.
- Production privacy, feedback and account-management requirements tracked by
  the release roadmap and runbook.
- Configure the agreed £3.99 one-off price and implement payment before a real
  Pro unlock.

## Slice 1 — Game Night MVP + entitlement scaffolding

**Status:** COMPLETE

### Objective

Put ShelfPick's strongest group differentiator in testers' hands before
Private Beta without overbuilding it.

### In scope

- Start a Game Night.
- Select attendees from existing player profiles.
- Use the exact attendee count for player-count suitability.
- Use play history for the specific selected subset of attendees where
  available.
- Include eligible games owned by any selected attendee where linked
  collections are available.
- Capture available time and simple exclusions.
- Produce a 3–5 game shortlist.
- Explain why each game fits this particular group.
- Allow selection and reveal of the final game.
- Reuse the Core Picker recommendation logic rather than creating a second
  engine.
- Gate access through the central `game_night_basic` entitlement while keeping
  that capability available to FREE beta accounts.
- Fall back to the host's collection until attendee-linked ownership exists.

### Explicitly out of scope

- Guest invite links.
- QR joining.
- Real-time multiplayer session state.
- Voting or veto systems.
- Shared remote lobbies.
- Chat or messaging.
- Complex host permissions.
- Calendar scheduling.
- Club or cafe functionality.
- Advanced Game Night statistics.

### Coming after MVP / beta validation

- Guest invite links and phone voting — delivered by SP-PB18.
- Saved regular groups.
- Single-choice voting and shared results — delivered by SP-PB18; vetoes remain
  future work.
- Better cross-user collection linking.
- Group preference learning.
- Game Night history and recaps.
- Re-run recommendations when attendance changes.
- Group-specific statistics.
- Scheduling and recurring Game Nights.
- Club and cafe hosting tools.

### SP-PB18 follow-up — COMPLETE, 28 September 2026

Pro hosts can explicitly open phone voting for the existing immutable 3–5 game
shortlist. ShelfPick creates a 12-hour, unguessable session-scoped join token,
builds the join URL from the configured frontend origin and renders that exact
URL as an accessible QR code with a copy fallback. Guests need only a bounded
display name. A hashed browser credential restores that guest's single
authoritative ballot after refresh and supports idempotent retries, vote
changes and explicit abstention while voting remains open.

The backend restricts open/status/close controls to the authenticated owner and
the existing `game_night_enhanced` Pro entitlement. Public session responses
contain only the shortlist and voting state, never collection, account or play
history. Sessions accept at most 20 guests; joins reuse the established bounded
request limiter. The host sees participation rather than live tally influence,
closes voting explicitly, then receives truthful winner, tie or no-vote
results and still confirms the final game through the existing reveal/log flow.
Basic Game Night remains Free through `game_night_basic`.

Guest identity is intentionally browser/session scoped: it cannot prove one
real person has not joined from a different browser or device. No account
registration, chat, invitations, push, public directory, WebSocket or new
navigation was added. SP-PB02 remains BLOCKED, photo upload remains post-beta
and beta remains on hold.

### Acceptance criteria

A host can select a real group, enter the key constraints and receive an
explainable shortlist that is materially more useful than running the normal
Picker with only a player count.

In addition:

- The shortlist uses the exact attendee count, excludes unsuitable games and
  explains group-specific history or ownership signals when they are
  available.
- The host can select and reveal a final game without losing the attendee or
  constraint context.
- Missing linked collections or history degrade clearly and usefully rather
  than blocking the whole flow.
- The implementation reuses shared Picker rules and passes focused backend,
  frontend, accessibility and responsive validation.

### Dependencies

- Slice 1 shortlist, suitability and explanation behavior.
- Slice 3 player profiles and a safe mapping to existing play participants.
- Slice 4's initial Free/Pro boundary, without requiring payment
  infrastructure for MVP validation.
- An agreed minimal approach for linked collections that preserves user data
  isolation and existing API boundaries.

## Slice 5 — Private Beta readiness

**Status:** ON HOLD — external beta paused 28 September 2026; client instrumentation foundation complete, internal validation continues

T01 production configuration and Apple Silicon setup is complete in the
repository: local, CI and Render runtimes align on Python 3.12 and Node 22,
production requires a server-side BoardGameGeek token, and native arm64 setup
is documented. Live Render configuration and verification remain operational
steps rather than repository work.

Do not invite beta testers yet. Complete the requested SP-PB backlog, resolve
its open decisions and obtain Tom's decision to resume. Before inviting users,
complete the production deployment, migration, email and backup/recovery checks
in `docs/production-runbook.md`.

Beta should explicitly test:

- Picker usefulness;
- Discover usage;
- onboarding comprehension;
- Game Night usability;
- whether Game Night adds meaningful value over the normal Picker;
- which post-MVP Game Night features users actually request;
- Free versus Pro comprehension.

Use the evidence to revise later scope rather than treating requested features
as automatic commitments.

The frontend now emits a small, typed set of core-journey events and has a
render-error boundary with a provider-neutral capture hook. No analytics or
monitoring provider is connected yet, so these hooks do not transmit data.
Deployment, recovery, feedback collection and the remaining beta checks are
still open.

## Slice 7 — Public launch

**Status:** NOT STARTED

Prepare ShelfPick for public availability using Private Beta evidence. Complete
release-critical reliability, privacy, support, observability, account and
operational requirements before widening access.

## Slice 8 — Live Plays

**Status:** NOT STARTED

Explore and deliver a focused live-session experience after public-launch
requirements are stable. Define the scope from observed play-logging behavior;
do not assume real-time group infrastructure is required.

## Slice 9 — Challenges

**Status:** NOT STARTED

Add Play Challenges after the core play loop and Live Plays have sufficient
usage evidence. Keep challenge progress understandable and avoid incentives
that distort useful play records.

## Slice 10 — Advanced Pro intelligence

**Status:** NOT STARTED

Develop advanced personalisation, recommendation intelligence and richer
statistics only after the free experience, entitlement boundaries and user
signals are validated. Prefer explainable improvements grounded in ShelfPick's
existing data over an unrelated recommendation platform.
