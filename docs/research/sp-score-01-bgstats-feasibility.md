# SP-SCORE-01 — scoresheet feasibility (22 October 2026)

## Decision

**CONDITIONAL GO after beta.** ShelfPick can build comparable score entry and calculation with its own schema and engine. The prototype proves arithmetic, rounds, categories, a conditional bonus, optional expansion field, team totals and ties. It does not prove a production UI, game-rule coverage, template rights, real-device usability or detailed BG Stats interchange. The first valuable release is a generic sheet plus editable rounds, with explicit save review and no game-specific library claim. A small curated category pilot should follow only after beta and rights review.

## BG Stats: verified behaviour and limits

The [official Score Sheets guide](https://www.bgstatsapp.com/score-sheets/) documents automatic totals and winner selection, game-specific categories, generic and rounds sheets, highest-score and other winner modes, multi-round options, subtotals, variants, expansion-dependent rows, language switching, player-count-dependent rows, saved sheet viewing/sharing and per-line statistics. It says 3,100+ game-specific sheets are available at the time of review. It also describes arithmetic entered into score fields, including multiplication, division and parentheses. This is **user-entered field arithmetic**, not evidence that template authors can define arbitrary formulas or conditional expressions. The guide documents manual winner adjustment for tie-breaks and manually entered subtotals when a group has no line values. [Version history](https://www.bgstatsapp.com/board-game-stats/version-history/) documents offline template caching, later template updates, and score-sheet-template loading. A [BG Stats news post](https://www.bgstatsapp.com/category/news/) identifies score-sheet templates as a cloud service. Together these support a likely remote-distribution/cache model, but do not establish where authoritative definitions are authored or stored, their format, or an API/licence to obtain them. We did not inspect the application or service internals.

The guide says a shared **Play File** includes the saved score sheet. It does not establish that a full-account JSON export includes reusable template definitions, nor the shape or stability of any sheet payload. ShelfPick's local synthetic BG Stats fixtures cover collection metadata and a play with `playerScores` (`score`, `winner`), but no score-sheet details. No user-owned real export was found in the repository search; no private play data was collected. For later compatibility work, obtain an opt-in redacted export with one generic, one rounds and one game-specific saved sheet; compare documented field names, IDs, versions and round/category values locally. Treat imported totals/winners as authoritative unless a verified mapping exists. Do not claim round-trip scoresheet compatibility yet.

## Template sourcing and rights

| Source | Availability and use | Maintenance/rights decision |
| --- | --- | --- |
| Publisher rulebooks or scoring references | Often public and best source for **verifying rules** | Public access does not grant permission to redistribute wording, artwork or a scorecard. Write original concise labels and calculations; seek publisher permission for expressive assets or close copies. |
| Explicitly licensed community templates | Possible but fragmented | Check the licence on each **definition and included content**, contributor authority, attribution/share-alike obligations and version. No bulk import assumed. |
| Open-source scoring projects | [BoardScoreHub](https://github.com/cophilot/board-score-hub) advertises an MIT-licensed React scoring app; [Naibi](https://github.com/han-tyumi/naibi) separates MIT tooling from CC BY-SA rule write-ups | Useful architecture references; repository licence or code licence alone does not prove rights to every game-specific name, scorecard, image or contributed template. Audit per file before reuse. This prototype copies none. |
| User-authored definitions | ShelfPick can provide an editor later | Require contributor declaration, provenance, moderation and takedown process before public sharing. Private user definitions need validation but not a public library workflow. |
| BG Stats templates/exports | No reusable licence identified | Do not copy, scrape or bulk import. A user export is evidence of the user's play data, not a grant to republish the template library. |

The [US Copyright Office's game guidance](https://www.copyright.gov/register/tx-games.html) distinguishes game methods from protected literary/artistic expression. That supports independently implementing scoring methods but is not a blanket rights clearance, especially across jurisdictions and for whole datasets. Obtain legal review before distributing a large game-specific library.

**Sustainable library:** keep generic/rounds as universal templates; author a demand-led set of original, minimal definitions from publisher-verified rules; record source URL, rule edition, contributor, rights basis, review date, BGG ID, expansion/variant scope, expected examples and template version. Require a second scoring check and automated golden examples. Keep obsolete versions for saved sessions, and use correction reports instead of silently changing old results.

## Scale, differentiation and cost estimates

Planning assumptions, not measured rates: 2–4 hours to research, author, check and review a straightforward template; 0.5–1.5 hours per template-year for rule/expansion corrections, reports and regression upkeep. Complex games may be much higher.

| Library | Initial effort | Recurring effort/year | Practical implication |
| --- | ---: | ---: | --- |
| 100 | 200–400 hours | 50–150 hours | Curated pilot needs an editorial owner. |
| 500 | 1,000–2,000 hours | 250–750 hours | Community intake and review tooling become necessary. |
| 1,000 | 2,000–4,000 hours | 500–1,500 hours | Dedicated maintenance capacity and rights process. |

ShelfPick could differentiate through one-tap use of existing named players and BGG-linked owned games, honest incomplete-score handling, editable rounds, transparent calculation breakdown, offline draft entry, accessible phone-first input, and private custom sheets. These are opportunities, not delivered features.

Estimated engineering for a **post-beta generic/rounds MVP**: 3–5 developer-weeks including UI, persistence, migration, API validation, accessibility, import regression and real-device QA; a 10–20-game category pilot adds roughly 3–6 weeks plus editorial time. The pure calculation itself needs no paid service. Bundled static templates add modest build/download size; saved detailed sheets increase ordinary database and backup usage in proportion to plays × fields. Measure actual traffic and storage before quoting hosting cost. No new paid infrastructure is required by this prototype; production hosting cost is unquantified until usage and retention are specified.

## Repository and milestone boundary

Local `main` was one commit ahead and 12 behind `origin/main`, with substantial unrelated edits/untracked files. `ROADMAP.md` keeps beta on hold and pre-beta slices separate. Local recent commits include play-entry and add-game work; remote open PRs could not be checked because authenticated GitHub access was rejected by automatic approval review under the project's external-contact restriction. The rejected action was a read-only `gh pr list`; no alternate route was used.

ShelfPick has user-scoped `players`, `plays`, `play_participants` with nullable `score` and `is_winner`, and games keyed by BGG ID. The BG Stats importer maps export game/player references, play UUID/date/duration and participant score/winner, with source-ID deduplication. It does not ingest detailed sheets. The isolated engine does not change these paths or any approved pre-beta milestone.

**Next milestone only after beta:** SP-SCORE-02, design and test a generic/rounds UI with a saved-draft format and explicit mapping to existing play totals/winners; estimate 3–5 developer-weeks. Require owner prioritisation and a clean integration branch before production work.
