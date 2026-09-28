# ShelfPick pre-beta work plan — 28 September 2026

## Decision — 28 September 2026

**External beta testing is ON HOLD at Tom's request.** Complete and validate the requested pre-beta work below before reconsidering invitations. Internal development/testing continues. This supersedes older instructions to run beta immediately after Game Night MVP, and moves the scoped live duration, challenges and recommendation work ahead of beta. Existing completed work is not reopened unless a regression is reported.

This is an implementation backlog, not a claim that features are shipped. All tasks below are **NOT STARTED**, except that identified scope decisions are pending clarification. Billing is separate and remains disabled until implemented. The existing repository records £3.99 one-off Pro, not a subscription; expanded scope does not automatically change price or promise lifetime future features.

## Delivery sequence

1. Repair SP-PB01–02, then Picker flow SP-PB03–04.
2. Settings and presentation SP-PB05–09.
3. Play foundation SP-PB10–11, statistics SP-PB14, then sharing SP-PB12–13.
4. Recommendation SP-PB15; scanning SP-PB16 and avatars SP-PB17 can proceed independently once decisions are resolved.
5. Game Night SP-PB18 and challenges SP-PB19.
6. Reconcile shipped Free/Pro claims and entitlements; validate all new work and existing operational release gates. Ask Tom to resume beta; do not resume automatically.

Task IDs are new backlog IDs and do not replace historical roadmap slice IDs. Implement one bounded sub-slice per reviewable change; split larger data/UI work further when needed.

## Decisions and provisional interpretations

- Confirm which ranking score is intended and which Rankings surface feels misplaced.
- Confirm QR game links versus retail barcode scanning.
- Confirm host-device voting versus remote participant voting for Game Night.
- The final Collection bullet is incomplete; provisionally treat it as making Add game more prominent.
- Location as optional text, Inter, suggested filters, Free branded sharing and the challenge templates below are proposed implementations, not additional user-confirmed requirements.
- Only live duration, ranking-based recommendation enhancements and challenges are explicitly newly designated Pro. Preserve current access for other functionality until a tier decision is made.

## Task acceptance criteria

### SP-PB01 — Repair Picker Log a play

**Status:** NOT STARTED. **Workstream:** Fix • first. **Access:** Existing Free access.

Open a dedicated play-entry screen from the Picker result, prefilled with the selected game and players. Save once, show confirmation, and return predictably; Back/Cancel preserves the Picker result and inputs. Remove the compressed inline form and oversized left-side Cancel. Verify real persistence using isolated test records, validation errors, retry and duplicate-submit protection.

### SP-PB02 — Restore Discover Top 100

**Status:** NOT STARTED. **Workstream:** Fix • first. **Access:** Existing Free access.

Reproduce the reported failure and distinguish API/source errors, cold-cache availability, metadata failure and client rendering. Keep original BGG positions 1–100, ownership filtering and truthful empty/error states. Never substitute Hot games under a Top 100 label or backfill ranks >100. Verify cold start, warm/stale cache and restart behaviour; record source provenance and freshness. The previous rank-boundary implementation stays complete; user-facing availability is reopened. Use a permitted source; do not bypass upstream restrictions.

### SP-PB03 — Make selected players authoritative in Picker

**Status:** NOT STARTED. **Workstream:** Flow correction. **Access:** Existing Free access.

When named players are selected, derive count from that selection and remove the duplicate editable count control on the preceding criteria screen. Show a read-only count summary with Edit players. Preserve count-only use when no named players are selected. Test Back/forward, removing players and reset without contradictory counts. This is the provisional interpretation of the user's back-navigation report; reproduce before implementation.

### SP-PB04 — Default play style from preferences

**Status:** NOT STARTED. **Workstream:** Flow correction. **Access:** Existing access.

Persist cooperative / competitive / no preference and initialise Picker from that saved value. A session override must remain possible without silently overwriting the profile. Back navigation retains the session choice. Existing users with no saved value use no preference. Audit which other flows already consume this preference before extending them.

### SP-PB05 — Restructure Settings navigation

**Status:** NOT STARTED. **Workstream:** UI. **Access:** Existing access.

Use labelled headings and concise rows opening dedicated subpages for substantial forms; use dialogs only for short choices. Cover Profile, Preferences, Appearance, Collection & Data, Plays, Pro, Help and About using working actions only. Preserve deep links, Back, focus return and unsaved-input behaviour. Import must not display unrelated Profile settings. Retain official BGG attribution at relevant sync surfaces.

### SP-PB06 — Refresh typography

**Status:** NOT STARTED. **Workstream:** UI. **Access:** All users.

Prepare and implement a consistent Inter-led direction across app headings, body, labels and statistics using shared typography tokens; preserve the approved logo asset and colour palette. Proxima Nova remains an alternative requiring a supplied/licensed font. Validate long game titles, font fallback, mobile density and light/dark readability. Current Lora/Nunito tokens are the implemented baseline until this task lands.

### SP-PB07 — Improve Rankings placement

**Status:** NOT STARTED. **Workstream:** UI decision then implementation. **Access:** Existing access.

Inspect the current Rankings route and user journey. Compare contextual access from Collection/game detail with placement inside Insights, then select a coherent home without inventing a new top-level navigation destination by default. Preserve saved rankings, deep links and Back. Clarify whether the report concerns the Rankings screen, ranking input or score placement before structural changes.

### SP-PB08 — Reduce Friends' favourites padding

**Status:** NOT STARTED. **Workstream:** UI. **Access:** Existing access.

Reduce excess card/section padding and empty space while preserving artwork, readable labels, 44px touch targets and truthful sparse states. Check zero, one and multiple friends/participants and long names on mobile and desktop.

### SP-PB09 — Expand Collection filters and strengthen Add game

**Status:** NOT STARTED. **Workstream:** Collection UI. **Access:** Existing access.

Audit existing filters first; proposed additions are player count, duration, complexity, cooperative/competitive and recorded/unrecorded play history, only where data supports truthful filtering. Combine filters, show active count, clear/reset and no-match recovery; retain independent Owned/Want to Play state and scroll. Make Add game a prominent labelled action on populated and empty views. 'More prominent' is provisional because the user's final bullet was truncated.

### SP-PB10 — Add optional play location

**Status:** NOT STARTED. **Workstream:** Play data. **Access:** Proposed Free; not a confirmed new gate.

Add editable location text to create/edit/detail play flows; blank remains valid for existing/imported plays. Proposed scope is a venue label such as Home or a club, without GPS/maps. Preserve user isolation and import compatibility. Exclude location from shared graphics by default and allow deliberate opt-in.

### SP-PB11 — Record live play duration

**Status:** NOT STARTED. **Workstream:** New feature. **Access:** Pro — explicitly requested.

Add Start, Pause, Resume and Finish with visible elapsed duration and a route back to the active session. Derive elapsed time from persisted timestamps/pause intervals so backgrounding, reload and suspended tabs do not lose or invent time. Finishing prefills the play form; saving is explicit and creates one record. Allow correction, prevent negative durations and recover interrupted sessions. Enforce Pro on backend and frontend while preserving basic manual play logging. Depends on SP-PB01; define concurrent-session behaviour before implementation.

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

First identify whether the requested signal is personal ShelfPick rankings, user ratings or global BGG rank/rating; these must not be conflated. Audit existing rating contributions to avoid double counting. Implement a bounded, explainable contribution in Discover For You with neutral missing-data behaviour and regression examples. Preserve all hard eligibility, exact-player suitability and BGG Not Recommended >=30% exclusions; no global Hot/Top 100 reordering. Picker use is a separate optional sub-slice after evaluating Discover results, not an assumed approved scoring formula. Add genuine Free/Pro enforcement without gating existing Free scoring.

### SP-PB16 — Add game scanning

**Status:** NOT STARTED. **Workstream:** New feature / format decision. **Access:** Tier not specified.

Confirm QR containing BGG/ShelfPick game links versus retail EAN/UPC barcode scanning. Proposed first scope: supported game-link QR → resolved game preview → confirm Owned/Want to Play, with duplicate detection, permission-denied handling and manual-search fallback. Reject unsupported payloads safely without arbitrary URL fetching. Retail barcode lookup is a distinct dependency requiring a reliable game catalogue mapping; do not promise it as equivalent to QR.

### SP-PB17 — Expand avatars and support photo upload

**Status:** NOT STARTED. **Workstream:** Profile. **Access:** Tier not specified.

Offer more selectable avatars and a separate upload-photo slice with crop/preview/replace/remove. Validate image type and size server-side, re-encode accepted images, strip metadata, scope access/storage and delete replaced assets. Preserve historical player identities, initials fallback and consistent rendering across Profile, selected players and Game Night. Do not assume a reusable player identity is an authenticated account.

### SP-PB18 — Make Game Night a group decision with voting

**Status:** NOT STARTED. **Workstream:** Group feature. **Access:** Enhanced voting tier to confirm; basic Game Night stays Free.

Keep Game Night separate from Picker: attendees and constraints → eligible 3–5 game shortlist with group reasons → votes → clear winner/tie resolution → reveal → log play. Voting must affect the result, with at most one current ballot per attendee, editable choices and explicit abstention/tie handling. Proposed MVP is host-device pass-and-play; remote guest voting is a separate sub-slice pending confirmation, requiring session membership and persisted votes. Reset/reconfirm ballots when shortlist or attendance changes. Never fabricate attendee-owned collections or group preferences. Split session/vote rules and UI integration into separate tasks.

### SP-PB19 — Add play challenges

**Status:** NOT STARTED. **Workstream:** New feature. **Access:** Pro — explicitly requested.

Proposed MVP: a personal goal for total recorded plays and a play-X-distinct-games-Y-times challenge, with date range, progress and completion. Progress derives from real play records and recalculates after edit/delete/import; existing plays in the chosen range count consistently. Include create/view/archive, empty/error states and backend/frontend Pro enforcement. Define timezone and quantity counting; no leaderboards or reward economy in this slice. Depends on play-data reliability and SP-PB14 counting semantics.

## Shared definition of done

- Reproduce reported defects before fixing; distinguish mocked tests from live evidence.
- Use focused domain/API tests for state, persistence and entitlement changes; use an isolated test database for play/repository changes.
- Validate affected flows at 390, 768, 1024 and 1440px in light/dark, including keyboard focus, Back, reachable actions and no horizontal overflow.
- Preserve exact-count suitability, BGG Not Recommended >=30% exclusion, user isolation, routes and collection scroll/saved state. Recommendation scoring changes are confined to SP-PB15.
- Preserve approved ShelfPick assets and separate official BGG attribution. Do not expose planned capabilities as delivered benefits.
- Update ROADMAP.md, DESIGN.md where applicable, docs/pre-beta-design-priorities.md and docs/free-pro-capability-audit.md after each delivered task, with evidence and limitations.
- Keep deployment, production migration, purchases and live account mutations outside routine isolated validation. Beta remains on hold until requested scope is verified, remaining decisions resolved, operational gates pass and Tom explicitly resumes it.
