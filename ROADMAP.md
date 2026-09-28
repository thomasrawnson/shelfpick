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

Continue with SP-PB02 (reported Top 100 availability failure). Then address
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

The bounded Free versus Pro presentation pass is complete. The comparison now
leads with the useful Free product and lists only implemented capabilities;
personalised Discover is the sole current Pro-only outcome. Locked feature
states use the same comparison language and route directly to `/settings/pro`.
Entitlement checks and purchase behaviour are unchanged. The agreed launch
price is £3.99 as a one-off purchase, not a subscription. Technically, no price
is configured and checkout is not implemented, so the unlock action stays
explicitly unavailable and no price is displayed in the app.

The implementation audit is recorded in
`docs/free-pro-capability-audit.md`. It verifies that personalised Discover
`For You` is the only implemented Pro-only behaviour. Picker modes, collection,
Want to Play, play logging, Insights and basic Game Night are Free. The audit
also records that the Pro entitlement response currently includes planned
capability names without corresponding shipped behaviour, and that For You’s
source cache is process-local. The recommended next slice is Pro entitlement
and For You readiness hardening before £3.99 one-off checkout implementation.

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
2. SP-PB02: restore reported Top 100 availability.
3. SP-PB03–04: selected-player count and saved play-style defaults.
4. SP-PB05–09 and SP-PB20: Settings, typography, Rankings, spacing, Collection and heading copy.
5. SP-PB10–11 and SP-PB14: location, Pro live duration and statistics.
6. SP-PB12–13: branded play and monthly recap sharing.
7. SP-PB15–17: Pro ranking recommendations, scanning and avatars.
8. SP-PB18–19: Game Night voting and Pro challenges.
9. Reconcile Free/Pro claims, complete validation and existing release gates.
10. Resume private beta only after Tom's explicit decision, then public launch.

See `docs/pre-beta-work-plan-2026-09-28.md` for dependencies, acceptance criteria
and unresolved choices. Historical slice numbers below are retained.

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

**Status:** NOT STARTED

The shared FREE/PRO tier resolution, frontend-facing entitlement list and
central feature-capability checks are complete. The agreed launch price is
£3.99 as a one-off purchase, but no price is configured and checkout is not
implemented; the full Settings presentation remains incomplete.

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

- Guest invite links.
- Saved regular groups.
- Voting and vetoes.
- Shared reveal across devices.
- Better cross-user collection linking.
- Group preference learning.
- Game Night history and recaps.
- Re-run recommendations when attendance changes.
- Group-specific statistics.
- Scheduling and recurring Game Nights.
- Club and cafe hosting tools.

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
