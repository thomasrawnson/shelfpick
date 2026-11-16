# SP-SCORE-03 — Native scoresheets

Date: 1 November 2026  
Status: local implementation; owner/device review pending

## Scope and architecture

ShelfPick provides native scoresheets only for exact BGG IDs `266192`
(Wingspan), `167791` (Terraforming Mars) and `414317` (Harmonies).
Unsupported games retain the existing manual Log a Play form.

The browser catalogue in `frontend/src/scoresheets.ts` is declarative and
versioned. It follows SP-SCORE-01's pure calculation boundary while avoiding a
Python runtime in the client. Templates contain fields, optional expansion
fields and ordered tie-breakers; they contain no executable formulas. The
calculator accepts only non-negative safe integers, distinguishes blank from
zero, calculates totals without mutating input, and suppresses winners until
all scoring fields and any tie-breakers needed for the actual tie are valid.

Detailed cells remain transient form state. Immediately before the existing
single `POST /plays` call, ShelfPick maps calculated totals and all winning
participants to the existing nullable `score` and `is_winner` fields. There is
no schema, migration, API, import, history, entitlement or offline-save change.
The existing in-flight save guard remains the duplicate-submit boundary.

## Independently verified rules

No BoardScoreHub code, copy, artwork or remote resource is used. Its audited
MIT commit `483758f2f00b5a0ace2a91555878b65598950d55` informed only the earlier
catalogue audit.

| Game | Included scoring | Result rule | Source |
|---|---|---|---|
| Wingspan | Birds, bonus cards, end-of-round goals, eggs, cached food and tucked cards; optional Oceania Nectar subtotal | Highest total; tied total is broken by most unused food; if still tied, victory is shared | [Stonemaier-authorised Rules Reference](https://wingspan.rulepop.com/) |
| Terraforming Mars | Terraform rating, milestones, awards, greenery, cities and cards | Highest total; tied total is broken by most M€, then most unplayed cards; a remaining tie is shared | [Publisher-supported Dized final scoring](https://rules.dized.com/game/Y2e4M8-fRH-fyWwjwVHsbw/eJTbLmXoQKKOMOyaovuWKw/final-scoring) and [Dized FAQ](https://rules.dized.com/game/Y2e4M8-fRH-fyWwjwVHsbw/faq) |
| Harmonies | Trees, mountains, fields, buildings, water and Animal cards | Highest total; tied total is broken by most Animal cubes placed; if still tied, victory is shared | [Libellud English rules](https://cdn.svc.asmodee.net/production-asmodeeca/uploads/2024/05/LIBELLUD_HARMONIES_RULES_EN.pdf) |

The Wingspan Oceania option records the player's already-calculated Nectar
subtotal. No other expansion or game-specific asset is included. Terraforming
Mars expansions and Harmonies Nature's Spirit are deliberately unsupported.

## Behaviour and limits

- Scoresheet mode reuses players and play metadata. Returning to manual mode
  does not save or overwrite the manual score/winner draft.
- A one-player sheet saves its total but does not invent a competitive winner.
- A remaining rules-level tie marks every tied participant as a winner, which
  existing play history and BG Stats export already support.
- Scoresheet detail is not recoverable after navigation or persisted to play
  history. Only the compatible final totals and winners are saved.
- Physical iPhone, VoiceOver and owner rules/UI acceptance remain human gates.
