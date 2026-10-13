# SP-PB12 / SP-PB13 — Sharing audit and implementation plan

**Date:** 11 October 2026
**Scope:** The initial audit was planning-only. The bounded SP-PB12B
and SP-PB13 implementation records are included below.

## SP-BETA-08 export-policy closeout — 12 October 2026

**Status: COMPLETE LOCALLY.** The SP-PB12B and SP-PB13 renderers retain their
1200x1500 cover-led layouts, but cover inclusion is now controlled by the
server's `EXPORT_COVER_ARTWORK_ENABLED` setting and defaults off. The public
configuration response contains only the non-sensitive boolean policy. Both
dialogs resolve it before rendering; only strict `true` enables the existing
cover path, while API/configuration failure uses branded initials. Users have
no UI control for this policy. The same generated blob still supplies preview,
PNG download and native sharing, and normal in-app covers are unaffected.

Tests cover server defaults, explicit true/false values, invalid startup
values, endpoint output, malformed/unavailable client configuration and both
renderer modes. The full backend suite passed 303 tests with five existing
conditional skips; the full frontend suite passed 92. Alembic, ESLint, build,
PWA and diff checks passed. Chrome passed both sharing flows at 390x844 and
1440x900 in light/dark and demonstrated that fallback export made no additional
cover request. The inspected play and four-game recap PNGs preserve privacy,
layout and attribution. Permission remains an external prerequisite for ever
setting the flag to true; fallback-only exports do not establish rights to the
underlying in-app artwork.

## SP-PB12B implementation record — 12 October 2026

**Status: COMPLETE. Complexity: Medium.** The existing 1200x1500 canvas,
preview dialog, privacy controls, native file sharing and download fallback were
retained. The cover now leads from a Forest-soft stage and uses contain geometry
for portrait, landscape and square artwork, preserving the complete source and
its aspect ratio. Detail-rich variants shorten the stage slightly to keep all
variable content above a fixed footer safe zone. Missing or failed artwork uses
an intentional initials tile. Title, date/recorded duration, opted-in location,
truthful result and a bounded participant summary retain a stable reading order;
the approved wordmark and BoardGameGeek data attribution close the poster.

The shared content builder now replaces every email-like address in opted-in
location text with `[email hidden]`. Sanitisation occurs before preview alt text
or rendering, so preview, PNG download and native file share consume the same
redacted content without changing the saved play. Existing participant-name
redaction and private defaults are unchanged.

Validation: 12 focused sharing tests and all 76 configured frontend tests
passed, as did ESLint, production build, PWA and diff checks. Focused coverage
includes email-only, embedded, multiple and mixed-case location addresses, all
eight privacy combinations, recorded/missing duration, outcome semantics,
portrait/landscape/square contain geometry, missing artwork, long titles and
generation failure. Playwright passed 390x844 and 1440x900 in light/dark for
responsive modal layout, visible keyboard focus, Escape focus restoration,
action/navigation clearance and horizontal overflow. A downloaded PNG matched
the preview blob byte for byte. Representative 1200x1500 exports and modal
captures are in `docs/screenshots/sp-pb12b/`.

The colour-review command also completed successfully. It reports ten review
notices: nine fixed canvas colours deliberately centralised in the export
palette and one pre-existing Game Night CSS colour; it is an advisory check,
not a failed gate.

No dependency, endpoint, database, migration, entitlement, monthly recap or
production change was introduced. Physical iOS/Android share-sheet validation,
representative live BGG artwork hosts and confirmation of commercial artwork
redistribution/attribution rights remain launch checks. The branded fallback is
available if that approval does not cover exported cover images.

## SP-PB13 implementation record — 12 October 2026

**Status: COMPLETE. Complexity: Medium. Access: Free.** Authenticated
`GET /insights/monthly-recap?month=YYYY-MM&timezone=IANA_ZONE` validates both
inputs and converts local month boundaries to an inclusive-start/exclusive-end
UTC range, including DST changes. A bounded grouped query returns actual total
plays, unique games, nullable recorded duration, duration coverage,
deterministic most-played and up to four collage games. Equal play counts use
latest play descending, case-insensitive name ascending and BGG ID ascending.
The contract contains no player, score or location data and sanitises invalid
artwork URLs to null. There is no migration or external BGG request.

Insights → Recaps defaults to the current browser-local month, navigates prior
months without enabling future months, preserves selection through loading and
retry, and disables sharing for an empty month. The 1200x1500 cover-led collage
contains one to four complete covers or responsive branded fallbacks, truthful
duration coverage, most-played, approved branding and BGG attribution. Preview,
native file share, cancellation, PNG download and focus behavior follow the
SP-PB12B dialog conventions; preview and download use the identical blob.

Validation: 10/10 focused service/API/PostgreSQL tests passed. Full suites passed 287 backend tests with five conditional skips and 80
frontend tests. ESLint, build, PWA, advisory colour review and diff checks
passed. Playwright passed 390x844 and 1440x900 in light/dark, covering month
navigation, partial/missing duration, forced error/retry, empty/sparse months,
focus restoration, navigation clearance, overflow and byte-identical export.
Synthetic 1200x1500 evidence is under `docs/screenshots/sp-pb13/`.

Physical iOS/Android share-sheet behavior and representative live BGG hosts
remain launch validation. Commercial cover redistribution and attribution
rights remain an external release dependency; the complete fallback-only card
was verified and no new artwork source was introduced.

## Recommendation

Keep the existing saved-play flow and 1200x1500 canvas pipeline. Deliver the
work in two bounded slices:

1. **SP-PB12B — Cover-led saved-play card refresh — COMPLETE.** Corrected the
   artwork treatment and tightened the existing composition without changing
   entry points, native sharing or download behaviour.
2. **SP-PB13 — Monthly recap sharing — COMPLETE.** Added the bounded endpoint,
   Recaps month flow and deterministic cover-led image using the established
   sharing behavior.

Both remain Free. Do not couple either slice to SP-PB14 statistics, Pro
entitlements or a new sharing service.

## Existing saved-play sharing

### What already works

- Persisted plays in Collection game history expose a labelled **Share play**
  action. `GameHistory.tsx` opens a native modal dialog without changing route
  or game-detail state and restores focus after Close or Escape.
- `PlayShareDialog.tsx` uses one generated PNG for the visible preview, native
  file share and download, so exported content cannot diverge from the preview.
- `share-card.ts` produces a 1200x1500 PNG, a useful 4:5 portrait ratio for
  Instagram feed posts and general messaging apps. It includes the approved
  light ShelfPick wordmark with a text fallback.
- The game title and locale-formatted play date are always present. Positive
  duration, an opted-in location, and an authoritative recorded result are
  conditional. Missing duration and scores are not rendered as zero.
- Player names, scores and location are independent controls. All begin private;
  player names and location remain hidden by default, and email-like participant
  names are replaced with neutral player labels even when names are selected.
- Cooperative wins, scored ties, shared wins and a single recorded winner are
  distinguished from one another without calculating an unrecorded result.
- Remote artwork is requested with anonymous CORS, bounded by an eight-second
  timeout, and replaced by a branded initials tile on missing, failed or unsafe
  image reads. Logo failure falls back to a ShelfPick text mark.
- Generation has explicit busy, error and retry states. Native sharing is shown
  only when file sharing is supported; PNG download remains available. An OS
  share cancellation is not presented as failure, and copy accurately says
  ShelfPick did not post automatically.
- The preview dialog is responsive, scrollable and safe-area aware. Controls are
  semantic, labelled, keyboard reachable and at least the shared minimum target.
- Seven focused renderer/privacy tests currently pass. Existing captures include
  normal, detail-rich, long-title and missing-artwork outputs.

### Confirmed defects

1. **Portrait cover art is cropped as a landscape banner.** The renderer fills a
   fixed 1056x530 region with `Math.max(...)`. Most board-game box covers are
   portrait, so the exported card can remove substantial top and bottom artwork.
   The preview's CSS is not the cause; the crop is baked into the PNG.
2. **The privacy promise is wider than the redaction.** The dialog says email
   addresses are never included, but only participant labels are checked. An
   opted-in free-text location containing an email address would be exported.
   Either redact email-like text in every opted-in free-text field or narrow the
   promise to participant names. Redaction is preferred.

### Visual opportunities, not defects

- The current card reserves a large blank middle/lower region when participants
  are private. The information is readable but the composition feels like a
  form placed on a poster rather than a deliberately shareable keepsake.
- The date, duration and result have limited grouping, while optional participant
  rows can make the same layout suddenly dense. A stable information zone would
  give both states a clearer hierarchy.
- Canvas colours and typography correctly match the light Forest/Gold system,
  but their literals are repeated inside the renderer. Named export-theme
  constants would make reuse safer without trying to read runtime CSS tokens.
- Waiting for `document.fonts.ready` before capture would make Lora/Nunito output
  more deterministic on a cold PWA load; system/Georgia fallback must remain.
- Actual native share sheets, representative BGG image hosts and physical-device
  output remain launch validation, not evidence supplied by unit/build checks.

### Technical audit score

| Dimension | Score | Key finding |
| --- | ---: | --- |
| Accessibility | 3/4 | Strong native dialog semantics and focus return; physical assistive-technology validation remains outstanding. |
| Performance | 3/4 | Lean dependency-free canvas path with bounded image loads; cold font readiness and representative remote hosts remain unverified. |
| Responsive design | 4/4 | Token-based modal adapts cleanly to mobile/desktop and existing mocked mobile evidence found no overflow. |
| Theming | 3/4 | Preview UI is fully tokenised; the intentionally light export repeats palette literals that should become named renderer constants. |
| Implementation integrity | 3/4 | One coherent preview/export pipeline; the cover crop and over-broad privacy claim are isolated defects. |
| **Total** | **16/20 — Good** | Preserve the architecture and address the two verified defects in SP-PB12B. |

Severity count: **P0 0, P1 1, P2 1, P3 2**. The P1 is the possible
email-address export through opted-in location text; the P2 is destructive cover
cropping. Renderer constants/font readiness are P3 polish. The Impeccable
detector could not run because its local engine is not installed and setup would
require an external download; findings above were verified directly against the
code, tests and existing exported PNGs.

## Saved-play visual directions

### Direction A — Cover-led editorial poster (recommended)

Use the upper half to two-thirds as a quiet Forest-soft artwork stage. Fit the
complete cover with `contain`, preserving its aspect ratio and using the existing
soft surface around it instead of cropping it. Place the title immediately below
at the largest text size, capped at two or three lines with deterministic
ellipsis. Group date and recorded duration as compact metadata, then give the
recorded result one restrained Gold-soft band. Optional location and participant
details occupy a bounded lower information zone. Keep the approved wordmark and
the quiet “A play from my shelf” sign-off in the footer.

This is recommended because it makes the actual game recognisable, fits
ShelfPick's collection-led design principle, works with one cover, and preserves
the established 4:5 format, brand assets and renderer. A missing cover becomes
an intentional initials/book-spine tile in the same stage, not a broken state.

### Direction B — Tabletop scorecard

Use a smaller cover beside a strong title/result block, followed by a structured
scorecard for date, duration, location and participants. It handles detail-rich
plays efficiently, but makes private/default cards feel sparse and gives artwork
less social impact. Retain it only as a fallback concept if user review shows
that detailed score sharing matters more than cover recognition.

Do not add gradients, decorative glass, a second logo, a QR code, account data,
or new visual tokens in either direction.

## Monthly recap feasibility

### Existing data that can be reused

- Authenticated `GET /insights` already returns current-month play count, unique
  games, new/repeat counts and up to 20 recent play rows. The Recaps section in
  `InsightsView.tsx` already presents **This month in games**, making it the
  correct home for the action.
- The `plays` table already stores account-scoped game, timestamp and nullable
  duration, and has a `(user_id, played_at)` index. Games already store BGG ID,
  name, image and thumbnail URLs. No migration is required.
- The SP-PB12 canvas/image loader, text fitting, fallback treatment, logo,
  blob generation, filename, preview, native file sharing and download behaviour
  can be reused. The monthly image must not reuse single-play privacy controls
  because it contains no player names, scores or location by default.

### Why a focused endpoint is necessary

The current Insights payload cannot truthfully render the proposed recap. It is
fixed to the server's current UTC month, limits detail to 20 plays, has no
monthly duration or duration-coverage signal, no monthly most-played aggregate,
and no artwork fields. Computing from those rows in the browser would become
wrong after 20 plays and would not support previous months.

Add an authenticated endpoint such as:

`GET /insights/monthly-recap?month=2026-10&timezone=Europe/London`

Validate `YYYY-MM` and an IANA timezone. Convert the selected local month's
start/end to UTC once and query the half-open interval. Reject invalid or
unreasonably long timezone values with structured 422 validation. Keep every
query scoped to the authenticated user.

The response should contain:

- canonical month and display label;
- `total_plays` and `unique_games`;
- `recorded_duration_minutes: number | null` plus
  `plays_with_recorded_duration`, so missing duration is distinguishable from
  a recorded zero and the UI can say “Recorded time” rather than total time;
- `most_played: { bgg_id, name, play_count } | null`;
- up to four deterministic collage games with name, BGG ID, image URL,
  thumbnail URL, play count and last-played timestamp.

For equal play counts, select “most played” and collage order by latest play in
the selected month, then case-insensitive game name, then BGG ID. This gives a
stable result without inventing preference. Count every actual persisted play,
including imported plays, once. Do not infer duration, scores or unrecorded
sessions.

### Recap interaction and layout

- Put a labelled **Share month** action in the selected-month recap card heading,
  adjacent to the month label rather than in global navigation. Disable/omit it
  for an empty month and explain that there is nothing recorded to share.
- Add an associated month input in Recaps, defaulted to the user's current local
  month and capped at the current month. Changing it reloads that month's recap
  without changing route or other Insights sections. Preserve the selected
  month on recoverable request errors.
- Keep the 1200x1500 (4:5) PNG. Lead with month/year and a collage, then show
  plays, unique games, recorded duration when known, and most-played when one
  exists. Label the time **Recorded time** to avoid implying full coverage.
- Use one large cover for one game, two balanced covers for two, one large plus
  two smaller covers for three, and a 2x2 collage for four. Each failed image is
  replaced independently with the same polished initials tile. Zero successful
  images still produces a complete branded recap.
- The preview has no player, score or location controls and exports no account
  identifiers. It reuses explicit Share image/Download image actions and the
  accurate no-auto-post copy from SP-PB12.

## Licensing and external approval

No new library or paid service is technically required. ShelfPick already stores
BGG-supplied image URLs, but export embeds those images in a new shareable PNG.
BGG's current [XML API terms](https://boardgamegeek.com/xmlapi/termsofuse)
require attribution for public-facing API use and separate permission for
commercial use. BGG's [image guidance](https://boardgamegeek.com/wiki/page/Image_submissions)
also says uploaders retain rights and outside reuse requires permission. The
repository documents an approved application token but not the
commercial/image-redistribution grant.

Therefore production distribution of cover-bearing share images requires owner
confirmation of the existing BGG commercial agreement and image/attribution
scope. Do not scrape, proxy unlicensed images, or assume an API image URL grants
redistribution rights. If approval does not cover exported images, ship the same
layouts with branded title/initial tiles only until an authorised artwork source
is available.

## Testing strategy

### Saved-play card

- Golden/content tests for normal portrait, landscape, very tall and missing
  artwork; assert contain-style source rectangles and a branded fallback.
- Long single-word and multi-line titles remain within the title region without
  overlapping metadata, participant details or footer.
- Missing duration and score stay absent; recorded zero is not relabelled as
  missing where the API permits it; cooperative, tie, shared and single-winner
  labels remain authoritative.
- Default privacy excludes names, scores and location. Each opt-in is independent;
  email-like participant and location text is redacted from content and pixels.
- Preview, generated file, native share and download use the same blob. Cancellation,
  unsupported share, generation failure and retry retain accurate feedback.
- Dialog opens/closes by keyboard, Escape and buttons; focus returns; busy/error
  states are announced. Inspect 390, 768, 1024 and 1440px in light/dark with no
  overflow or primary-navigation overlap.
- Inspect actual 1200x1500 PNGs on representative mobile and desktop browsers;
  separately verify an actual iOS/Android share sheet and downloaded file.

### Monthly recap

- Repository/service/API tests cover account isolation, local month boundaries
  across UTC offsets and DST, current/previous month selection, imported plays,
  more than 20 plays, and no cross-month leakage.
- Empty month returns zero counts, null duration/most-played and no collage; the
  UI offers no share action. One-play and one-game months render a balanced card.
- Duration is null when no play records it, sums only recorded values otherwise,
  and returns its coverage count. Scores and participant/location data are absent
  from the response and image contract.
- Equal counts follow latest-play, case-insensitive-name and BGG-ID tie-breaking.
  Repeated calls over unchanged data return identical content and collage order.
- One, some and all cover loads may fail without failing export. Four selected
  covers remain deterministic when more games exist; long names do not overflow.
- Month control is labelled, keyboard usable, capped against future months and
  retains selection through loading/error/retry. Preview, sharing and download
  meet the same responsive/accessibility checks as the saved-play dialog.

## Bounded implementation tasks

### SP-PB12B — Saved-play card presentation

**Complexity: Medium.** Frontend only; no dependency, API, schema or entitlement
change.

Likely files: `frontend/src/share-card.ts`,
`frontend/src/components/collection/PlayShareDialog.tsx`,
`frontend/src/styles/collection.css`, `frontend/src/share-card.test.mjs`,
`DESIGN.md`, roadmap/planning evidence and `docs/screenshots/sp-pb12b/`.

Acceptance criteria:

- Direction A is implemented at 1200x1500 with complete, prominent cover art and
  polished independent fallback.
- Default and all opted-in content variants retain clear hierarchy; long titles,
  five-plus players and long locations cannot overlap or escape the canvas.
- Existing privacy, result semantics, preview/blob identity, native share,
  download, retry, route preservation and focus restoration remain unchanged.
- Email-like opted-in free text is redacted consistently, and the privacy copy is
  truthful. Approved ShelfPick assets and existing dependencies only.
- Focused tests, full frontend suite, lint, build, colour/PWA checks and
  `git diff --check` pass. Playwright covers the responsive/theme/state matrix;
  exported PNGs and at least one actual mobile share/download flow are inspected.

Dependencies: approved logo already exists. Confirm BGG artwork redistribution
scope before treating cover-bearing output as launch-approved.

### SP-PB13 — Monthly recap sharing

**Complexity: Medium.** One bounded account-scoped read endpoint plus frontend
Recaps integration; no migration, dependency, Pro gate or unrelated statistic.

Likely backend files: `backend/api/routers/insights.py`,
`backend/services/insights_service.py`,
`backend/repositories/insights_repository.py`,
`backend/models/collection_insights.py`, focused insights tests and API tests.

Likely frontend files: `frontend/src/api/client.ts`,
`frontend/src/components/InsightsView.tsx`, a focused monthly share dialog,
shared renderer utilities in `frontend/src/share-card.ts` (or a narrowly named
companion), `frontend/src/styles/insights.css`, focused recap tests, DESIGN and
roadmap/planning evidence.

Acceptance criteria:

- A selected local calendar month produces account-scoped, deterministic totals,
  duration coverage, most-played and up to four collage games from actual plays.
- Current and previous months are selectable; future months are unavailable;
  loading/error/retry preserve the chosen month. Empty months cannot be shared.
- The branded 1200x1500 recap handles one/few/many plays, long names, partial/all
  artwork failure and missing duration without invented values or private data.
- Preview, native share and download reuse SP-PB12 behaviour, remain Free and do
  not claim an upload or automatic post.
- Focused service/repository/API and renderer/UI tests pass, including timezone,
  DST, account-isolation and deterministic tie cases. Run full frontend/backend
  suites, lint, build, PWA and `git diff --check`; inspect the responsive matrix,
  representative PNGs and a physical mobile share/download path.

Dependencies: SP-PB12B's stable renderer utilities and the same external artwork
rights confirmation. There is no technical or database blocker.

## Closeout decision

SP-PB12B and SP-PB13 are complete. Confirm cover redistribution/attribution scope
and perform physical-device share-sheet validation before treating cover-bearing
outputs as launch-approved. The next planned product slice is the bounded
SP-PB14 statistics/Free-versus-Pro proposal; do not infer or add an entitlement
until that separate product decision is approved.
