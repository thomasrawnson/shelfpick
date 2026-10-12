# SP-PB09 / SP-PB16A — Add-game and barcode feasibility audit

**Date:** 11 October 2026
**Scope:** The initial audit was read-only; the bounded SP-PB09B implementation
record is included below. SP-PB16 remains unchanged.

## Decision

- The existing BoardGameGeek title-search flow is a usable beta path for adding
  games to **Owned**. Do not rebuild it.
- **Want to Play** works through Discover and its API, but the Collection Add
  game search cannot select that destination. This is missing entry-point
  functionality, not loss of wishlist data or a broken wishlist backend.
- True non-BGG custom games do not exist and are not required for beta or
  launch. They are a large post-launch identity and data-quality feature.
- Retail barcode scanning should not be in the launch critical path. Camera
  decoding is feasible; identifying a decoded UPC/EAN as the correct BGG game
  or edition is blocked on a licensed data source, measured coverage and an
  approved cost/terms decision.
- **SP-PB09B: Add-game destination parity and expansion guard** was subsequently
  implemented as the independent bounded slice recorded below.

## SP-PB09B implementation record — 11 October 2026

**Status: COMPLETE. Complexity: Small.** The existing search panel and routes
were retained. Each result now has independent Add to Owned and Add to Want to
Play actions and carries both account-scoped membership flags, including the
supported state where both memberships already exist. No action silently moves
or removes the other membership. The query and result set stay mounted after
success or failure; accessible status/error copy reports the outcome. A
synchronous guard allows one mutation at a time, preventing repeat clicks before
React rerenders, and both actions have a 44px minimum target with a stacked
mobile layout.

Wishlist adds now use the same authoritative base-game rule as Owned. A cached
row with incomplete expansion classification is refreshed through the existing
BGG thing request before membership; a confirmed expansion, missing game,
missing primary name or mismatched returned BGG ID fails before catalogue or
membership persistence. Existing saved rows are not removed.

Validation closeout: the existing PostgreSQL 16 development container was
started against its existing named volume on `localhost:5433`; no database was
reset, recreated or migrated. The 42-test targeted collection/wishlist service,
API and repository set passed, covering account isolation, idempotent existing
membership, expansion rejection, valid base games, incomplete metadata and
persistence. The full backend suite passed 278 tests with 5 intentional skips.
The configured frontend suite passed 71 tests; lint and production build passed,
as did the PWA asset check. The colour review command completed successfully and
continued to report its 14 pre-existing raw-colour review notices.

Playwright drove the installed Google Chrome through a controlled local API
fixture at 390x844 and 1440x900 in both light and dark themes. All four matrix
runs passed Add to Owned, Add to Want to Play, Owned/wishlist/both labels,
synchronous duplicate-click protection, retained query/results, visible and
reachable keyboard focus, horizontal-overflow and bottom-navigation-clearance
checks. A forced 502 wishlist response also passed clear error feedback, retry,
state preservation and Close-to-trigger focus restoration. This is automated
browser evidence, not physical-device or assistive-technology testing.

## Current implementation

### Title search and add to Owned

`frontend/src/components/collection/AddGameSearch.tsx` retains the query,
requires two characters, submits to `GET /collection/search`, shows loading,
upstream errors, explicit no-results copy and a success status, and disables an
already-owned or already-wishlisted destination. It submits either
`POST /collection/games/{bgg_id}` or `POST /wishlist/{bgg_id}` without moving
the other membership. `frontend/src/components/CollectionView.tsx` merges an
Owned result without replacing Collection state and restores focus when the
panel closes. Add game is already visible on populated, empty and filtered
Owned views; BGG bulk import is linked separately.

The backend path is `backend/api/routers/collection.py` →
`backend/services/collection_service.py` →
`backend/repositories/game_repository.py`. It uses the registered server-side
BGG client, limits title results to 20, marks results already owned by the
current user, fetches full BGG metadata on add, rejects expansions and creates
an account-scoped `user_games` membership with source `manual`.

Duplicate Owned adds are idempotent at repository level: the composite
`user_games` key prevents duplicate memberships and an existing membership is
treated as success. The frontend merge is also identity-preserving.

### Want to Play

Want to Play is implemented and user-scoped. Discover cards call
`POST /wishlist/{bgg_id}`; Collection lists the wishlist, supports removal, and
atomically moves a wishlisted game to Owned through
`POST /wishlist/{bgg_id}/move-to-collection`. Duplicate wishlist adds are
idempotent and existing play history is preserved.

SP-PB09B closed the former discoverability/parity gap: the same title-search
result now exposes independent Owned and Want to Play actions, and returns both
account-scoped membership flags. A user can still save Discover candidates and
can now title-search an arbitrary BGG game directly
into Want to Play from the Add game entry.

### Data model and API constraints

The catalogue is BGG-keyed end to end. `games.bgg_id` is non-null and unique;
the public `Game` contract requires a numeric `bgg_id`; collection, wishlist,
plays, live timers, rankings, Picker analytics, recommendations, Game Night and
frontend routes/payloads use that identifier. `user_games` and
`user_wishlist_games` are separate account-scoped memberships over the shared
catalogue row.

Current relevant endpoints:

| Purpose | Endpoint |
| --- | --- |
| BGG title search | `GET /collection/search?query=...` |
| Add to Owned | `POST /collection/games/{bgg_id}` |
| List Owned | `GET /games` |
| Remove from Owned | `DELETE /collection/{bgg_id}` |
| List / inspect Want to Play | `GET /wishlist`, `GET /wishlist/{bgg_id}` |
| Add / remove Want to Play | `POST /wishlist/{bgg_id}`, `DELETE /wishlist/{bgg_id}` |
| Move Want to Play to Owned | `POST /wishlist/{bgg_id}/move-to-collection` |
| BGG collection import | `POST /collection/sync` |
| BG Stats import | existing import endpoints, keyed by BGG ID |

## Confirmed defects and missing functionality

### Confirmed defects

1. **Wishlist expansion validation is inconsistent (Recommended before
   launch, Small).** `CollectionService.add_game` rejects BGG expansions, but
   `WishlistService.add_game` accepts any parsed BGG item. Current Discover
   sources normally keep expansions away from the UI, so this is not a proven
   common user failure, but the authenticated API can create a Want to Play
   expansion and violate the base-game invariant. Apply the same expansion
   rejection before persistence and cover existing-catalogue and freshly
   fetched expansion cases.

No beta-blocking defect was confirmed in the existing Owned title-search flow.
The prior SP-PB09 responsive/mock-browser evidence remains the strongest UI
evidence; this audit did not claim a new physical-device or live-BGG pass.

### Missing functionality, not regressions

1. **Add-game destination parity (Recommended before launch, Small).** The
   search panel cannot add a result directly to Want to Play. Preserve the
   working search and expose explicit Owned / Want to Play actions with
   independent duplicate states.
2. **Custom games (Post-launch, Large).** There is no supported path to create a
   catalogue game without BGG. The apparently generic `GameCreate` schema is
   not exposed as a user creation endpoint and still requires `bgg_id`; it is
   not custom-game support.
3. **Retail barcode identification (Blocked / external approval).** No barcode
   field, lookup endpoint, provider adapter or BGG-ID mapping exists.

### Optional improvements

- Clear or disable stale result actions while a replacement search is in
  flight, and identify the submitted query in no-result/error copy.
- Add a visible label rather than relying on the current screen-reader-only
  search label if future usability testing shows placeholder-only context is
  unclear.
- Run a physical-phone screen-reader, zoom, camera and permission-denial pass
  when a scan prototype exists. Existing CSS stacks the search action below
  480px and existing SP-PB09 evidence covered 390px and 1440px with mocks, but
  that is not physical-device evidence.

## Custom-game feasibility

Genuine custom games require a source-neutral internal game identity rather
than a fabricated or negative BGG ID. A safe implementation would add an
internal stable ID, make the external source/ID optional and uniquely scoped,
record provenance (`bgg`, `custom`, later providers), and migrate routes and
foreign references away from treating `bgg_id` as universal identity.

Minimum affected areas include collection/wishlist membership, play history,
live timers, rankings, Picker and Game Night payloads, analytics, artwork,
search, duplicate rules and deletion/merge policy. BGG and BG Stats imports
must remain idempotent and must not silently merge a similarly named custom
game. Exports/shares must tolerate absent BGG links. Custom games lack trusted
player counts, duration, complexity, rating, polls, categories and mechanics;
Picker must either require enough owner-supplied metadata or exclude them with
truthful copy. Discover candidates remain external-catalogue games, and global
rank/source features cannot pretend custom games have BGG evidence.

This is not essential before beta: the working BGG search, BGG collection
import and BG Stats import cover the launch catalogue path. Defer until usage
evidence shows that prototypes, unpublished games or missing listings are a
material problem.

## Barcode feasibility

### Decode layer

Camera access is feasible in the installed PWA and normal browser tabs through
`navigator.mediaDevices.getUserMedia`, subject to HTTPS/localhost, an explicit
user permission prompt and a top-level/allowed document. Camera absence,
permission denial, dismissal, OS/browser restrictions and stream interruption
must be normal recoverable states. Request the rear camera as a preference, not
an assumption, stop every media track on success/cancel/unmount, and never
request permission before a user chooses Scan.

The native `BarcodeDetector` API can decode images but remains experimental and
not Baseline, so it cannot be ShelfPick's only decoder. A bounded fallback such
as `@zxing/browser` can continuously decode a selected video device and can be
restricted to UPC-A, EAN-8 and EAN-13. The browser package is MIT-licensed; its
core peer library is Apache-2.0. Package/license/security review is still
required before adding dependencies. Manual code entry must remain available.

Sources checked on 11 October 2026:

- MDN `getUserMedia`: <https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia>
- MDN `BarcodeDetector`: <https://developer.mozilla.org/en-US/docs/Web/API/BarcodeDetector/detect>
- ZXing browser package/API: <https://github.com/zxing-js/browser>

### Identification layer

A decoded UPC/EAN is only a GTIN string. It does not contain a BGG ID and may
identify a particular language, printing, bundle or regional edition rather
than a canonical game. The BGG XML API exposes title search and thing metadata,
but its documented surface does not establish an official UPC/EAN-to-BGG
lookup. Title text returned by a general product service can be used only to
produce candidates for explicit user confirmation; it is not a deterministic
join.

Potential commercial product APIs exist (for example UPCitemdb advertises
UPC/EAN/GTIN lookup and paid request tiers), but this audit found no evidence
that any provider guarantees board-game coverage or canonical BGG IDs. A free
trial quota is not a commercial-data licence decision. Do not choose a provider
until written terms permit ShelfPick's intended caching/display, pricing is
approved, retention/deletion rules are understood, and a representative
coverage test passes.

BGG also requires registration/authorization, attribution and a commercial
licence for commercial XML API use; permission is case-by-case. Its guidance
says private site APIs are not licensed unless separately authorized and warns
against scraping. Barcode work must not manufacture a mapping from scraped BGG
pages or an unlicensed dataset.

External sources:

- BGG XML API use and registration: <https://boardgamegeek.com/using_the_xml_api>
- BGG XML API terms: <https://boardgamegeek.com/xmlapi/termsofuse>
- BGG commercial-use guidance: <https://boardgamegeek.com/wiki/page/BGG_XML_API_Commercial_Use>
- Example provider capabilities/pricing only, not approval:
  <https://upcitemdb.com/api>

### Required fallback

Every unsupported camera, denied permission, unreadable/invalid code, provider
timeout, quota/rate limit, no match and ambiguous result must preserve a direct
path to the existing title search. Never auto-add the first fuzzy candidate.
Show matched title/edition/provider evidence, allow correction, require an
explicit Owned or Want to Play choice, and retain duplicate prevention.

## Launch classification

### MUST FIX BEFORE BETA

- None found in the audited Owned search/add path.
- Existing release gates elsewhere in the roadmap remain unchanged.

### RECOMMENDED BEFORE LAUNCH

- **SP-PB09B — Add-game destination parity and expansion guard (Small).** One
  search should add to Owned or Want to Play; enforce the same base-game rule
  for both.

### POST-LAUNCH

- **SP-PB09C — Custom games discovery/design (Large).** Validate user need,
  then design source-neutral identity and metadata policy before migration.
- **SP-PB16B — Scan/add integration (Medium after the source is approved).**
  Camera/manual decode, provider lookup, candidate confirmation, destination
  choice and search fallback. The source adapter itself may be Medium; data
  cleanup or a maintained mapping catalogue could make the programme Large.

### BLOCKED / REQUIRES EXTERNAL APPROVAL

- Select and contract a commercially permitted UPC/EAN product data source.
- Obtain/confirm BGG commercial authorization appropriate to ShelfPick and the
  resulting product-data-to-BGG candidate workflow.
- Supply 30–50 representative owned game boxes across publishers, regions,
  languages and editions; record exact/ambiguous/no-match coverage rather than
  extrapolating from demos.
- Approve recurring/usage cost, cache/retention terms and an acceptable minimum
  match rate before SP-PB16B.

## Bounded follow-up tasks and acceptance criteria

### SP-PB09B — Add-game destination parity and expansion guard — COMPLETE

**Complexity:** Small. **Dependency:** none beyond existing BGG authorization.

Acceptance:

1. Existing title search has explicit **Add to Owned** and **Add to Want to
   Play** actions without replacing the working search/recovery flow.
2. Search results report both account-scoped membership states; duplicate
   requests remain idempotent and buttons give accurate status.
3. Adding to Want to Play does not mark Owned; adding/moving to Owned follows a
   documented rule for any existing wishlist membership and does not delete
   play history.
4. Both services reject expansions before creating membership, including when
   the catalogue row already exists.
5. Network errors preserve the query/results and allow explicit retry; rapid
   repeat activation cannot create duplicate memberships.
6. Focus, status/error announcements, 44px touch targets, 390px layout and
   browser Back/Collection state are covered by focused tests and responsive
   browser evidence.

### SP-PB16A-EXT — Provider and coverage decision

**Complexity:** Medium investigation. **Dependency:** owner/legal/procurement
approval and representative physical boxes.

Acceptance:

1. At least two permitted providers are compared for commercial rights, board
   game coverage, region/edition detail, uptime/rate limits, caching and cost.
2. A fixed representative sample records exact title+edition match, title-only
   match, ambiguity, wrong match and no match. Raw responses and review outcomes
   remain separate evidence.
3. A documented, non-scraping mapping strategy produces BGG candidates and
   always requires confirmation when the mapping is not authoritative.
4. Tom explicitly approves provider, spend ceiling and minimum coverage, or
   barcode remains deferred.

### SP-PB16B — Barcode scan/add integration

**Complexity:** Medium only after SP-PB16A-EXT passes.

Acceptance:

1. UPC-A/EAN-8/EAN-13 camera and manual entry paths feed one validated lookup
   flow; invalid checksums are rejected locally.
2. Camera permission is user-initiated, rear-facing is preferred, tracks stop
   on every exit, and denial/unsupported/interruption states recover to manual
   entry or title search.
3. Matched/ambiguous/no-match/provider-error states are distinct; no result is
   added without preview, user confirmation and destination choice.
4. Existing duplicate, user-scope, expansion and BGG attribution rules remain
   authoritative.
5. Automated checks are supplemented by physical iOS Safari and Android Chrome
   tests against representative boxes; mocked decoding is not reported as
   real-device or catalogue coverage.

## Validation and limitations

- Frontend configured test command: **66 passed**. It includes the three
  focused add-game tests but is primarily render/unit coverage, not live BGG or
  physical-device evidence. Vite reported its existing dev WebSocket port was
  already occupied; tests still completed successfully.
- Backend selected suite: **23 passed, 12 failed**. All 12 failures came from
  `tests/test_game_repository.py` being configured for PostgreSQL on
  `localhost:5433`, where no server was running; they are environment failures,
  not observed assertions against add-game behaviour. The SQLite-backed
  collection/wishlist/service tests in that run passed.
- No live barcode provider was called, no paid plan was used, no representative
  physical boxes were supplied, and no camera/device test was performed.
- At audit time no application code, database, external service or completion
  status changed; see the later SP-PB09B implementation record above.
