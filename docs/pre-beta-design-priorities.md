# Pre-beta design priorities

## SP-PB01 complete — 28 September 2026

Picker Log a play now uses a dedicated route and readable task layout with the
selected game and players prefilled. Save is the single primary action;
Back/Cancel restore the intact Picker result. Mocked Playwright verified the
screen at 390, 768, 1024 and 1440px in light/dark, including focus, reachable
actions, fixed-navigation clearance and horizontal overflow. Before/after
evidence is in `docs/screenshots/sp-pb01/`. External beta remains on hold.

The remaining 28 September backlog and sequence are recorded in
`docs/pre-beta-work-plan-2026-09-28.md`; SP-PB02 is next.

The agreed pre-beta priorities are:

1. UI/layout redesign;
2. logo/brand correction (approved illustrated shelf icon complete);
3. Free versus Pro proposition.

These are separate workstreams. UI work does not change the approved logo or
the Free/Pro proposition.

The SP-PB05 Appearance follow-up completed on 29 September. Settings now keeps
System, Light and Dark and adds **Black (experimental)** for Free and Pro. Black
uses the same semantic colour contract on a true-black canvas with near-black
surfaces, readable text, distinct borders and visible focus; the pre-React
bootstrap restores it before paint. Gaming Table (walnut/cream/brass), Anime
Arcade (midnight violet/coral/cyan) and Quiet Garden (sage/mist blue/soft
neutrals) are documented potential future Pro cosmetics only and are not
implemented or marketed.

The focused logo/brand correction completed on 26 September 2026. The supplied
`Cozy Board Game Shelf Icon.png` is retained as the canonical source and now
drives the Apple touch, standard PWA, dedicated safe-area maskable and square
social-profile exports. A matching simplified shelf-and-meeple mark, small
favicon and light/dark ShelfPick wordmarks replace the earlier generic mark.
BoardGameGeek attribution remains separate and unchanged.

The initial bounded Free versus Pro pass completed on 26 September 2026 and was
reconciled with subsequent shipped work on 28 September. Roadmap Slice 4's
comparison now leads with three benefit cards: more personal recommendations,
live in-app timing and Game Night voting from players' phones. The account's
current plan is explicit. The detailed matrix is grouped around building a
shelf, choosing a game, recording/sharing a play and planning together rather
than presenting an undifferentiated feature list.

Free remains a useful product: Collection, core Picker, manual duration and
location logging, personal rankings, branded sharing and basic Game Night are
retained. Pro hosts can open phone voting, while guests need neither Pro nor an
account. Picker ranking influence is count-based only and is not described as a
named-player group preference. Top 100 is marked Free by policy but unavailable
while SP-PB02's source is blocked. Timer copy promises only ShelfPick's in-app
timer and indicator; photo upload is absent. The one-off purchase model remains,
but without configured checkout the screen has no price or fake Buy action.

The 390×844 layout uses one-column benefit and plan cards with the comparison
remaining horizontally contained above the fixed navigation. At 1280×900 the
three benefit cards form a readable row. Mocked Free and Pro browser states,
keyboard focus, navigation clearance and overflow passed; the representative
capture is `docs/screenshots/free-pro-presentation/free-plan-mobile.png`.

Truthful For You personalisation states completed on 26 September 2026. The UI
now distinguishes results influenced by the user’s matching Owned shelf,
recorded plays or saved preferences from source-only popular fallback. Fallback
copy names its BoardGameGeek Hot/ranked basis and offers the existing Profile
preferences action without removing useful results. Empty, error, dismissed and
locked states remain separate. Recommendation scoring, ordering, access and
source behaviour are unchanged.

## UI/layout sequence

### UI-1 — confirmed defects

- BoardGameGeek artwork failures can show broken-image UI rather than a
  deliberate ShelfPick fallback.
- Fixed bottom navigation can overlap reachable content.
- Inactive controls can be too weak in dark mode.
- Collection artwork is undersized and repeated “Not played” metadata is noisy.
- Some Insights, Rankings and Discover sparse/empty-state copy is misleading.
- Legacy colour and `!important` overrides contribute to visual drift.

UI-1 is split into bounded implementation slices. UI-1A covers artwork
resilience and Collection readability. UI-1B covers bottom-navigation clearance
and dark inactive-control contrast. UI-1C covers sparse/empty-state copy and
targeted legacy override cleanup.

UI-1B validation completed on 24 September 2026. The signed-in shell preserves
the navigation-owned 128px bottom clearance plus `safe-area-inset-bottom`, so
the final content and controls remain reachable above the fixed navigation.
Enabled inactive controls use the existing primary-text token in dark mode;
selected and disabled states keep their established semantic treatment.
Playwright covered Picker, Collection, Game Night, Discover and Insights at
mobile and desktop widths in light and dark themes. No UI-1B issues remained;
UI-1C and stale artwork refresh remain separate work.

UI-1C validation completed on 25 September 2026. Empty Collection, filtered
Collection, empty Want to Play, zero-play Insights, missing participant
history, Discover no-match/source-error and Picker empty/no-match states
now communicate the actual condition and offer an existing route or control as
the next action. A service-provided owned-game count lets Picker distinguish an
empty shelf without changing eligibility or recommendation rules. Discover
continues to separate upstream failure, genuine no matches, locally dismissed
cards and the locked For You entitlement state. The duplicate legacy
Collection empty/chevron colour overrides were removed in favour of the
existing semantic tokens.

Focused backend and frontend tests, lint, build and colour validation passed.
Mocked Playwright fixtures covered 40 checks at 390×844 and 1440×900 in light
and dark modes without horizontal overflow. A separate read-only pass using the
dedicated test account verified Picker, Collection, Game Night, Discover and
Insights at 390, 768, 1024 and 1440px in both themes; it did not mutate account
or database data. Broader UI-2 polish and stale artwork refresh remain separate.

### Immediate correction — Discover Top 100 (complete)

Completed on 24 September 2026. The `top100` service path now accepts only
original ranked-source positions 1–100 before ownership filtering and its
existing 30-candidate metadata limit. Missing, invalid and above-100 ranks are
excluded, so owning the entire Top 100 produces a genuine empty result rather
than filling vacancies from lower-ranked games.

The underlying source still fetches and caches up to 500 candidates for 24
hours, including its stale outage fallback, so personalised Discover retains
its broader ranked pool. Authentication, cooldown and truthful source-failure
handling are unchanged. Customer-facing Discover and Free/Pro copy now says
**Top 100**, while `mode="top100"`, route/query parameters, saved state and the
existing `top500` telemetry key remain unchanged. Deterministic tests cover
fresh, warm-cache, stale-fallback, boundary, invalid-rank, ownership and
failure-versus-empty behavior. BoardGameGeek's ranked-page 403 remains an
external availability issue. UI-1B and UI-1C remain separate.

SP-PB02 reopened user-facing Top 100 availability on 28 September 2026 without
reopening the completed boundary correction. The investigation verified the
existing rank, ordering, ownership, error/empty, Hot-cache and For You
behaviour, but confirmed that cold retrieval still fails at the upstream source:
the ranked browse page returns HTTP 403 and the configured development
application token lacks access to BGG's official ranks dump. SP-PB02 is therefore
blocked, not complete; substituting Hot, admitting ranks above 100 or bypassing
the upstream restriction would make the product label misleading. Mocked
responsive captures of the verified result and retry states are stored in
`docs/screenshots/sp-pb02/`.

SP-PB05 Settings navigation completed on 28 September 2026. The former long,
mixed settings page is now a concise grouped overview, with substantial content
on dedicated Profile, Preferences, Appearance, Collection & Data, Plays, Pro,
Help and About routes. Rows use the existing surface, line, type and focus
tokens, remain full-width at mobile sizes and return keyboard focus after Back.
The About panel's Pluto Night Labs action uses the same link treatment, points
to `https://plutonightlabs.com/` and announces its protected new-tab behaviour.
The focused mobile Settings pass verified its keyboard access and exact
destination, which also resolved successfully over HTTPS.
Collection & Data contains only the existing BGG sync and BG Stats import flows
plus BGG attribution; account/profile controls remain elsewhere. Mocked
Playwright covered the overview and import route at 390 and 1440px in both
themes, including direct navigation, Back, persistence, focus, navigation
clearance and overflow. SP-PB09 Add game prominence and SP-PB20 wider copy
cleanup remain separate pending tasks.

SP-PB09 add-game discoverability completed on 28 September 2026. The ambiguous
Collection plus icon is replaced by a full labelled Forest action on populated
and filtered-no-match shelves. A genuinely empty shelf gives Add game primary
placement and keeps BGG import available through Collection & Data. The existing
inline BoardGameGeek search panel remains the only manual-add flow, with clearer
focus, status and recovery states; no barcode or new navigation concept was
introduced. Mocked Playwright covered populated, empty, filtered, search,
success, duplicate and failure/retry states at 390 and 1440px in both themes,
including Back/state restoration, keyboard focus, nav clearance and overflow.
SP-PB20 is recorded complete below.

SP-PB20 heading and supporting-copy cleanup completed on 28 September 2026.
Across Picker, Collection, Discover, Rankings, Insights, Game Night and Settings,
the primary states now have one page heading and supporting text appears only
when it adds scope, instruction or recovery. Repeated eyebrows, generic taglines
and the duplicated Ranking page heading were removed. Personalisation and
fallback context, empty/error actions, validation, units, Free/Pro explanations,
BGG attribution and accessible names remain because they change understanding
or support recovery. Mocked Playwright verified all seven screens at 390 and
1440px in light/dark, including heading semantics, keyboard focus, navigation
clearance and overflow; captures are in `docs/screenshots/sp-pb20/`.

SP-PB03 selected-player authority completed on 28 September 2026. The Picker
criteria screen now treats named selection and numeric group size as distinct
modes: named players produce one derived count with their names and Edit players,
while an explicit Use group size instead action returns to the unchanged numeric
control. This removes the contradictory editable count without reducing
count-only access. Mocked Playwright covered editing names, switching modes,
forward/Back retention and dedicated play-entry prefill at 390 and 1440px in
light/dark; captures are in `docs/screenshots/sp-pb03/`. SP-PB04 is recorded
complete below; SP-PB02 remains blocked and beta remains on hold.

SP-PB04 consistent saved Picker defaults completed on 28 September 2026.
Settings → Preferences now groups player count, play time and the existing
neutral/cooperative/competitive play-style values. All three seed fresh Picker
sessions, while explicit session choices survive Back, rerenders and dedicated
play entry. SP-PB03 named players continue to override saved count, and Start
over reapplies the latest saved defaults. Failed saves retain selections and
preference-only requests preserve unrelated profile fields. Mocked Playwright
covered the responsive Settings/Picker flow at 390 and 1440px in light/dark;
captures are in `docs/screenshots/sp-pb04/`. Isolated PostgreSQL save/reload and
migration checks passed and all temporary data was removed. SP-PB02 remains
blocked and beta remains on hold.

SP-PB10 and SP-PB11 completed on 28 September. The shared play form now places
the optional location beneath the date/duration group and uses a bounded Pro
timer panel with clear Start, Pause, Resume and Finish actions. Finished time is
returned to the ordinary editable duration field for review before saving.

SP-PB11's Pro live-duration scope includes one persistent in-app timer
indicator across authenticated navigation. It must show game, elapsed time and
running/paused state, reopen the same authoritative timer controls, and remain
clear of bottom navigation and primary actions. Background/reopen calculations
come from persisted timestamps and pause intervals rather than a second clock.
Responsive, accessibility, navigation and interrupted-session recovery checks
must include this indicator.

Outside-app timer visibility remains a separate unsequenced future Pro task. It
starts with an assessment of the current PWA/native packaging and supported
platforms before considering lock-screen/Live Activity or ongoing-notification
integration. Continuous visibility is distinct from a one-off notification;
unsupported background execution and notification permission are not promised
or introduced by SP-PB11.

Mocked responsive checks at 390 and 1440px in light/dark verified the indicator,
full controls, focus, navigation clearance and overflow; captures are in
`docs/screenshots/sp-pb10-11/`. Controlled-clock and real local PostgreSQL
checks cover lifecycle/recovery and persistence respectively. No real-device
background or lock-screen behavior is claimed. A real-phone background/reopen
check remains on the pre-beta checklist; outside-app timer/notification work is
still the separate future task described above. If Pro access is lost, timer
endpoints are gated but the existing active or finished timer row is retained
for restored access rather than silently discarded. SP-PB02 remains blocked
and beta remains on hold.

SP-PB12 branded saved-play sharing completed on 28 September with existing Free
access. Each persisted play in Collection history has a labelled Share play
action that opens a state-preserving preview and returns focus on Close or
Escape. The portrait export uses the approved ShelfPick logo and established
Forest/Gold styling, with the same renderer feeding preview, native file share
and PNG download. Names, scores and location are opt-in and hidden by default;
email-like labels are always redacted. Missing artwork/CORS failures use the
branded fallback, while missing scores and recorded cooperative, tie and shared outcomes
remain truthful. A focused mocked mobile pass and inspected exports are recorded
under `docs/screenshots/sp-pb12/`. Native OS sharing and physical-device output
remain pre-beta checks. SP-PB02 remains blocked and beta remains on hold.

The bounded SP-PB17 preset-avatar subtask completed on 28 September using the
existing authenticated Profile access. Settings → Profile and onboarding now
share a labelled three-column radio grid with visible selection and native
keyboard behavior. Forest, Gold and Clay keep their stored IDs; Dice teal,
Meeple rust and Card blue use the approved semantic palette and small tabletop
motifs while keeping initials legible in navigation and named-player Picker
rows. A mocked 390×844 browser pass covered keyboard selection, failed-save
retention, successful save/reload and Picker rendering; the capture is in
`docs/screenshots/sp-pb17/`. Photo upload/storage is still pending, SP-PB02
remains blocked and beta remains on hold.

### UI-2 — core visual polish

After UI-1 is stable, refine hierarchy, typography, spacing, component
consistency, responsive behaviour and the balance between artwork and controls.
Use existing tokens and shared primitives rather than adding screen-specific
visual exceptions.

UI-2A Picker polish completed on 25 September 2026. The result screen now gives
artwork, the game title and factual fit explanation a clear scan order. The
existing rounded match value moved from the artwork into a restrained status
row, while the existing metadata and More reasons disclosure keep supporting
detail available. Log a play remains the single primary action; Try another is
an outlined secondary action and Start over remains tertiary. Picker inputs,
recommendation scoring, eligibility and player-count safeguards are unchanged.

Frontend tests, lint, build, PWA and colour validation passed. Mocked,
authenticated Playwright checks covered populated results, long titles, missing
artwork, no matches and request errors at 390, 768, 1024 and 1440px in light and
dark themes. They also checked keyboard focus, reachable actions, horizontal
overflow and that one recorded play still exposes its valid Insights facts.
The local test account supplied authentication only; fixture data was isolated
and no account or database records were changed. Later UI-2 slices and the
broader UI-3 desktop shell remain separate.

UI-2B Collection polish completed on 25 September 2026. Owned and Want to Play
lists now share a clearer artwork, title and factual-metadata hierarchy across
mobile and the existing two-column desktop list. Positive play counts remain
visible, while repeated “Not played” copy was removed because missing ShelfPick
history does not prove that a game has never been played. Missing and failed
list/detail art now uses the shared UI-1 fallback, long titles wrap without
forcing horizontal overflow, and existing actions retain their hierarchy and
behavior.

Frontend tests, lint, build, PWA and colour validation passed. Deterministic,
authenticated Playwright fixtures covered populated, empty, filtered-empty,
loading and error states; long titles; missing and failed artwork; visible
keyboard focus; reachable actions; horizontal overflow; and list → detail →
browser Back restoration at 390, 768, 1024 and 1440px in light and dark themes.
Owned and Want to Play offsets were also verified to survive section switching
independently.
These were mocked checks only: no live account or backend data was accessed or
changed. UI-3's future desktop shell/card architecture remains separate.

### UI-3 — full-width, content-forward desktop

Move data-rich desktop surfaces beyond the current narrow app-shell treatment
into a full-width, content-forward layout where game artwork has greater visual
weight. The future desktop card/grid treatment belongs here, not in UI-1.

## Visual principle and guardrails

The visual principle is **“warm shelf, confident choices.”** Warm neutrals
provide structure. Forest mainly indicates action and selection. Gold is
restrained emphasis. Game artwork should carry more visual weight.

Game Night remains in primary navigation as a distinct host-led flow and must
not be merged with Picker. Across UI-1, UI-2 and UI-3:

- preserve all recommendation rules;
- preserve exact-player-count suitability logic;
- preserve the BoardGameGeek Not Recommended >=30% exclusion rule;
- preserve routes, deep links and browser Back behaviour;
- preserve collection state and scroll restoration;
- do not change backend/domain behaviour unless strictly required for artwork
  fallback handling;
- do not change the logo or Free/Pro proposition as part of UI work;
- do not deploy, migrate production data or change secrets as part of these
  implementation slices.
