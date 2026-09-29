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
6. Reconcile shipped Free/Pro claims and entitlements — presentation complete;
   the `advanced_stats` contract discrepancy and commercial checkout remain.
   Validate all new work and existing operational release gates. Ask Tom to
   resume beta; do not resume automatically.

## Bounded follow-up sequence — 29 September 2026

Planning this sequence is not implementation of slices 2–5.

1. **SP-PB03 follow-up, with bounded SP-PB08/SP-PB20 copy polish — COMPLETE.**
   Order the shared player picker from the signed-in account's most recent
   recorded play date, with unplayed players following alphabetically; retain
   selection and named-player rules. Remove the redundant Picker progress/copy,
   improve setup-section spacing and use player terminology in visible copy.
   SP-PB08's separate favourites-card padding acceptance criteria remain open.
2. **SP-PB05 Appearance follow-up — COMPLETE.** Settings offers **Black
   (experimental)** to Free and Pro through an isolated semantic-token layer,
   while System, Light and Dark retain their behaviour and saved values. The
   pre-React theme bootstrap persists and restores Black before paint, and
   unknown or retired values fall safely back to System. Existing dark-specific
   logo and inactive-control treatment now includes Black. Gaming Table, Anime
   Arcade and Quiet Garden are documented as possible Pro cosmetic themes only;
   none is implemented or marketed.
3. **SP-PB09 audit plus SP-PB16A — PLANNED.** Clarify current BGG title search,
   bound true custom/manual-game work if absent, and establish UPC/EAN lookup
   permission, coverage, commercial terms and cost before SP-PB16B. Plan
   confirmation, duplicates and camera/browser recovery with title-search
   fallback; QR voting is unrelated.
4. **SP-PB12/SP-PB13 — PLANNED.** Audit approved branding and the renderer,
   redesign persisted-play cards around available cover art, and add a truthful
   monthly totals/collage export with a branded fallback. Preserve privacy,
   redaction, native share/download and Free saved-play sharing.
5. **SP-PB14 plus capability-audit follow-up — PLANNED.** Inventory actual
   Insights/backend statistics and propose a concrete Free/Pro matrix before
   gates. Keep basic history/headline totals Free and do not market the current
   unimplemented `advanced_stats` capability.

Slice 1 implementation uses one account-scoped aggregate query over players,
participants and plays, ordered by `plays.played_at` rather than insertion or
import timing. Unplayed players use a case-insensitive name then ID fallback.
Picker selections and named-player precedence are unchanged. The non-interactive
two-dot progress indicator and redundant supporting sentence above the setup
controls were removed; explicit Back actions, browser history and primary
navigation remain. Mobile Group size → Complexity and Complexity → Fine-tune
gaps are now 24px in the focused browser fixture.

Validation: seven focused backend profile/API tests and nine focused frontend
tests passed; changed-file ESLint, the production build and `git diff --check`
passed. A mocked 390×844 Chrome pass covered ordered players, alphabetical
unplayed fallback, retained multi-selection, named-player precedence, Back,
keyboard focus, navigation clearance and no horizontal overflow. Evidence is
`docs/screenshots/sp-pb03-follow-up/picker-player-polish-mobile.png`. No live
account, real device or production data was used. SP-PB02 remains BLOCKED,
photo upload remains post-beta and beta remains on hold. Physical-phone
Pro-host voting and the real-device timer background/reopen checks remain
outstanding.

SP-PB05 Appearance follow-up validation: eleven focused theme/Settings tests
passed for System behaviour, explicit theme persistence, Black selection and
reload, unknown-value fallback, absence of a Pro gate and the protected Pluto
Night Labs link. Changed-file ESLint,
the production build and `git diff --check` passed. A mocked 390×844 Chrome pass
covered Settings, About, Picker, Collection and the saved-play share dialog in
Black; the About link destination and keyboard access were verified, and the
public HTTPS destination resolved successfully. The pass verified the
true-black/near-black surface hierarchy, 17.64:1 primary token
contrast, distinct borders and selections, keyboard focus, a disabled control,
navigation, no horizontal overflow, and switching back to Light, Dark and
System. Evidence is
`docs/screenshots/sp-pb05-black/black-theme-settings-mobile.png`. No live
account, physical device or production service was used. SP-PB02 remains
BLOCKED, photo upload remains post-beta and beta remains on hold. Physical-phone
Pro-host voting and the real-device timer background/reopen checks remain
outstanding.

Task IDs are new backlog IDs and do not replace historical roadmap slice IDs. Implement one bounded sub-slice per reviewable change; split larger data/UI work further when needed.

## Roadmap Slice 4 — Free versus Pro presentation reconciliation

**Status:** COMPLETE (28 September 2026). **Task ID:** Roadmap Slice 4,
Settings + Pro foundations; this reconciliation is not assigned a new SP-PB
number. **Access:** Presentation only; existing backend entitlements remain
authoritative.

The comparison leads with the three implemented Pro benefits: personal For You
and count-based Picker influence, live timing with an in-app indicator, and
host-created phone voting. Activity groups retain Free Collection, core Picker,
manual duration/location logging, personal rankings, branded play sharing and
basic Game Night. Copy distinguishes the Pro host from guests, who need neither
an account nor Pro, and states that owner rankings do not influence named-player
Picker groups. Top 100 is identified as Free by policy but unavailable while
SP-PB02 is blocked. Photo upload, outside-app timer behaviour and notifications
are not presented as available.

No entitlement, route or Free functionality changed. The agreed one-off model
is retained, but checkout and a technically configured price do not exist, so
the comparison contains no price or Buy/unlock control. Seven focused rendering
tests, changed-file ESLint, the production build and `git diff --check` passed.
A mocked Chrome pass covered Free and Pro at 390×844, keyboard focus, bottom-nav
clearance and overflow, plus a 1280×900 desktop layout check. The screenshot is
`docs/screenshots/free-pro-presentation/free-plan-mobile.png`. No live account,
purchase, backend, production data or production service was used. The
unmarketed `advanced_stats` entitlement still has no separate shipped surface;
checkout remains pending. SP-PB02 remains BLOCKED, photo upload remains
post-beta and beta remains on hold.

## Local Free/Pro validation setup — 29 September 2026

**Status:** COMPLETE as development tooling; it does not change product access.

`backend/scripts/local_test_accounts.py` now creates dedicated Free and Pro
accounts through a guarded local-only workflow. It accepts only
`APP_ENV=development`, loopback PostgreSQL and an allowlisted development
database name, refuses to replace an unmarked account, and seeds only three
synthetic owned games plus the minimum players needed for Game Night. Repeated
setup refreshes the dedicated credentials without clearing their test history;
`remove` deletes the marked accounts and unreferenced synthetic games. Setup,
LAN access, voting-origin configuration and cleanup are documented in
`docs/local-free-pro-testing.md`.

Eleven focused safety tests passed. Setup was run twice against local PostgreSQL,
then a real-authentication Chrome pass at 390×844 verified a three-game Free
Game Night shortlist, backend 403 responses for Free phone-voting host creation
and timer start, Pro voting creation with a displayed QR and configured join
link, accountless join/ballot persistence in a separate guest context, and Pro
timer start plus cleanup. Cleanup returned both accounts to missing and the
synthetic catalogue to 0/3. This used only local services and data. A physical
phone has not scanned or opened the LAN-address QR/link, so that cross-device
check remains pending. SP-PB02 remains BLOCKED, photo upload remains post-beta
and beta remains on hold.

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
keyboard focus. About now links to `https://plutonightlabs.com/` using its
existing secondary-action styling, opens the destination in a protected new tab
and exposes that behaviour to assistive technology.

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

### SP-PB08 — Reduce Players’ favourites padding

**Status:** NOT STARTED. **Workstream:** UI. **Access:** Existing access.

Reduce excess card/section padding and empty space while preserving artwork, readable labels, 44px touch targets and truthful sparse states. Check zero, one and multiple players/participants and long names on mobile and desktop.

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

If Pro access is lost while a timer is active or awaiting save, the normal timer
read and all Start/Pause/Resume/Finish/Discard endpoints return 403. A separate
authenticated recovery read returns only the signed-in account's retained
timer data. The frontend uses it once per entitlement state instead of making
repeated forbidden requests. Running and paused states replace paid controls
with a clear access-change explanation and a prefilled ordinary manual play
form; saving manually does not finish, discard or clear the timer. Finished
state retains its account-scoped session ID in the same form, so successful
save remains the only implicit cleanup and a lost-response retry stays
idempotent. Restoring Pro restores the same authoritative timer and controls.

Validation evidence: the complete backend suite passed with 236 tests and one
pre-existing Starlette `TestClient`/httpx deprecation warning. Five focused
tests against a disposable local PostgreSQL database verified concurrent Start
produces one account timer,
concurrent and repeated save produces one play, another account cannot read,
control, discard or save a timer, finished timers reject the wrong game on both
first save and retry, and tier loss retains active/finished timer rows. The
database was removed after the run. A second disposable PostgreSQL database
migrated from empty to `b04c8f13a2d7`; `alembic check` reported no new upgrade
operations. Frontend tests (49), build, lint, colour-token guard and PWA checks passed.
Mocked Playwright covered
Start/Pause/Resume/Finish, navigation indicator, failure retention/retry,
keyboard focus, bottom-navigation clearance and overflow at 390 and 1440px in
light/dark. Before/after captures are in `docs/screenshots/sp-pb10-11/`.
No real-phone background/reopen test has yet been run; it remains an explicit
pre-beta checklist item. Timestamp recovery is proved by controlled-clock and
browser refresh/navigation coverage, but those checks are not a device
substitute. Outside-app timer/notification work remains the separate future
task below. SP-PB02 remains BLOCKED and beta remains on hold.

SP-PB11 recovery follow-up evidence (28 September): four focused backend API
checks covered running, paused and finished recovery plus the unchanged Pro
gate on the normal read and paid controls. Five focused frontend tests covered
the three recovery presentations and absence of paid controls. Changed-file
ESLint and the production build passed. One mocked 390×844 Chrome flow covered
Free running recovery, ordinary manual save without timer cleanup, restored Pro
controls, Free paused recovery, retained finished details, failed-save retry
with the same timer session ID and final success. It made no paid timer read in
either Free state. Existing atomic repository code, constraints and account
scoping were not changed, so the earlier isolated PostgreSQL proof was not
repeated. No live account, database or production service was used.

**Separate outstanding validation:** SP-PB18 now has a local real-authentication
Pro-host and separate accountless guest browser proof. Physical-phone scanning
and cross-network use of the configured LAN voting origin remain pending. The
real-phone timer background/reopen check also remains outstanding. SP-PB02
remains BLOCKED, photo upload remains post-beta and beta remains on hold.

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

**Status:** COMPLETE (28 September 2026). **Workstream:** Sharing. **Access:** Free; no new gate.

Generate a preview/downloadable share card with game artwork, play facts and the approved ShelfPick logo. Share via device share support with image-download fallback. Missing artwork must not break export. Player names/photos and location are excluded by default or explicitly selected in preview. Sharing must not post automatically or expose account identifiers. Reuse a single export renderer for monthly recaps.

Saved plays in Collection history now have a labelled Share play action. It
opens a modal preview without navigating away or resetting the game-detail
screen, and Close or Escape restores focus to the originating play. The same
1200×1500 canvas renderer drives the preview, native file share and PNG
download, so privacy choices cannot diverge from the exported image. The card
uses the approved ShelfPick logo and Forest/Gold identity, includes title and
date plus meaningful duration/result data, and falls back to a branded initials
panel when artwork is absent or cannot be read safely through CORS.

Player names, scores and location are independent opt-ins; names and location
start hidden. Missing scores remain blank, winner flags remain authoritative,
cooperative/shared wins are labelled without inferring results, email-like
cooperative wins, scored ties and shared wins are labelled without inventing a
result, email-like participant labels are redacted, and no account identifier, private note, URL
or QR code is rendered. Native sharing runs only from Share image, treats an
`AbortError` as cancellation, and does not claim ShelfPick posted anything.
Download image remains available when file sharing is unsupported.

Validation: seven focused share-card tests passed for privacy defaults, exact
selected content, email redaction, cooperative/shared results, artwork fallback,
generation failure and native-share cancellation. The production frontend build
and changed-file lint passed. One mocked 390×844 Chrome pass covered preview,
all privacy toggles, two PNG downloads, Close and Escape focus return, preserved
origin route, missing-artwork/long-title fallback and generation retry without
horizontal overflow. The inspected 1200×1500 exports and mobile captures are in
`docs/screenshots/sp-pb12/`. Native OS share-sheet behavior, real cross-origin
artwork hosts and physical-device rendering remain pre-beta checks. The existing
timer-after-Pro-loss and real-phone background/reopen checks remain on that
checklist. SP-PB02 remains BLOCKED and beta remains on hold.

### SP-PB13 — Share This month in games

**Status:** NOT STARTED. **Workstream:** Sharing. **Access:** Proposed Free marketing feature.

Add an accessible share icon to the monthly recap. Export game images, ShelfPick logo and statistics from the same month/filter/timezone as the visible recap. Preview before sharing; handle no plays, one play, missing images and long names. Reuse SP-PB12 rendering and privacy choices; verify readable exported images, not only on-screen layout.

### SP-PB14 — Add total plays and board-game H-index

**Status:** NOT STARTED. **Workstream:** Statistics. **Access:** Tier not specified; preserve existing Free statistics.

Show clearly labelled total plays and H-index: the largest h for which at least h distinct games have each been played at least h times. Define all-time versus selected-period scope visibly and use the existing play quantity/import conventions. Test zero plays, ties, repeated plays, deleted records and duplicate-import handling. Explain that these are recorded ShelfPick/imported plays, not an assertion about all lifetime play.

### SP-PB15 — Use ranking scores in recommendations

**Status:** COMPLETE — 28 September 2026. **Workstream:** Recommendation change. **Access:** Pro — explicitly requested.

Use the user's personal ShelfPick game ranking, confirmed by Tom. Audit its current representation (ordered rank versus numeric score) and existing rating contributions before defining a formula; do not substitute global BGG ranking. In Discover, use ranked-known-game affinities to help score unseen candidates rather than expecting an unowned candidate to have a personal rank. Document how positive and low-ranked preferences are derived; an unranked game is unknown, not disliked. Test sparse rankings, ties where supported, edits and absent affinity metadata. Avoid double counting correlated shelf/history inputs. Implement a bounded, explainable contribution in Discover For You with neutral missing-data behaviour and regression examples. Preserve all hard eligibility, exact-player suitability and BGG Not Recommended >=30% exclusions; no global Hot/Top 100 reordering. Picker use is a separate optional sub-slice after evaluating Discover results, not an assumed approved scoring formula. Add genuine Free/Pro enforcement without gating existing Free scoring.

ShelfPick personal rankings are stored as per-user Elo-style numeric ratings,
then presented as an ordered list; they are not BoardGameGeek rank or average
rating. For You now reads only owned, non-expansion games with an explicit
comparison and derives signed category/mechanic affinity from their current
rating range. At least four compared games and a non-zero rating spread are
required. Each game's signed weight is confidence-limited until three
comparisons; low-ranked metadata cancels matching high-ranked metadata. A
candidate receives only positive net affinity, averaged once across matching
categories/mechanics and capped at **+3.0 points**, so correlated metadata does
not receive separate unbounded boosts. Unranked, tied, sparse and missing
metadata remain neutral rather than negative.

The concise reason **Similar to games you rank highly** is added only when the
candidate received a positive ranking contribution. The response advertises
the `rankings` personalisation signal only when such a candidate survives the
final result limit. Current ranking edits are read on each For You request;
there is no affinity cache. Player-count filtering and its exact-count BGG
Not Recommended threshold run before ranking influence, while ownership and
source exclusions remain unchanged. Hot and Top 100 do not query or apply the
ranking signal. The existing backend `personalized_discover` capability still
returns 403 for Free before recommendation work; Free ranking entry and Free
Hot/Top 100 remain unchanged.

Evidence: 30 focused backend service/API/repository/entitlement tests passed, covering
bounded influence, deterministic with/without comparisons, sparse and tied
fallback, edited order, user-scoped current data, Free 403/Pro access, ranked
candidates beyond the Top 100 boundary and player-count/Not Recommended
exclusions. Three focused frontend copy tests, production build, changed-file
lint, a mocked 390×844 Chrome signal/no-signal check and `git diff --check`
passed. No live BoardGameGeek retrieval or production account was used. The
known ranked-source availability issue can reduce the candidate pool but does
not change the implemented scoring; SP-PB02 remains blocked. Picker ranking
integration was subsequently completed as the approved bounded follow-up.

#### Picker personal-ranking follow-up — COMPLETE, 28 September 2026

Pro count-based Picker requests now use the current personal ShelfPick Elo
rating of each owned candidate directly; they do not use BoardGameGeek rank or
rating and do not copy Discover's category/mechanic affinity. The signal
requires at least four explicitly compared owned, non-expansion games and a
non-zero rating spread. A candidate's rating is normalised around the current
range midpoint, confidence ramps to full after three comparisons, and the
rounded contribution is bounded to **-5 to +5 points** on Picker's existing
0–100 score. Unranked candidates and sparse or tied sets remain neutral, so
missing data preserves the prior result.

Eligibility, player/time/play-style constraints and exact-count BoardGameGeek
Not Recommended filtering run before scoring. Existing history, variety and
repeat-avoidance contributions remain unchanged, as does surprise-mode
shuffling. The reasons **Higher in your personal rankings** and **Lower in your
personal rankings** appear only when the contribution changes the final
clamped score. Current rows are read for every request, so a subsequent pick
reflects ranking edits without a cache. The existing backend
`advanced_recommendations` entitlement enables the signal for Pro; Free Picker
does not query it and Free ranking entry remains unchanged. Named-player
sessions deliberately omit the account owner's signal so it is not represented
as a shared group preference. Saved defaults, authoritative player counts and
dedicated play entry are unchanged.

Evidence: 90 focused backend service/API/repository/entitlement and regression
tests passed, covering deterministic influence, the +/-5 bound, neutral
unranked/sparse/tied cases, edited ranking order, Free/Pro enforcement,
account scoping, named-player omission, hard exclusions, repeat avoidance and
surprise-mode shuffling. The frontend production build passed; no frontend
source file changed, so there was no changed frontend file to lint. A mocked
390x844 mobile Chrome pass verified the contributed explanation and absence of
horizontal overflow; `git diff --check` passed. No live account, production
data or external ranking source was used, and no schema changed. SP-PB02
remains blocked, photo upload remains post-beta and beta remains on hold.

### SP-PB16 — Add retail barcode scanning

**Status:** NOT STARTED. **Workstream:** Barcode lookup and collection entry. **Access:** Tier not specified.

Confirmed scope: scan retail EAN/UPC barcodes on game boxes. Split into SP-PB16A catalogue feasibility and SP-PB16B scan/add integration. First establish a permitted barcode-to-game/edition data source, actual coverage on representative boxes, commercial terms, costs and canonical BGG ID mapping; do not assume existing BGG endpoints supply this mapping. Then implement camera scan or manual code entry → matched game/edition preview → user confirmation → add to Owned/Want to Play. Handle ambiguous editions, no match, duplicate ownership, unsupported camera, permission denial and lookup failure with manual-search fallback. A successful camera decode alone does not complete this task. Game-link QR scanning is not a substitute for retail barcode support.

### SP-PB17 — Expand preset avatars

**Status:** COMPLETE — 28 September 2026. Photo upload deferred until after
beta and is not a beta blocker. **Workstream:** Profile. **Access:** Existing access for
all authenticated users; no new gate.

Offer more selectable preset avatars while preserving historical player
identities, initials fallback and consistent rendering across Profile, selected
players and Game Night. Do not assume a reusable player identity is an
authenticated account.

The bounded preset subtask expands the existing `avatar_key` catalogue from
Forest, Gold and Clay to six choices, retaining all three stored IDs and adding
Dice teal, Meeple rust and Card blue. One shared labelled radio grid is used by
Settings → Profile and onboarding; existing `PlayerAvatar` rendering carries
the same selection into app navigation, named-player Picker selection and
other current avatar surfaces. The existing profile endpoint/save flow is
unchanged apart from accepting the three additional bounded keys. Profile-only
saves do not resubmit preferences, and failed saves leave the controlled name
and avatar choice available for retry.

Evidence: five focused frontend catalogue/render tests and six backend
profile/API tests passed, as did the production frontend build, changed-file
lint and `git diff --check`. A mocked 390×844 Chrome pass selected Card blue by
keyboard, proved the choice survived an intentional failed save, saved it,
reloaded it from mock-server state and found the same small avatar in Picker.
The representative capture is
`docs/screenshots/sp-pb17/preset-avatar-profile-mobile.png`. Existing
SQLite-backed API persistence coverage was used because the database column and
schema did not change; the browser save/reload evidence is mocked, not a real
account or production check.

**Post-beta follow-up — photo upload:** Crop/preview/replace/remove, image
storage and upload controls are deliberately deferred until after beta. That
future slice must validate image type and size server-side, re-encode accepted
images, strip metadata, scope access/storage and delete replaced assets. The
original requirements are retained here, but this follow-up is not part of
SP-PB17 completion and must not block beta.
SP-PB02 remains blocked and beta remains on hold.

### SP-PB18 — Make Game Night a group decision with voting

**Status:** COMPLETE — SP-PB18A/B/C phone-voting scope, 28 September 2026.
**Workstream:** Group feature. **Access:** Pro via the existing
`game_night_enhanced` entitlement; basic Game Night stays Free.

Keep Game Night separate from Picker: attendees and constraints → eligible 3–5 game shortlist with group reasons → votes → clear winner/tie resolution → reveal → log play. Voting must affect the result, with at most one current ballot per attendee, editable choices and explicit abstention/tie handling. Confirmed joining flow: the host displays a session QR code; attendees scan it and vote on their own phones. Split into SP-PB18A session/membership and vote rules, SP-PB18B host QR and mobile guest voting, and SP-PB18C cross-device results/recovery. Propose guest participation without mandatory account creation, with host-confirmed attendee slots and session-scoped credentials; QR possession must not expose the host's account or grant host controls. Store ballots authoritatively on the server; prevent duplicate ballots for the same admitted participant, scope all writes to that session and avoid claiming anonymous access is identity-proof. Support refresh/reconnect, voting-open/closed/expired states, host close/revoke, invalid links, concurrent votes and shared winner display. QR sharing must work across different networks through the deployed app URL, not a localhost URL. Provide a copyable join-link fallback. Verify two independent phone/browser contexts plus host. Polling is acceptable if it meets the UX; do not assume WebSockets are required. Reset/reconfirm ballots when shortlist or attendance changes. Never fabricate attendee-owned collections or group preferences. Split session/vote rules and UI integration into separate tasks.

Delivered behaviour: the selected shortlist is snapshotted when its Pro host
opens voting and cannot silently change beneath existing ballots. The backend
stores only necessary candidate fields, hashes 32-byte URL-safe join and guest
credentials, scopes host controls to the owner, caps a session at 20 guests and
expires it after 12 hours. Guest joins reuse the bounded request limiter. A
unique session/guest constraint and idempotent PUT keep one editable ballot per
guest identity, including abstention; closed sessions reject writes. Request
logs redact join tokens. Modest four-second polling runs only on visible host
and guest voting screens. Results distinguish winner, tie and no-vote outcomes,
then preserve the host's existing final selection, reveal and play entry.

The implemented guest model uses a display name and session-scoped browser
credential without registration. Refresh/reconnect restores that browser's
identity and current ballot. It deliberately does not claim one real person
across different browsers/devices; host-confirmed reusable attendee identity,
explicit participant revocation, vetoes and invitations remain outside this
slice. No wider host collection, account details or play history are public.

Evidence: 40 focused backend service/API/entitlement/auth/logging tests passed.
An additive migration upgraded a fresh isolated PostgreSQL 16 database,
`alembic check` reported no drift, and a second database session restored and
changed exactly one persisted ballot before close. Eleven focused frontend
tests, ESLint, production build and `git diff --check` passed. A mocked two-
context Chrome flow at 390×844 covered open → join → vote → reload → change →
close → results with no horizontal overflow. macOS Vision decoded the rendered
QR payload to the exact displayed configured-origin join link. The
representative capture is `docs/screenshots/sp-pb18/game-night-phone-voting.png`.
Physical-phone scanning, two real devices/networks and a deployed origin remain
pre-beta checks. A manual end-to-end phone-voting run with an actual Pro host
also remains outstanding and is not marked complete by the mocked flow.
SP-PB02 remains blocked, photo upload remains post-beta and beta remains on
hold.

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
