# ShelfPick pre-beta work plan — 28 September 2026

## Decision — 28 September 2026

**External beta testing is ON HOLD at Tom's request.** Complete and validate the requested pre-beta work below before reconsidering invitations. Internal development/testing continues. This supersedes older instructions to run beta immediately after Game Night MVP, and moves the scoped live duration, challenges and recommendation work ahead of beta. Existing completed work is not reopened unless a regression is reported.

This is an implementation backlog, not a claim that features are shipped. All tasks below are **NOT STARTED**, except that identified scope decisions are pending clarification. Billing is separate and remains disabled until implemented. The existing repository records £3.99 one-off Pro, not a subscription; expanded scope does not automatically change price or promise lifetime future features.

## Delivery sequence

1. Repair SP-PB01–02, then Picker flow SP-PB03–04.
2. Settings and presentation SP-PB05–09, plus heading-copy cleanup SP-PB20.
3. Play foundation SP-PB10–11, statistics SP-PB14, then sharing SP-PB12–13.
4. Recommendation SP-PB15; scanning SP-PB16 and avatars SP-PB17 can proceed independently once decisions are resolved.
5. Game Night SP-PB18 and challenges SP-PB19.
6. Reconcile shipped Free/Pro claims and entitlements; validate all new work and existing operational release gates. Ask Tom to resume beta; do not resume automatically.

Task IDs are new backlog IDs and do not replace historical roadmap slice IDs. Implement one bounded sub-slice per reviewable change; split larger data/UI work further when needed.

## Decisions and provisional interpretations

- Confirmed: recommendation input is the user's personal game ranking, not global BGG rank/rating. Rankings placement is still open; Tom feels it deserves navigation visibility but the bar is crowded. Review a prominent My Rankings destination within Collection plus contextual game-detail access against a revised primary-navigation layout. Do not add another crowded bottom-bar item without evaluating the whole navigation.
- Confirmed: scan retail barcodes on game boxes; EAN/UPC-to-game catalogue matching is an implementation dependency.
- Confirmed: participants scan a QR code displayed on the host's phone and vote on their own phones. Remote guest voting is required, not a pass-and-play substitute.
- Confirmed: Add game must be more obvious/prominent.
- New SP-PB20: tidy repeated/redundant text under headings. Working interpretation: remove repetition; move useful longer explanations into contextual help rather than repeating the heading.
- Location as optional text, Inter, suggested filters, Free branded sharing and the challenge templates below are proposed implementations, not additional user-confirmed requirements.
- Only live duration, ranking-based recommendation enhancements and challenges are explicitly newly designated Pro. Preserve current access for other functionality until a tier decision is made.

## Task acceptance criteria

### SP-PB01 — Repair Picker Log a play

**Status:** COMPLETE — 28 September 2026. **Workstream:** Fix • first. **Access:** Existing Free access.

Picker now opens a dedicated `/picker/log-play` screen, prefilled with the
selected game and named players or distinct blank rows for a count-only session.
Save is guarded against duplicate submission, retains values after validation
or network errors, and returns to the unchanged Picker result with confirmation.
Cancel and browser Back preserve the selected game, criteria, players and
recommendation state; direct navigation without live Picker context provides a
safe recovery route.

Evidence: focused frontend tests, lint, build, colour and PWA validation, and
`git diff --check` passed. Mocked Playwright covered navigation, prefill,
validation/network recovery, duplicate clicks, confirmation, Cancel/Back,
direct navigation, keyboard focus, reachable actions, bottom-navigation
clearance and overflow at 390, 768, 1024 and 1440px in light/dark. Separate
configured non-production PostgreSQL repository/API tests verified isolated
play persistence and Picker conversion linkage. Before/after captures are in
`docs/screenshots/sp-pb01/`.

### SP-PB02 — Restore Discover Top 100

**Status:** BLOCKED (28 September 2026) — authorised ranked source unavailable. **Workstream:** Fix • first. **Access:** Existing Free access.

Reproduce the reported failure and distinguish API/source errors, cold-cache availability, metadata failure and client rendering. Keep original BGG positions 1–100, ownership filtering and truthful empty/error states. Never substitute Hot games under a Top 100 label or backfill ranks >100. Verify cold start, warm/stale cache and restart behaviour; record source provenance and freshness. The previous rank-boundary implementation stays complete; user-facing availability is reopened. Use a permitted source; do not bypass upstream restrictions.

Investigation traced the failure to source retrieval. The only runtime Top 100
source is BoardGameGeek's ranked browse page, which returns HTTP 403 on a cold
request. BGG documents its ranks CSV data dump as the permitted bulk-rank
source, but the configured non-production application token receives the data
page without download access. The downstream implementation is intact: valid
integer ranks 1–100 are filtered before the 30-candidate metadata limit;
ownership does not cause lower ranks to backfill; source failure remains
distinct from a genuine empty result; and Hot's cache/cooldown plus For You's
broader ranked pool and personalisation are unchanged.

Validation evidence: 38 focused backend tests passed across ranked-source
fresh/warm/stale behaviour, rank boundaries, ownership/filter ordering,
source-unavailable versus empty responses, Hot cooldown and Discover API/service
paths. All 35 frontend tests, build, lint, colour-token guard and PWA checks
passed. Mocked Playwright covered valid #1/#100 rendering and the unavailable
source retry state at 390 and 1440px in light/dark, including overflow checks;
screenshots are in `docs/screenshots/sp-pb02/`. This is mocked browser coverage,
not live-source or database verification. The required live cold start,
warm/stale cache and process-restart sequence cannot pass without authorised
official ranked data, so this slice is not complete. Unblock by granting the
configured application official BGG ranks-dump access or supplying an
authorised official dump for a persistent ingestion path.

### SP-PB03 — Make selected players authoritative in Picker

**Status:** COMPLETE — 28 September 2026. **Workstream:** Flow correction. **Access:** Existing Free access.

When named players are selected, derive count from that selection and remove the duplicate editable count control on the preceding criteria screen. Show a read-only count summary with Edit players. Preserve count-only use when no named players are selected. Test Back/forward, removing players and reset without contradictory counts. This is the provisional interpretation of the user's back-navigation report; reproduce before implementation.

The reproduced criteria screen showed both the selected named-player group and
the editable numeric count grid. Named-player mode now shows one derived count,
the selected names, Edit players and an explicit Use group size instead action;
the numeric choices render only in count-only mode. Editing names immediately
updates the derived count, removing every name returns to an unselected
count-only state, and Start over retains its existing defaults. Picker criteria,
recommendation requests, Back/forward state and SP-PB01 play-entry prefill use
the same authoritative count.

Evidence: 44 frontend tests passed, including focused named/count-only rendering
coverage and the existing named/count-only play-entry tests. Build, lint,
colour-token guard, PWA checks and `git diff --check` passed. Mocked Playwright
verified selecting, adding and removing named players, criteria Back/forward,
switching to a numeric count, keyboard focus, bottom-navigation clearance and
overflow at 390 and 1440px in light/dark. It also verified that named players
prefill the dedicated play-entry screen and browser Back restores the result.
Before/after captures are in `docs/screenshots/sp-pb03/`. No live API or
database persistence was exercised because SP-PB03 changes client session state
only. SP-PB04 is recorded complete below.

### SP-PB04 — Apply consistent saved Picker defaults

**Status:** COMPLETE — 28 September 2026. **Workstream:** Flow correction. **Access:** Existing access.

Expanded scope: persist cooperative / competitive / no preference alongside the
existing usual player count and preferred play time, and initialise a fresh
Picker session from all three values. A session override remains possible
without silently overwriting the profile. Back and play-entry navigation retain
the session choices. Existing users with missing or legacy play-style values use
no preference.

Settings → Preferences now groups the three defaults and saves only preference
fields, preserving hidden profile identity fields. Saving has disabled/loading,
success and recoverable error states; a failed request leaves all selections in
place. Player-count and play-time storage, validation and filtering already
worked and were retained. The profile/API contract adds one nullable,
backward-compatible `preferred_play_style` field using the Picker's existing
`any`, `cooperative` and `competitive` values.

Session rules: a fresh Picker mount snapshots the latest saved defaults. Named
players override the saved count under SP-PB03. Session edits remain authoritative
through rerenders, forward/Back and SP-PB01 play entry, and do not update saved
preferences. Browser-restored routes keep their mounted Picker state. Start over
is a genuine new session and reapplies the latest default props. A Settings save
therefore affects the next fresh session, not an already mounted one.

Evidence: 47 frontend tests and 19 affected backend profile/API tests passed, as
did the frontend build, lint, colour-token guard, PWA checks and
`git diff --check`. The migration applied from an empty isolated PostgreSQL
database and `alembic check` found no schema drift. An isolated user then passed
onboarding → preference save → `/auth/me` reload for all three defaults while
retaining name/avatar; its records and temporary database were removed.
Mocked Playwright covered delayed profile loading, failed-save recovery, exact
preference-only payloads, fresh defaults, overrides, Back, reset, outgoing
recommendation criteria, named-player precedence and play-entry restoration at
390 and 1440px in light/dark. Captures are in
`docs/screenshots/sp-pb04/`. SP-PB02 remains blocked and beta remains on hold.

### SP-PB05 — Restructure Settings navigation

**Status:** COMPLETE (28 September 2026). **Workstream:** UI. **Access:** Existing access.

Use labelled headings and concise rows opening dedicated subpages for substantial forms; use dialogs only for short choices. Cover Profile, Preferences, Appearance, Collection & Data, Plays, Pro, Help and About using working actions only. Preserve deep links, Back, focus return and unsaved-input behaviour. Import must not display unrelated Profile settings. Retain official BGG attribution at relevant sync surfaces.

Settings now opens as a grouped overview and routes each of those eight entries
to focused content. Profile and Preferences reuse the existing profile API while
showing only their relevant fields; Appearance retains the persistent theme
control; Collection & Data reuses BGG sync and BG Stats import without the
unrelated account/profile panel and adds explicit BGG attribution. Plays links
to the working Insights history, Pro retains the comparison route, and Help and
About contain only current information. Existing `/setup`, Profile and Pro deep
links remain valid. Explicit Back and browser Back restore the originating row's
keyboard focus.

Validation: 39 frontend tests passed, including focused overview, route,
section-isolation and import/profile-separation coverage. Build, lint,
colour-token guard, PWA checks and `git diff --check` passed. Mocked Playwright
verified overview → section → Back, browser Back focus, direct section routes,
theme and saved-profile-preference persistence, keyboard focus, bottom-nav
clearance and overflow at 390 and 1440px in light/dark. Before/after captures
are in `docs/screenshots/sp-pb05/`. No live account or database data was used.
SP-PB09 Add game/filter work and SP-PB20 cross-screen heading-copy cleanup
remain pending; SP-PB02 remains blocked and beta remains on hold.

### SP-PB06 — Refresh typography

**Status:** NOT STARTED. **Workstream:** UI. **Access:** All users.

Prepare and implement a consistent Inter-led direction across app headings, body, labels and statistics using shared typography tokens; preserve the approved logo asset and colour palette. Proxima Nova remains an alternative requiring a supplied/licensed font. Validate long game titles, font fallback, mobile density and light/dark readability. Current Lora/Nunito tokens are the implemented baseline until this task lands.

### SP-PB07 — Improve Rankings placement

**Status:** NOT STARTED. **Workstream:** UI decision then implementation. **Access:** Existing access.

The feature is the user's personal game ranking. Tom feels it merits primary-navigation visibility but the current bar is crowded; placement remains a design decision. Compare (A) a prominent My Rankings destination within Collection with a Rank this game action on game details, and (B) a revised primary-navigation structure with Rankings, accounting for all displaced destinations. Keep Game Night distinct and readily accessible. Recommend one using mobile/desktop mockups and findability evidence before structural implementation. Preserve existing rankings, ranking input, deep links, Back and collection state. Navigation changes must not make the new Pro recommendation signal gate existing ranking entry.

### SP-PB08 — Reduce Friends' favourites padding

**Status:** NOT STARTED. **Workstream:** UI. **Access:** Existing access.

Reduce excess card/section padding and empty space while preserving artwork, readable labels, 44px touch targets and truthful sparse states. Check zero, one and multiple friends/participants and long names on mobile and desktop.

### SP-PB09 — Expand Collection filters and strengthen Add game

**Status:** COMPLETE (28 September 2026, add-game discoverability scope). **Workstream:** Collection UI. **Access:** Existing access.

Audit existing filters first; proposed additions are player count, duration, complexity, cooperative/competitive and recorded/unrecorded play history, only where data supports truthful filtering. Combine filters, show active count, clear/reset and no-match recovery; retain independent Owned/Want to Play state and scroll. Make Add game a prominent labelled action on populated and empty views. Tom confirmed that Add game is currently not obvious. Use a visible labelled Add game action rather than relying on an ambiguous icon or an empty-state-only entry. When barcode scanning ships, offer Search and Scan barcode from this entry.

The confirmed add-game discoverability scope is complete. Populated and
filtered-no-match Owned views now keep a prominent labelled **Add game** action;
the genuinely empty shelf has its own primary Add game action plus a route to
the existing Collection & Data BGG import. The action reuses the existing
BoardGameGeek search/add panel, now with an associated search label, initial
keyboard focus, restored trigger focus on Close, explicit success/no-results
feedback and a Collection & Data import link. Existing duplicate disabling,
API validation/error recovery, filters, sorting, independent Collection UI
state and browser-Back restoration are preserved. Barcode scanning and the
proposed broader filter expansion were not introduced.

Validation: 42 frontend tests passed, including focused empty/filtered recovery,
single-merge duplicate prevention and reuse of the existing search/import flow.
Build, lint, colour-token guard, PWA checks and `git diff --check` passed.
Mocked Playwright verified populated, empty, filtered and add-search states at
390 and 1440px in light/dark, plus search → add → visible result, duplicate
handling, failed-add retry with retained input, Cancel focus, Collection
search/sort preservation, browser Back, keyboard access, bottom-nav clearance
and overflow. Before/after captures are in `docs/screenshots/sp-pb09/`. No live
account, backend or database data was used. SP-PB20 is recorded complete below;
SP-PB02 remains blocked and beta remains on hold.

### SP-PB10 — Add optional play location

**Status:** COMPLETE (28 September 2026). **Workstream:** Play data. **Access:** Free; no new gate.

Add editable location text to create/edit/detail play flows; blank remains valid for existing/imported plays. Proposed scope is a venue label such as Home or a club, without GPS/maps. Preserve user isolation and import compatibility. Exclude location from shared graphics by default and allow deliberate opt-in.

Implemented as an optional, trimmed 200-character text field in the shared play
form, so Picker, Collection and Game Night entry paths retain their existing
participant and validation behaviour. Location is returned in recent play
history and shown on Collection game detail. The product does not currently
support editing an existing play; this slice deliberately did not invent a new
edit route. Nullable storage keeps older/imported plays valid.

### SP-PB11 — Record live play duration

**Status:** COMPLETE (28 September 2026). **Workstream:** New feature. **Access:** Pro — enforced in frontend and backend.

Add Start, Pause, Resume and Finish with visible elapsed duration and a route
back to the active session. While a timer exists, keep a persistent in-app
indicator available throughout authenticated ShelfPick navigation. It shows the
game name, elapsed time and running/paused state and provides an accessible,
clearly named action that reopens the authoritative timer controls. The
indicator must consume the same timer state rather than maintaining a second
clock, and must remain clear of bottom navigation and primary screen actions at
all supported widths.

Derive elapsed time from persisted timestamps/pause intervals so backgrounding,
reload and suspended tabs do not lose or invent time. Finishing prefills the
play form; saving is explicit and creates one record. Allow correction, prevent
negative durations and recover interrupted sessions. Enforce Pro on backend and
frontend while preserving basic manual play logging. Depends on SP-PB01; define
concurrent-session behaviour before implementation. Validation must include the
in-app indicator across navigation, responsive layouts, keyboard and screen
reader access, bottom-navigation/action clearance, background/reopen accuracy
and interrupted-session recovery.

Implemented lifecycle: Start creates the one account-scoped persisted timer;
Pause snapshots elapsed seconds; Resume starts a new timestamp interval; Finish
freezes elapsed duration and opens the shared play form for review. Finish does
not create a play. The app-wide indicator and timer screen derive display time
from the same server timer timestamps. A unique timer per account prevents
parallel double counting. Refresh restores the timer for that account, and a
finished timer is removed atomically only after a successful play save or an
explicit confirmed discard. The timer public ID makes a lost-response retry
idempotent, so it returns the already-created play instead of duplicating it.
Manual duration entry remains Free and unchanged.

Validation evidence: 18 focused backend service/API tests passed, including a
controlled clock for pause/resume, background gaps, repeated actions, account
isolation and cleanup. The configured development PostgreSQL migration upgraded
to `b04c8f13a2d7`; `alembic check` reported no drift. An isolated real database
round trip verified location/duration read-write, timer cleanup and one-play
idempotent retry, then deleted its test records. Frontend tests (49), build,
lint, colour-token guard and PWA checks passed. Mocked Playwright covered
Start/Pause/Resume/Finish, navigation indicator, failure retention/retry,
keyboard focus, bottom-navigation clearance and overflow at 390 and 1440px in
light/dark. Before/after captures are in `docs/screenshots/sp-pb10-11/`.
No real mobile device/background-process test was run; timestamp recovery is
proved by controlled-clock and browser refresh/navigation coverage. SP-PB02
remains BLOCKED and beta remains on hold.

### Future Pro timer task — outside-app visibility

**Status:** FUTURE / UNSEQUENCED. **Access:** Pro proposal. **Task ID:** Assign
after platform feasibility is established; this is not part of SP-PB11.

Assess ShelfPick's current PWA packaging, any native wrapper and the actually
supported iOS/Android/browser platforms before selecting an implementation.
Evaluate lock-screen/Live Activity support where a native platform genuinely
provides it and an ongoing-notification approach where supported. Distinguish a
continuously visible timer surface from a one-off notification: a completion or
reminder notification does not satisfy this task. Document lifecycle,
background-execution, permission, update-frequency, battery and store-policy
constraints before implementation. Do not promise unsupported background
execution, simulate continuous visibility with repeated notifications, or
request notification permission as part of SP-PB11. This future task is not a
pre-beta commitment unless it is explicitly reprioritised.

### SP-PB12 — Share a recorded play with ShelfPick branding

**Status:** NOT STARTED. **Workstream:** Sharing. **Access:** Proposed Free marketing feature.

Generate a preview/downloadable share card with game artwork, play facts and the approved ShelfPick logo. Share via device share support with image-download fallback. Missing artwork must not break export. Player names/photos and location are excluded by default or explicitly selected in preview. Sharing must not post automatically or expose account identifiers. Reuse a single export renderer for monthly recaps.

### SP-PB13 — Share This month in games

**Status:** NOT STARTED. **Workstream:** Sharing. **Access:** Proposed Free marketing feature.

Add an accessible share icon to the monthly recap. Export game images, ShelfPick logo and statistics from the same month/filter/timezone as the visible recap. Preview before sharing; handle no plays, one play, missing images and long names. Reuse SP-PB12 rendering and privacy choices; verify readable exported images, not only on-screen layout.

### SP-PB14 — Add total plays and board-game H-index

**Status:** NOT STARTED. **Workstream:** Statistics. **Access:** Tier not specified; preserve existing Free statistics.

Show clearly labelled total plays and H-index: the largest h for which at least h distinct games have each been played at least h times. Define all-time versus selected-period scope visibly and use the existing play quantity/import conventions. Test zero plays, ties, repeated plays, deleted records and duplicate-import handling. Explain that these are recorded ShelfPick/imported plays, not an assertion about all lifetime play.

### SP-PB15 — Use ranking scores in recommendations

**Status:** NOT STARTED. **Workstream:** Recommendation change. **Access:** Pro — explicitly requested.

Use the user's personal ShelfPick game ranking, confirmed by Tom. Audit its current representation (ordered rank versus numeric score) and existing rating contributions before defining a formula; do not substitute global BGG ranking. In Discover, use ranked-known-game affinities to help score unseen candidates rather than expecting an unowned candidate to have a personal rank. Document how positive and low-ranked preferences are derived; an unranked game is unknown, not disliked. Test sparse rankings, ties where supported, edits and absent affinity metadata. Avoid double counting correlated shelf/history inputs. Implement a bounded, explainable contribution in Discover For You with neutral missing-data behaviour and regression examples. Preserve all hard eligibility, exact-player suitability and BGG Not Recommended >=30% exclusions; no global Hot/Top 100 reordering. Picker use is a separate optional sub-slice after evaluating Discover results, not an assumed approved scoring formula. Add genuine Free/Pro enforcement without gating existing Free scoring.

### SP-PB16 — Add retail barcode scanning

**Status:** NOT STARTED. **Workstream:** Barcode lookup and collection entry. **Access:** Tier not specified.

Confirmed scope: scan retail EAN/UPC barcodes on game boxes. Split into SP-PB16A catalogue feasibility and SP-PB16B scan/add integration. First establish a permitted barcode-to-game/edition data source, actual coverage on representative boxes, commercial terms, costs and canonical BGG ID mapping; do not assume existing BGG endpoints supply this mapping. Then implement camera scan or manual code entry → matched game/edition preview → user confirmation → add to Owned/Want to Play. Handle ambiguous editions, no match, duplicate ownership, unsupported camera, permission denial and lookup failure with manual-search fallback. A successful camera decode alone does not complete this task. Game-link QR scanning is not a substitute for retail barcode support.

### SP-PB17 — Expand avatars and support photo upload

**Status:** NOT STARTED. **Workstream:** Profile. **Access:** Tier not specified.

Offer more selectable avatars and a separate upload-photo slice with crop/preview/replace/remove. Validate image type and size server-side, re-encode accepted images, strip metadata, scope access/storage and delete replaced assets. Preserve historical player identities, initials fallback and consistent rendering across Profile, selected players and Game Night. Do not assume a reusable player identity is an authenticated account.

### SP-PB18 — Make Game Night a group decision with voting

**Status:** NOT STARTED. **Workstream:** Group feature. **Access:** Enhanced voting tier to confirm; basic Game Night stays Free.

Keep Game Night separate from Picker: attendees and constraints → eligible 3–5 game shortlist with group reasons → votes → clear winner/tie resolution → reveal → log play. Voting must affect the result, with at most one current ballot per attendee, editable choices and explicit abstention/tie handling. Confirmed joining flow: the host displays a session QR code; attendees scan it and vote on their own phones. Split into SP-PB18A session/membership and vote rules, SP-PB18B host QR and mobile guest voting, and SP-PB18C cross-device results/recovery. Propose guest participation without mandatory account creation, with host-confirmed attendee slots and session-scoped credentials; QR possession must not expose the host's account or grant host controls. Store ballots authoritatively on the server; prevent duplicate ballots for the same admitted participant, scope all writes to that session and avoid claiming anonymous access is identity-proof. Support refresh/reconnect, voting-open/closed/expired states, host close/revoke, invalid links, concurrent votes and shared winner display. QR sharing must work across different networks through the deployed app URL, not a localhost URL. Provide a copyable join-link fallback. Verify two independent phone/browser contexts plus host. Polling is acceptable if it meets the UX; do not assume WebSockets are required. Reset/reconfirm ballots when shortlist or attendance changes. Never fabricate attendee-owned collections or group preferences. Split session/vote rules and UI integration into separate tasks.

### SP-PB19 — Add play challenges

**Status:** NOT STARTED. **Workstream:** New feature. **Access:** Pro — explicitly requested.

Proposed MVP: a personal goal for total recorded plays and a play-X-distinct-games-Y-times challenge, with date range, progress and completion. Progress derives from real play records and recalculates after edit/delete/import; existing plays in the chosen range count consistently. Include create/view/archive, empty/error states and backend/frontend Pro enforcement. Define timezone and quantity counting; no leaderboards or reward economy in this slice. Depends on play-data reliability and SP-PB14 counting semantics.

### SP-PB20 — Simplify supporting text beneath headings

**Status:** COMPLETE (28 September 2026). **Workstream:** UI copy cleanup. **Access:** All users.

Audit subtitles and supporting paragraphs beneath headings across Picker, Collection, Discover, Rankings, Insights, Game Night and Settings. Working interpretation of Tom's request: remove repetitive/redundant text that merely restates the heading; shorten useful instructions and move longer optional explanations into contextual help. Keep meaningful personalised/fallback explanations, units, error recovery, empty-state guidance, entitlement limitations and accessibility labels. Do not fill the released space with new filler copy. Capture before/after examples and verify mobile/desktop light/dark wrapping and screen-reader context. Complete alongside SP-PB05–09.

Picker, Collection, Discover, Rankings, Insights, Game Night and Settings now
use one clear page heading in the validated primary states. Repeated category
eyebrows and generic subtitles were removed; Ranking's duplicated page headings
were consolidated under **Rank your games**, and Insights loading/error states
now retain **Insights** as their stable page heading with state copy beneath it.
The remaining supporting copy changes the user's decision or explains scope:
Picker still says choices come from the collection, Game Night explains the
headcount/history input, and Ranking explains how choices improve the list.
Personalisation/fallback explanations, units, actionable empty/error recovery,
validation, entitlement limitations, BGG attribution and accessible names were
deliberately retained. No routes, behaviour, state, scoring, access or backend
contracts changed.

Validation: all 42 frontend tests, build, lint, colour-token guard, PWA checks
and `git diff --check` passed. Mocked Playwright inspected all seven scoped
screens at 390 and 1440px in light/dark, asserted exactly one `h1`, exercised
keyboard focus, checked bottom-navigation clearance and found no horizontal
overflow. Twenty-eight before and 28 after captures are stored in
`docs/screenshots/sp-pb20/`. No live account, API, backend or database data was
used. SP-PB02 remains blocked and beta remains on hold.

## Shared definition of done

- Reproduce reported defects before fixing; distinguish mocked tests from live evidence.
- Use focused domain/API tests for state, persistence and entitlement changes; use an isolated test database for play/repository changes.
- Validate affected flows at 390, 768, 1024 and 1440px in light/dark, including keyboard focus, Back, reachable actions and no horizontal overflow.
- Preserve exact-count suitability, BGG Not Recommended >=30% exclusion, user isolation, routes and collection scroll/saved state. Recommendation scoring changes are confined to SP-PB15.
- Preserve approved ShelfPick assets and separate official BGG attribution. Do not expose planned capabilities as delivered benefits.
- Update ROADMAP.md, DESIGN.md where applicable, docs/pre-beta-design-priorities.md and docs/free-pro-capability-audit.md after each delivered task, with evidence and limitations.
- Keep deployment, production migration, purchases and live account mutations outside routine isolated validation. Beta remains on hold until requested scope is verified, remaining decisions resolved, operational gates pass and Tom explicitly resumes it.
