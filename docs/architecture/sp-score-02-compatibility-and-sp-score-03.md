# SP-SCORE-02 — ShelfPick compatibility and SP-SCORE-03 proposal

Date: 1 November 2026  
Companion catalogue: [`../research/sp-score-02-board-score-hub-catalogue.md`](../research/sp-score-02-board-score-hub-catalogue.md)

## Decision

Use independently authored, versioned, data-driven templates keyed by exact BGG ID. Do not import BoardScoreHub React screens, definitions, prose or assets. The existing SP-SCORE-01 pure calculation boundary remains the right base; extend its schema only when an approved template proves a missing primitive.

Of the 53 native BoardScoreHub models, 51 can produce equivalent totals using the current SP-SCORE-01 primitives. Pixies and Sea Salt & Paper require repeated multi-category rounds. Convenience parity also exposes bounded gaps: fixed-value and exclusive awards, per-player-count field/round visibility, dynamic “first to threshold” rounds, replacement field groups, and explicit non-points victories. None requires changing existing play tables to ship the first three templates.

## Current architecture compatibility

| Concern | Current truth | Proposal / gap |
|---|---|---|
| Template identity | SP-SCORE-01 requires `template_id`, `version`, optional `bgg_id` | Keep an immutable catalogue keyed by BGG ID plus explicit template version; never title-match. Reject duplicate BGG IDs and unknown versions. |
| Calculation | Generic, equal-length rounds and categories; numeric multipliers/groups; boolean conditions; variants/expansions | Enough for the first three. Later add declarative fixed-value/exclusive fields, player-count visibility, replacement groups and repeated category rounds only with focused tests. Never embed arbitrary code/functions in template data. |
| Players and winners | Prototype supports 1–32 player/team entrants, high/low/none and all tied best totals | Map entrants to existing participant names/IDs in form order. For a complete competitive sheet, write each total and mark every tied best participant `is_winner=true`. Do not copy BoardScoreHub's first-winner-only play-log behaviour. Solo/non-points outcomes remain explicit user choices. |
| Incomplete scores | Prototype exposes partial totals but suppresses totals and winners | Keep the sheet editable, but do not auto-save partial totals as final. Offer **Continue with manual play log** to preserve today's nullable score/manual-winner route. |
| Persistence | Existing `plays` and `play_participants` store game, date, duration/location, participant name/ID, nullable final score and winner flag | SP-SCORE-03 stores only calculated final totals/winners through the existing `POST /plays` contract. Detailed cells remain form state. No schema or historical-record change. A future audited milestone may add versioned detail persistence. |
| BGG integration | Games already have stable positive `bgg_id`; Log a Play receives the selected game | Look up the template locally by exact BGG ID when the form opens. Show a scoresheet choice only on an exact supported match. Unsupported games and any lookup failure retain the unchanged manual form. |
| Existing play history | Reads already understand nullable scores and multiple winner flags | New records remain backward-compatible. Do not recompute old records when templates change; saved totals/winners remain historical facts. |
| Offline behaviour | SP-SCORE-01 calculation is pure/local; ShelfPick play saving is server-backed | Calculation and form edits can work without new network calls. Do not claim offline save. Keep a bounded session/local draft only if existing privacy/storage policy permits; server submission and recovery remain unchanged. |
| Integrity | API accepts caller-supplied totals/winners and validates names, score types and game ownership | Recalculate from validated template data immediately before submission; bind result to BGG/template/version; reject inactive/unknown fields, non-finite/out-of-range values and duplicate entrants. Server-side recalculation is a future hardening option if detailed cells are ever submitted. |
| Entitlements | Manual Log a Play is existing functionality | Scoresheets inherit the existing journey. SP-SCORE-03 must add no Free/Pro gate and must not change timer or other entitlements. |

## Log a Play journey

1. Open the existing Log a Play form with the selected game's BGG ID and any prefilled players.
2. If an exact approved template exists, show a compact **Use scoresheet** option below player setup; otherwise render today's form unchanged.
3. The scoresheet reuses the same participants, renders plain ShelfPick fields, updates per-player totals locally, and labels incomplete totals as incomplete—not zero.
4. On completion, show totals and every tied winner for confirmation. Users can return to edit cells or choose the manual form.
5. Submit through the existing play endpoint with calculated scores/winners plus the existing date, duration, location, timer and picker-session fields.
6. If calculation or template lookup fails, keep entered play metadata, show a recoverable error and allow manual logging. Never silently substitute a different game/template.

Unsupported games, imported history and old play records never depend on the template catalogue.

## Ranked candidates

Scoring is 1 (best) to 5 (worst). “Confidence” assesses how directly the inspected implementation expresses the familiar final score; it is not owner rule approval.

### Exactly three recommended first templates

| Rank | Game / BGG | Effort | Usefulness | Rule confidence | Engine reuse | Licence/maintenance | Why first |
|---:|---|---:|---:|---:|---:|---:|---|
| 1 | Wingspan / 266192 | 1 | 1 | 1 | 1 | 2 | Six plain additive categories, common score-sheet use, exact BGG identity, and existing expansion-field support for Oceania nectar. |
| 2 | Terraforming Mars / 167791 | 1 | 1 | 1 | 1 | 2 | Six familiar additive categories; high utility and no new calculation primitive. Expansion scoring is already rolled into the same categories. |
| 3 | Harmonies / 414317 | 1 | 2 | 2 | 1 | 2 | Six additive categories, 1–4 players, no variants or special UI. It provides a clean third template for validating the generic catalogue path. |

Before implementation, independently compare every label, player range, expansion behaviour and total against current official rules or an owner-supplied physical sheet. Use no upstream art or prose.

### Future shortlist (up to 10)

1. **Karuba (183251)** — three direct categories; very small template.
2. **Targi (118048)** — five direct categories; fixed two-player scope.
3. **Parks (266524)** — simple categories; needs a declarative exclusive fixed-value award for ideal UX.
4. **Everdell (199792)** — additive and engine-compatible; useful test of multiple optional expansions.
5. **Planet Unknown (258779)** — additive with one optional expansion row.
6. **Calico (283155)** — validates a multiplier/penalty field; verify the unusual top-goal transform carefully.
7. **Scout (291453)** — validates player-count-dependent round counts.
8. **Moving Wild (423270)** — validates negative round entries without custom formula code.
9. **Verdant (334065)** — additive with optional advanced goals; half-verdancy remains a user-entered subtotal unless separately approved.
10. **Flip7 (420087)** — useful round tracker, but defer until threshold-ending/dynamic-round UX is specified and rules verified.

Azul is a reasonable separate product candidate but is absent from BoardScoreHub's registry, so it is not ranked from this audit.

## Proposed SP-SCORE-03 scope

Implement only Wingspan, Terraforming Mars and Harmonies as independently authored templates in the isolated scoring architecture, then integrate an optional scoresheet into the existing Log a Play form.

### Acceptance criteria

- An exact BGG-ID lookup selects only `266192`, `167791` or `414317`; unsupported games follow the unchanged manual journey.
- Templates are immutable/versioned, data-only, independently worded, and contain no BoardScoreHub code, prose, assets, branding or remote resources.
- Official/owner-supplied rules are cited in an internal provenance record; player ranges and every category are human-reviewed before acceptance.
- Per-player totals recalculate deterministically after every edit; blank required cells keep the sheet incomplete and do not become zero.
- Complete equal best totals mark every tied participant as a winner; no winner is inferred for incomplete data.
- Scores and winners submit through the existing play API with existing metadata; no migration, play-record rewrite, entitlement change or new dependency occurs.
- Manual entry remains available before and after any template/calculation error, retaining entered play metadata and participants.
- Targeted engine tests cover valid totals, negative/decimal input policy, blanks, ties, template/BGG/version mismatch, inactive fields, bounds and non-mutation.
- Frontend tests cover exact selection, unsupported fallback, participant mapping, edits, tie confirmation, single submission, API-error recovery, keyboard/focus order and mobile overflow.
- Existing play logging, BG Stats URL generation/import, history display, timer integration and nullable/manual scores remain green.

## Explicitly deferred

Detailed-cell persistence, database/API schema changes, template downloads, user-authored templates, BoardScoreHub code/assets, repeated multi-category rounds, non-points victory modelling, offline submission, Free/Pro changes, and every game outside the initial three.
