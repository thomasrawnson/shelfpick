# Free and Pro capability audit

Verified through 28 September 2026 from frontend and backend code, isolated fixtures,
and focused automated tests. No live account, purchase, database mutation or
live BoardGameGeek request was used.

The agreed launch offer remains a **£3.99 one-off purchase**, not a
subscription. No price is technically configured, checkout is not implemented,
and purchasing remains disabled.

## SP-PB01 access confirmation — 28 September 2026

The dedicated Picker play-entry screen preserves existing Free access. It
changes routing and presentation only: the existing play API, validation,
participant persistence and Picker conversion link remain in use. No Pro
entitlement, purchase claim or billing behavior changed. Beta remains on hold.

## Verified capability matrix

| Feature | Implemented behaviour | Current access | Frontend and backend enforcement | Limitations or planned-only functionality |
| --- | --- | --- | --- | --- |
| Picker | Ranks owned, non-expansion games by player count, time, complexity, age, play style, category/mechanic preferences and play history. Best match, Different and Surprise are implemented; selected players add exact-group history. Optional mood reranking has a deterministic fallback. | Free and Pro | Frontend exposes the flow without a tier check. Backend endpoints are authenticated and dependencies scope games, plays and analytics to the current user; there is no Pro capability check. | `advanced_recommendations` is an entitlement name only. Mood AI depends on server configuration and is not a Pro boundary. |
| Discover Hot | Returns unowned games in BoardGameGeek Hot order with source explanations and Want to Play state. | Free and Pro | Frontend tab is always available. Backend is authenticated/user-scoped and requests only the Hot source; no Pro check. | Requires candidate metadata from BoardGameGeek. A 24-hour in-memory candidate cache can serve stale IDs after a source failure, but does not survive a process restart. |
| Discover Top 100 | Returns unowned games whose original ranked-source position is 1–100, without backfilling from lower ranks. | Free and Pro | Frontend tab is always available. Backend is authenticated/user-scoped and limits the ranked source to positions 1–100; no Pro check. | Ranked-page failure with no in-process stale cache makes this ranked-only mode unavailable. |
| Discover For You | Scores unowned Hot and ranked candidates using shelf categories/mechanics, per-owned-game play counts, preferred or observed player count, preferred or median play time, rating and BGG player-count evidence. Explanations are derived from the matching signals. | Pro only | Frontend checks `personalized_discover` before requesting results and shows a locked state otherwise. Backend independently returns 403 for Free before calling the service. | Empty/no-signal accounts fall back to popular source candidates rather than personalised evidence. Only the first 30 merged candidates receive metadata/scoring. Source caches are in-process and metadata remains a live dependency. |
| Owned collection | Sync, search/add, browse, detail and ownership-aware Picker input. | Free and Pro | No frontend tier gate. Backend dependencies authenticate and scope ownership by current user. | BGG sync/search/add still depend on upstream availability; no Pro behaviour exists. |
| Want to Play | Separate user-scoped list, add/remove/detail, and atomic move to Owned. | Free and Pro | No frontend tier gate. Backend service is authenticated and user-scoped. | Discovery metadata/add operations can depend on BGG; no Pro behaviour exists. |
| Play logging | Records and deletes user-scoped plays with participants, manual duration and optional location; feeds history, Picker and Game Night signals. | Free and Pro | No tier gate for ordinary play logging or location. Backend play service and repositories are authenticated/user-scoped. | Existing plays cannot currently be edited; location is editable during creation/retry and displayed in recent history. |
| Live play duration | One recoverable timer per account with Start, Pause, Resume, Finish, an app-wide indicator and explicit play review before save. | Pro only | Frontend exposes controls only with `live_play_enhancements`; every timer endpoint independently enforces the same capability. Persisted user ownership and a unique account timer isolate sessions. | In-app PWA only. No lock-screen/Live Activity, ongoing notification, notification permission request or guaranteed background execution. |
| Insights | Collection, play, monthly, game and group facts, including valid facts from one recorded play. | Free and Pro | Frontend route is always available. Backend service is authenticated/user-scoped; no Pro capability check. | `advanced_stats` is an entitlement name only; there is no separately implemented advanced Insights surface. |
| Game Night | Builds a 3–5 game shortlist from the host’s owned collection using attendees, time, exact-player suitability, general play history and exact-group history. | Basic Game Night is Free and Pro | Frontend checks `game_night_basic`. Backend independently checks the same capability and validates player IDs against the current user. | `game_night_enhanced` is an entitlement name only; no enhanced mode is implemented. |

## For You evidence

### Inputs and explanations

- Owned-game categories and mechanics are weighted at least once, then more
  heavily by recorded play count for that owned game.
- Preferred player count overrides the most common recorded count; preferred
  play time overrides the median positive recorded duration.
- Candidate rating contributes a base score. BGG Best/Recommended counts,
  session duration fit and Hot/ranked source membership add score and matching
  explanations.
- Want to Play membership is returned for UI state but does not change ranking.
- Explanations inspected in tests correspond to actual scoring inputs. No
  explanation claims ranked status when the ranked source is absent.

### Sparse data and source behaviour

- A single recorded play can produce collection, usual-session and usual-player
  explanations; one play is not discarded as insufficient history.
- With an empty shelf and no profile/history signals, For You can still return
  popular Hot/ranked candidates with source-only explanations. This is useful
  fallback behaviour, but it is not materially personalised.
- Fresh, warm-cache and stale-cache source paths are covered by deterministic
  tests. A failed source is omitted when another source succeeds. If every
  requested source fails without stale data, the API returns an error rather
  than a misleading empty success.
- The unresolved ranked-page 403 does **not** by itself prevent useful For You
  results: Hot candidates continue through scoring. It does prevent ranked-only
  Top 100 on a cold cache and reduces For You’s candidate breadth. This is a
  code-and-mocked-test conclusion, not evidence of current live source status.

## Pro readiness findings and follow-ups

1. **Checkout blocker:** configure the agreed £3.99 one-off price, implement
   checkout, grant/reconcile Pro idempotently, and add purchase recovery. The
   current disabled action is truthful.
2. **Entitlement contract still overstates some implementation:** Pro currently
   receives `advanced_recommendations`, `advanced_stats` and
   `game_night_enhanced`, although no corresponding behaviour is enforced or
   exposed. `live_play_enhancements` is now implemented and independently
   enforced. Before sale, expose only implemented capabilities or explicitly
   separate planned capability identifiers from granted entitlements.
3. **For You resilience is process-local:** persist a last-known-good candidate
   snapshot, define freshness, and verify restart behaviour. Candidate metadata
   also needs an intentional failure/fallback policy.
4. **Cold-start value is now labelled truthfully:** an empty/no-signal Pro
   account keeps useful popular fallback results, labelled with their source
   basis and an existing preferences action. Improving the value of that
   fallback remains separate from representing it accurately.
5. **Operational proof remains absent:** no live BoardGameGeek or production-like
   availability check was run in this audit.

## Recommended next slice: Pro entitlement and For You readiness

Complete a pre-checkout hardening slice before implementing billing.

Acceptance criteria:

- The frontend-facing entitlement list contains only capabilities with shipped,
  independently enforced behaviour; planned identifiers cannot imply access.
- Preserve the completed truthful distinction between personalised and
  popular-fallback results for empty and sparse accounts.
- Last-known-good Hot/ranked candidates survive an application restart with a
  documented freshness limit; partial-source degradation remains useful and
  total failure remains distinct from an empty result.
- Candidate metadata failure has a tested recovery or explicit unavailable
  state rather than silently weakening explanations.
- Deterministic tests cover Free 403, Pro access, empty shelf, one play,
  preference overrides, fresh cache, persisted stale fallback, ranked-only
  failure, Hot-only For You and total source failure.
- No billing, price or entitlement grant migration is included in this slice;
  £3.99 one-off checkout remains the subsequent commercial implementation.

## Validation record

SP-PB10/SP-PB11 addendum (28 September): the complete backend suite passed with
236 tests and one pre-existing Starlette `TestClient`/httpx deprecation warning.
Five focused checks against a disposable local PostgreSQL database proved one
timer under concurrent
Start, one play under concurrent/repeated save, cross-account isolation, strict
finished-timer game matching and timer retention after tier loss; the database
was then removed. A second disposable PostgreSQL database migrated from empty
to `b04c8f13a2d7`, and `alembic check` reported no new upgrade operations.
Forty-nine frontend tests and the existing
mocked Playwright coverage of Pro controls and the persistent indicator at
390/1440px in light/dark also passed. A real-phone background/reopen check
remains on the pre-beta checklist. Outside-app timer/notification work remains
separate. No real device, notification, lock-screen surface or production
service was tested; SP-PB02 remains blocked and beta remains on hold.

- Code inspection: frontend route/component checks, backend dependency scoping,
  central entitlement mapping, routers, services and repositories.
- Mocked/isolated tests: 75 relevant backend tests passed. Two focused For You
  regressions were added for an empty collection and a single-play history.
- Database-backed repository tests were not run because the configured local
  PostgreSQL test service at port 5433 was unavailable; the audit did not start,
  reset or mutate it.
- Live verification: none. No claim about current BGG availability is made.
