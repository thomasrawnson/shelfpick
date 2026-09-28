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

The focused logo/brand correction completed on 26 September 2026. The supplied
`Cozy Board Game Shelf Icon.png` is retained as the canonical source and now
drives the Apple touch, standard PWA, dedicated safe-area maskable and square
social-profile exports. A matching simplified shelf-and-meeple mark, small
favicon and light/dark ShelfPick wordmarks replace the earlier generic mark.
BoardGameGeek attribution remains separate and unchanged.

The bounded Free versus Pro presentation pass completed on 26 September 2026.
Free is explained as a useful product across shelf management, Pick, play
tracking, Discover Hot/Top 100 and basic Game Night. The current Pro benefit is
limited to personalised For You recommendations; planned recommendation,
statistics and enhanced Game Night candidates are not presented as available.
Locked states route directly to the comparison with consistent language.
The agreed launch price is £3.99 as a one-off purchase, not a subscription.
Technically, no price is configured and checkout is not implemented, so the
purchase control remains honestly unavailable.

The implementation audit in `docs/free-pro-capability-audit.md` verifies that
For You is currently the only implemented Pro-only behaviour. All Picker modes,
Owned and Want to Play, play logging, Insights, Discover Hot/Top 100 and basic
Game Night are Free. Before checkout work, the recommended next slice is to
align granted entitlement names with shipped capabilities and harden For You’s
cold-start and source-failure behaviour. The agreed commercial decision remains
£3.99 as a one-off purchase, not a subscription.

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
