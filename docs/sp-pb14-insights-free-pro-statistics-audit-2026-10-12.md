# SP-PB14 — Insights and Free/Pro statistics audit

**Date:** 12 October 2026  
**Status:** Audit and SP-PB14A implementation complete  
**Scope:** Product/architecture audit followed by the bounded SP-PB14A accuracy
implementation. No new statistic, entitlement, migration or dependency was
introduced.

## Executive decision

ShelfPick already has a useful Free Insights product. It does not need a broad
statistics dashboard before launch. SP-PB14A corrected the meaning of existing
play-history totals before any new statistic was considered.

Keep every currently visible Insight and monthly recap Free. Do not market or
enforce `advanced_stats` yet. Advanced statistics could become a worthwhile Pro
bundle after launch only if users demonstrate demand for date-range comparisons
and trends; basic totals, personal history, collection usage and sharing should
not be moved behind a paywall.

The old proposal to add total plays and a board-game H-index is superseded by
this audit. Total plays already exists. H-index is difficult to explain, weakly
connected to ShelfPick's core job of choosing and remembering games, and is not
a launch priority.

## Current implementation

All surfaces below are authenticated and account scoped. None checks the
`advanced_stats` entitlement, so the currently shipped Insights experience is
Free. The Pro comparison does not advertise statistics and instead truthfully
markets personalised recommendations, live play timing and hosted phone voting.

| Visible statistic or feature | Source and calculation | Accuracy, usefulness and limitations |
| --- | --- | --- |
| Games owned | `/insights`; count of the user's current `UserGame` rows, excluding expansions | Accurate current shelf total. Useful. |
| Shelf explored | Distinct currently owned, non-expansion games with at least one account play, divided by current owned total and rounded | Accurate as collection coverage, not lifetime unique games. The adjacent **Games played** label needs this scope made explicit. |
| Still waiting | Current owned non-expansions with no account play | Accurate and useful for collection use. |
| Shelf leaders | `/rankings`; most common publisher, designer, mechanic and category metadata among the user's ranking set | Implemented and useful as collection/ranking metadata, but metadata can be incomplete after imports. It is not a play statistic. |
| Waiting on the shelf | Up to five current owned non-expansions, unplayed first, then oldest last play and lowest play count | Useful and account scoped. The UI omits the available last-played date, but that is optional polish rather than a defect. |
| Plays | Count of all recorded account plays | Accurate and useful. Total plays is already implemented, so it must not be rebuilt. Imported plays count under existing import/deduplication rules. |
| Hours played | Sum of non-null recorded durations across all account plays | Partial totals are arithmetically accurate, but coverage is hidden. If no play has a duration, SQL `NULL` is converted to `0`, so the UI misleadingly displays `0.0` hours. |
| Games played on the Play tab | Reuses collection coverage: distinct played games that remain currently Owned and are not expansions | Misleading as an all-history headline. Plays for removed or non-owned games are omitted even though the total play count includes them. |
| Average play | Average of recorded non-null durations, rounded to minutes; em dash when none exist | Truthful about wholly missing duration, but does not disclose how many plays were timed. |
| Most played / Last played | All account plays joined through the current `UserGame` shelf | Misleading as all-history cards because games no longer Owned are silently excluded. Equal most-played counts use name ordering; last-played ties have no final deterministic key. |
| Frequent players | Participant appearances and `is_winner=true` rows, top five returned and top three shown | Play count is useful. “Wins” inherits incomplete outcome semantics and should be qualified. |
| Players' favourites | Each player's highest play-count game | This is observed most-played history, not a stated favourite. Equal counts have no deterministic per-player tie-breaker. Rename it. |
| Regular groups | Exact sets of two or more linked players, counted across account plays | Useful, deterministic after aggregation, and private to the account. The repository loads every play and participant relationship into application memory, creating a future scale risk. |
| Player profile | Participant play count, distinct games, winner-flag count/rate, five most-played games, ten recent games and five common partners | Account isolation is tested. Most-played/recent/partners are useful. `is_winner` is a required boolean defaulting to false, so “Win rate” treats unrecorded outcomes as losses and can be misleading, especially for cooperative or incomplete imports. |
| Monthly recap (SP-PB13) | `/insights/monthly-recap`; selected local month converted to half-open UTC bounds; play count, unique games, nullable duration with coverage, deterministic most-played and up to four covers | Accurate, useful and Free. Empty months cannot be shared; private player, score and location data is excluded. Artwork permissions and physical-device share sheets remain release checks. |

Primary references: `frontend/src/components/InsightsView.tsx`,
`frontend/src/components/players/PlayerProfile.tsx`,
`frontend/src/components/rankings/RankingCategorySummary.tsx`,
`frontend/src/components/insights/MonthlyRecapPanel.tsx`,
`backend/repositories/insights_repository.py`,
`backend/repositories/play_read_repository.py`,
`backend/services/insights_service.py`, `backend/api/routers/insights.py`,
`backend/services/entitlements.py` and
`frontend/src/components/ProComparisonView.tsx`.

### Implemented backend capability not currently presented

The main `/insights` payload still calculates `monthly_activity`: current UTC
month plays, unique games, first-time games, repeat plays and up to 20 recent
plays. The current tabbed UI does not use it; SP-PB13 uses its separate,
timezone-correct monthly endpoint instead. This is unused capability, not a
missing feature. Do not build a second recap UI around it. Deprecating and later
removing the unused payload can reduce query work after compatibility is
checked.

The **Your year in review** card is future-facing copy, not an implemented
yearly recap. No yearly endpoint or export exists.

## Confirmed defects and accuracy risks

### Must fix before beta — completed by SP-PB14A

1. **Missing duration is presented as zero.** When plays exist but none has a
   recorded duration, the all-time total says `0.0 Hours played`. Preserve
   missing as `null`, display **Not recorded**, and show recorded-duration
   coverage whenever only some plays are timed.
2. **Play-history scope is inconsistent.** Total plays and duration cover all
   saved plays, while Games played, Most played and Last played exclude games
   not on the current Owned shelf. Keep collection coverage shelf-scoped, but
   make Play-tab history account-history scoped and label each number clearly.
3. **Player preference and outcome labels overclaim.** Rename **Players'
   favourites** to **Most played by player**. Replace unqualified **Win rate**
   with wording that explains it is derived from saved winner flags; do not
   imply that missing winner data is a loss. If truthful denominator semantics
   cannot be delivered without a data-model change, omit the percentage and
   retain recorded wins.

### Worth correcting before launch

- Add deterministic tie-breakers to per-player top game and last-played queries.
- Add repository-level PostgreSQL coverage for the main Insights query semantics,
  including account isolation, removed/non-owned historical games, expansion
  exclusion from collection coverage, missing/partial duration and equal-count
  ties. Current service tests mostly use a fake repository; SP-PB13 has stronger
  focused PostgreSQL coverage than the older headline endpoint.
- Bound or aggregate regular-group computation in SQL before large histories can
  cause an avoidable full-history load. This is a scale hardening task, not a
  confirmed beta failure.
- Stop calculating the unused `monthly_activity` payload after an API
  compatibility review. Do not remove it silently.

## Potential improvements

| Candidate | User/commercial value | Data, complexity and risk | Recommendation |
| --- | --- | --- | --- |
| Total games played | High basic-history value; no special Pro value | Data exists. Separate lifetime unique games from owned shelf coverage. Small. | Fix and keep Free before beta. |
| Total recorded play time | High basic-history value | Data exists, but missing/partial coverage must stay visible. Small. | Fix and keep Free before beta. |
| Most-played games | High; already one headline and player lists | A top list or date filter is straightforward, but all-history scope and ties must be fixed first. Small–Medium. | Keep the headline Free; richer lists can wait. |
| Monthly trends | Moderate value; plausible retention benefit | Monthly aggregation exists for recaps. Comparisons need timezone, empty-period and partial-duration rules. Medium. | Post-launch research; possible Pro trend layer, never gate the recap. |
| Yearly trends/recap | Moderate sharing and retention value | Requires a new bounded aggregation/presentation slice. Medium. | Post-launch; a shareable annual recap is better acquisition value as Free. |
| Player statistics | Useful for regular groups | Existing data covers appearances, games and partners. Outcome data cannot distinguish missing from a loss. Privacy requires account-only display and private-by-default exports. Medium. | Preserve current Free basics; defer comparisons until outcome semantics improve. |
| Cooperative vs competitive history | Potentially interesting, low launch value | BGG game mechanics do not prove how an individual play was run. Current play records have no authoritative mode. High accuracy risk. | Not recommended with the current model. |
| Win rates | Familiar but easy to mislead | Required boolean winner flags collapse missing and loss; cooperative/shared wins complicate interpretation. | Correct/qualify current UI; do not build a leaderboard or Pro feature. |
| Collection usage | High core-product fit | Shelf explored, still waiting and neglected games already exist. Small refinements only. | Keep Free; no new dashboard required. |
| Games not played recently | High actionability and already implemented | Current five-item result is bounded; UI could show last-played date. Small. | Optional post-beta polish, Free. |
| Personal ranking insights | Moderate fit with choosing games | Category summaries exist. Deeper change-over-time or affinity explanations need careful definitions. Medium. | Preserve Free summary; research richer insights post-launch. |
| Board-game H-index | Low and niche | Derivable from play counts, but unfamiliar, sensitive to imports and requires explanation. Small technically, weak commercially. | Not recommended for beta or launch. |

## Free and Pro recommendation

| Capability | Free at launch | Pro at launch | Later option |
| --- | --- | --- | --- |
| Collection totals, shelf coverage, waiting/neglected games | Yes | Included | — |
| Total plays, lifetime unique games, recorded-time total/coverage, average duration | Yes | Included | — |
| Most/last played headlines | Yes | Included | — |
| Player appearances, recorded wins, most-played games, groups and partners | Yes | Included | — |
| Personal-ranking category summaries | Yes | Included | — |
| Monthly recap, month selection and sharing | Yes | Included | — |
| Advanced personalised recommendations | No | Yes | Existing Pro benefit |
| Live play timer | No | Yes | Existing Pro benefit |
| Host-created Game Night phone voting | No | Yes | Existing Pro benefit |
| Custom date ranges, period comparisons and longitudinal trend charts | Not implemented | Do not promise at launch | Possible Pro bundle after validation |

Advanced statistics are not presently strong enough to become a fourth launch
Pro promise. The entitlement name may remain internal for compatibility, but it
should stay unenforced and unmarketed until a coherent, tested feature exists.
If post-launch research supports it, sell convenience and longitudinal analysis
rather than withholding users' own basic history.

## Bounded follow-up tasks

### SP-PB14A — Insights truthfulness and history scope

**Status:** Complete (12 October 2026)  
**Complexity:** Medium  
**Dependencies:** Existing play and Insights repositories only; no migration or
new dependency.

Scope:

- Preserve collection coverage as current-owned, non-expansion coverage.
- Add a clearly named all-history unique-games value for the Play tab.
- Make all-time most-played and last-played operate on account play history,
  independent of current shelf membership.
- Preserve missing all-time duration as missing and return duration coverage.
- Rename **Players' favourites** and correct/qualify the win-rate presentation.
- Add stable tie-breaking and retry for the main Insights load error.

Acceptance criteria:

1. With plays but no durations, the UI never displays zero recorded time.
2. With partial durations, the total and `timed plays / total plays` coverage
   agree with persisted records; no missing duration is invented.
3. Removing a played game from Owned changes collection coverage but not total
   plays, lifetime unique games, most played or last played.
4. Expansions remain excluded only from collection-coverage statistics under
   existing rules; recorded history remains truthful.
5. Equal-count and equal-date results are deterministic.
6. Winner-derived text states its saved-data basis; missing outcomes are not
   presented as losses.
7. Free users retain every existing Insight and recap; Pro enforcement and
   comparison copy are unchanged.
8. PostgreSQL tests prove account isolation and the cases above; frontend tests
   cover labels, missing/partial data, retry and responsive accessibility.
9. Relevant suites, lint, build, PWA checks and 390x844/1440x900 light/dark
   Playwright validation pass, or unavailable checks are reported exactly.

Likely files: `backend/models/collection_insights.py`,
`backend/repositories/insights_repository.py`,
`backend/services/insights_service.py`, focused backend tests,
`frontend/src/api/client.ts`, `frontend/src/components/InsightsView.tsx`,
`frontend/src/components/players/PlayerProfile.tsx` and focused frontend tests.

### SP-PB14B — Insights query and contract hardening

**Status:** Complete (12 October 2026)  
**Complexity:** Medium  
**Dependencies:** SP-PB14A semantics agreed; API compatibility review.

Scope and acceptance criteria:

- Replace full-history in-memory regular-group aggregation with bounded,
  account-scoped database work whose results match current exact-group rules.
- Retain the currently unused `monthly_activity` field until a separately
  versioned API-contract removal is approved; do not silently remove it here.
- Add query-count or representative-history regression evidence and preserve
  deterministic ordering, account isolation and all existing Free output.

### SP-PB14C — Trend-value discovery

**Priority:** Post-launch  
**Complexity:** Small discovery; Large if implemented  
**Dependencies:** Real usage/feedback and an explicit entitlement decision.

Interview or test whether month/year comparisons and custom ranges materially
improve retention or willingness to pay. Only then define a separate Pro slice
with exact timezone, missing-data, privacy, low-sample and export rules. Do not
gate existing totals or recaps and do not use H-index as the headline value.

## Validation and remaining blockers

### SP-PB14A implementation closeout — 12 October 2026

The bounded accuracy slice is complete. The `/insights` response adds
`historical_played_games_count` and `duration_plays`, while preserving the
existing `played_games_count` as current-shelf coverage. Total duration is now
nullable. Most/last played query account history directly and use stable
tie-breaking; no current `UserGame` row is required. The frontend distinguishes
**Owned games played** from **Games in history**, presents missing/partial/zero
recorded time honestly, and provides main-load retry.

Player profiles return wins, losses, draws, unknown results, decided plays and
a nullable win rate. The denominator is exactly `wins + losses + draws`:

- no saved winner flag on the play: unknown, excluded;
- player not marked winner when another participant is: loss, included;
- one saved winner: win for that participant, loss for the others;
- multiple saved winners with equal non-null scores: draw for those tied
  participants, loss for other participants;
- multiple winners without an equal scored tie: shared wins;
- every participant marked winner in a game classified **Cooperative Game**:
  cooperative wins, even if scores are equal.

This reinterprets no saved record and makes no assumption when historical flags
are incomplete. Recent player history exposes the same outcome labels, the
group summary calls raw flags **marked winner**, and frequency is labelled
**Most played together** rather than favourite.

Validation completed against the existing local PostgreSQL development
container: focused backend 30/30; full backend 289 passed with five conditional
timer-isolation skips; frontend 84/84; Alembic check, ESLint, production build,
PWA checks and `git diff --check` passed. Mock-backed Playwright passed
390x844/1440x900 in light/dark, including duration variants, historical scope,
outcome categories, empty/error recovery, keyboard focus, navigation clearance,
overflow and SP-PB13 recap regression. Evidence is in
`docs/screenshots/sp-pb14a/`. Browser validation used synthetic account data; it
is not production or physical-device evidence.

The original audit was read-only. The closeout above records the later SP-PB14A
implementation and fresh validation separately. Existing SP-PB13 evidence
remains applicable to its unchanged recap calculation.

SP-PB14A's accuracy corrections are no longer a beta blocker.
Separate existing release blockers remain: SP-PB02's authorised ranked Top 100
source, physical-device timer/phone-voting/share validation, commercial checkout
and product-wide artwork redistribution permission. Barcode mapping remains out
of the launch path. This audit does not change any of those statuses.

### SP-PB14B query-hardening closeout — 12 October 2026

The old `get_common_groups()` path loaded every account play as an ORM object,
select-in loaded every participant, lazy-loaded linked players, built exact
player-ID tuples in Python, ranked every distinct group in memory and only then
returned five rows. Query count therefore grew with the number of distinct
linked players, while object allocation grew with the complete play history.

The replacement performs the same work in PostgreSQL. It first selects distinct
linked `(play, player)` membership within the authenticated account, constructs
each play's player-ID and display-name arrays in stable player-ID order, excludes
groups with fewer than two linked players, counts identical arrays, and orders
by play count descending then names and IDs ascending before applying the limit.
It does not join `UserGame`, so removed-Owned historical games still count. Both
the play and linked player are checked against the account. Unlinked legacy
participants retain the previous behaviour and do not form a regular group.

On the existing local PostgreSQL development container, the same disposable
fixture of 10,000 plays, 30 linked players and 100 repeating group patterns was
run three times per implementation. Median wall time, SQL statement count and
peak Python memory measured by `tracemalloc` were:

| Implementation | Median | Statements | Peak traced Python memory |
| --- | ---: | ---: | ---: |
| Original ORM/Python aggregation | 1,280.71 ms | 51 | 64.64 MiB |
| PostgreSQL aggregation | 21.78 ms | 1 | 0.07 MiB |

The top-five IDs, names, counts and order matched exactly. Existing indexes on
`plays.user_id`, `(plays.user_id, plays.played_at)`,
`play_participants.play_id`, `play_participants.player_id` and
`players.user_id` were retained; this representative result did not justify a
new index or migration.

Focused PostgreSQL regression coverage includes empty and small/legacy history,
an 800-play representative owner history, repeated and similar-but-distinct
groups, removal from Owned, a second account, deterministic equal-count ordering
and a one-statement assertion. Existing API tests preserve the complete
`/insights` response contract, Free access, SP-PB14A outcomes and SP-PB13 recap
behaviour. The unused `monthly_activity` payload remains a known extra query and
contract cost; removing it requires an explicit compatibility/deprecation slice.

Final validation passed: 29 focused backend/API/PostgreSQL tests; the full
backend suite at 291 passed with five conditional timer-isolation skips; the
unchanged frontend contract suite at 84 passed; Alembic schema check, ESLint,
configured production build, PWA checks and `git diff --check`. No browser
matrix was repeated because SP-PB14B changes only repository execution and
preserves the serialized API response and frontend code.
