# ShelfPick

ShelfPick is a mobile-first application for answering a familiar game-night question: **what should we play?**

The application imports a board game collection, stores game and play-history data in PostgreSQL, and recommends suitable games based on player count, available play time, complexity and recent play history.

The product is being developed as a decision engine for people with growing board game collections. Collection management, play logging and discovery support the central goal: making a useful, explainable game-night choice.

It is also being developed as a data-engineering portfolio project, with an emphasis on ingestion, transformation, relational modelling, API design, testing and explainable recommendation logic.

## Current progress

ShelfPick now has a working end-to-end application flow covering account onboarding, collection ingestion, recommendation, discovery, play tracking and collection analytics.

Currently implemented:

- React + TypeScript mobile-first frontend
- installable PWA support
- Python/FastAPI backend
- PostgreSQL 16 local development environment using Docker Compose
- SQLAlchemy persistence layer
- Alembic database migrations
- layered API, service and repository architecture
- user accounts with registration, login and JWT-based authentication
- email verification and password-reset flows
- Argon2 password hashing (pwdlib) and PyJWT-signed access tokens
- per-user data isolation across collection, plays and insights
- BoardGameGeek XML API client and parsers
- retry handling for queued BoardGameGeek API responses
- BG Stats JSON collection ingestion
- BG Stats historical play ingestion
- idempotent play import using source identifiers
- one-tap "send to BG Stats" integration for plays logged in the app
- game metadata including player counts, play time, complexity, ratings and artwork
- category and mechanic persistence via relational join tables
- deterministic and explainable recommendation engine
- player-count suitability using BoardGameGeek community poll data
- play-time, complexity, age, play-style, theme and mechanic filtering
- expansion exclusion across collection views and Picker candidates
- recommendation scoring informed by historical play recency
- Picker selection, redraw and play analytics
- polished game reveal and sharing interface using real BoardGameGeek artwork
- play-history recording from the frontend, including participants, scores and winners
- reusable player identities with normalised-name matching, so the same person is recognised across plays regardless of case or whitespace
- player-name autocomplete when logging a play
- collection resynchronisation that reconciles additions and removals against the current BoardGameGeek collection
- collection-insights API and React dashboard
- PostgreSQL aggregate queries for most played, last played and never played games
- personal head-to-head game rankings with shareable top lists
- ranking summaries for favourite games, designers, publishers, mechanics and categories in Insights
- Game Night preview showing the planned shared-group experience
- Discover recommendations drawn from BoardGameGeek hot and ranked sources
- fail-open handling, caching and cooldown behaviour for unavailable discovery sources
- per-user Want to Play lists with add, remove, detail and move-to-collection flows
- route-aware navigation and refresh-safe Collection and Want to Play detail pages
- GitHub Actions quality gates for migrations, backend tests and frontend validation
- Render Blueprint configuration for the PWA, API and managed PostgreSQL database
- Resend integration for production verification and password-reset email
- automated tests across parsers, repositories, services and API endpoints

BoardGameGeek is the primary source for collection and metadata synchronisation. BG Stats exports provide historical play data and can also be processed by the collection-ingestion service.

## Product direction

The picker remains the main entry point, but the application is intended to grow around five connected areas:

### Pick

- filter the collection by player count, available time, complexity, age, play style, theme and mechanics
- use BoardGameGeek community poll data to prefer games that genuinely suit the selected player count
- exclude expansions from eligible Picker candidates
- rank suitable games using explainable scoring
- use play history to surface games that have been neglected
- record selection, redraw and play events for future recommendation analysis
- reveal and share the selected game with clear recommendation context over its artwork
- show useful session context such as the last played date and last winner

### Collection

- browse and manage the owned collection
- import games from BG Stats
- import and synchronise games from BoardGameGeek, including removing games that are no longer owned on a resync
- add games manually
- category and mechanic metadata is persisted; designers and publishers are not yet retained

### Discover

- combine BoardGameGeek hot and ranked candidates without duplicating games
- exclude games already owned by the current user
- rank candidates using category and mechanic overlap with the owned collection
- explain whether a result is currently popular, highly ranked or similar to owned games
- save a recommendation to a per-user Want to Play list
- review a saved game's details, remove it or move it into the owned collection

Discover currently uses ownership as an initial preference signal. Explicit favourites, dismissals and preference controls are intentionally deferred until closed-alpha feedback shows which signals are most useful.

### Play

- record game sessions with participants, scores and winners rather than only aggregate player counts
- reusable player identities: a normalised-name match means "Alex" and "alex" resolve to the same player rather than fragmenting stats
- player-name autocomplete when logging a session, sourced from previously used players
- send a logged play directly to BG Stats via a one-tap integration
- import participant-level historical data from BG Stats where available
- retain session date, duration and other useful play metadata
- surface player-level analytics (win rate, head-to-head, most-played-together) from the identities already captured

The relational model has evolved to:

```text
games
players
plays
play_participants
```

`play_participants` associates a `player` with an individual `play` and is the natural home for participant-specific values such as score and winner status. `players` are scoped per user and matched by a normalised name, so the same person is recognised across sessions without needing an account of their own. This structure supports player-level analytics without overloading the `plays` table, and the two Alembic migrations that introduced it also backfilled existing play history so no participant data was lost.

### Insights

The analytics area is intended to support time-based, game-based, collection-based and player-based views, including examples such as:

- most played games
- most played games by month, year and all time
- total plays by month and year
- most successful games for a selected player
- player win counts and win rates
- head-to-head player statistics
- last winner for a game
- games not played recently
- collection utilisation
- most represented designers
- most represented publishers
- category and mechanic distributions

Ranked views will support top-N questions such as top 10 most played games or the games a selected player has won most often.

## Architecture

```text
React / TypeScript PWA
          |
          v
       FastAPI
          |
          v
  Application services
      /        \
     v          v
BGG / BG Stats  Repositories
                    |
                    v
                PostgreSQL
```

The backend uses a layered architecture so external clients, application logic and persistence remain separated.

```text
API
 |
Service
 |
Repository / External client
 |
PostgreSQL / BoardGameGeek / BG Stats
```

This keeps business logic independent of transport and persistence details and allows individual layers to be tested in isolation.

## Data ingestion

The application supports both BoardGameGeek XML and BG Stats JSON data flows.

```text
BoardGameGeek XML API ----> BGG parser --------\
                                               > Domain Game model
BG Stats JSON export ------> Collection parser /
                                                      |
                                                      v
                                                Import service
                                                      |
                                                      v
                                                  Repository
                                                      |
                                                      v
                                                 PostgreSQL
```

Historical play data is imported separately from the same BG Stats export:

```text
BG Stats plays
      |
      v
Resolve gameRefId to BGG ID
      |
      v
Parse play date, players and duration
      |
      v
Deduplicate by source + play UUID
      |
      v
PostgreSQL plays table
```

The collection importer filters the export to currently owned games and uses the BGG ID as the stable game identifier. Re-importing collection data updates existing records instead of creating duplicates.

Historical plays are also idempotent: imported play UUIDs are stored with their source so repeated imports do not duplicate play records.

Data also flows in the other direction for plays logged directly in the app: a one-tap link builds a BG Stats-compatible payload client-side and hands it to the BG Stats app, so a session recorded here doesn't have to be re-entered there.

Onboarding supports BoardGameGeek collection synchronisation and BG Stats historical-play import. Games can also be added individually through collection search, so collection management is not tied to a single source.

## Recommendation engine

The recommendation engine is deterministic and explainable rather than AI-driven.

Games are first filtered for eligibility using criteria such as:

- player count
- maximum play time
- maximum complexity
- ownership status

Eligible games are then ranked using a weighted score. Current scoring considers suitability against the selected criteria and historical play recency, allowing games that have not been played recently to rank above otherwise similar choices.

The API returns both the score and human-readable reasons so the frontend can explain why a game was recommended.

Example reasons include:

- `Supports 3 players`
- `Fits within 60 minutes`
- `Complexity 2.8 fits preference`
- `Hasn't been played in a while`

Picker analytics now records selection, redraw and completed-play events so
future scoring changes can be based on observed use. Play-history scoring will
continue to be refined as the project develops.

## Collection insights

The application includes collection analytics backed by PostgreSQL aggregate queries.

Current insights include:

- total owned games
- total recorded plays
- most played games
- last played game
- games that have never been played
- personal game rankings built from head-to-head choices
- shareable Top 10, 20, 50 and 100 lists
- ranking summaries for favourite designers, publishers, mechanics and categories

Historical BG Stats plays feed the same database used by the picker, so analytics and recommendations operate from a shared source of truth.

The reusable player identities introduced for play recording provide the foundation the analytics layer needs to expand into winner, score, player, monthly, yearly, designer and publisher statistics; the insights queries themselves are not yet updated to group by that identity.

## Technology stack

### Backend

- **Python 3.12** — application, ingestion and transformation logic
- **FastAPI** — REST API and dependency injection
- **Pydantic** — request validation
- **SQLAlchemy** — ORM, sessions and database access
- **psycopg** — PostgreSQL driver
- **httpx** — BoardGameGeek HTTP client
- **pwdlib (Argon2)** — password hashing
- **PyJWT** — signed access tokens
- **pytest** — unit and integration testing

### Database and infrastructure

- **PostgreSQL 16** — relational application database
- **Alembic** — version-controlled schema migrations
- **Docker / Docker Compose** — reproducible local database environment
- **Render** — production static hosting, FastAPI deployment and managed PostgreSQL
- **Resend** — transactional email for verification and password resets

### Frontend

- **React**
- **TypeScript**
- **Vite**
- **vite-plugin-pwa** — installable mobile web application support

### Planned / next

- production observability and feedback capture
- privacy information, account deletion and essential product events
- production smoke testing, backup/restore rehearsal and rollback verification
- closed-alpha testing with 3–5 users
- explicit Discover preferences, favourites and Not Interested signals after alpha feedback
- recommendation-engine refinement based on observed user behaviour
- player-based insights and expanded play and collection analytics
- designer and publisher persistence
- AI-assisted natural-language filtering only where it adds clear value

## Testing

Testing is developed alongside each milestone rather than added at the end of the project.

The test suite covers areas including:

- BoardGameGeek HTTP client behaviour
- XML parsing
- BG Stats JSON parsing
- historical play parsing
- collection processing
- PostgreSQL connectivity
- repository CRUD operations
- service-layer behaviour
- recommendation scoring
- Discover source handling and wishlist behaviour
- collection insights
- authentication, verification and password recovery
- production configuration and transactional-email behaviour
- FastAPI endpoints

External dependencies are replaced with fakes, mocks or dependency overrides where appropriate so individual application layers can be tested independently.

Run the backend tests from `backend`:

```bash
python -m pytest
```

Check that SQLAlchemy models and Alembic migrations remain aligned:

```bash
alembic check
```

From `frontend`, run the routing tests, lint, production build and generated
PWA asset check:

```bash
npm test
npm run lint
npm run build
npm run check:pwa
```

GitHub Actions runs these frontend checks and the complete backend suite on
every push and pull request. Its PostgreSQL 16 service starts empty, so the CI
backend job also proves that the full Alembic migration history upgrades a
clean database and remains aligned with the SQLAlchemy models.

## Local development

### Prerequisites

- Python 3.12.14 (declared in `.python-version`)
- Node.js 22 (declared in `.node-version` and `frontend/package.json`)
- Docker Desktop / Docker Compose

### Apple Silicon macOS

Use native arm64 builds of Python, Node.js and Docker Desktop. Rosetta is not
required. A version manager such as pyenv for Python and fnm, nodenv or Volta
for Node can read the version declarations at the repository root. Confirm a
native shell and toolchain before installing dependencies:

```bash
uname -m
python3 --version
node --version
```

`uname -m` should report `arm64`, Python should report `3.12.14`, and Node
should report a `v22` release. The Python bundled with macOS is not suitable
for this project.

Create the backend environment with the declared Python version:

```bash
cd backend
python3.12 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
```

On first setup, copy `backend/.env.example` to `backend/.env` and replace only
the local placeholders. `BGG_API_TOKEN` may remain blank for development, but
authenticated BoardGameGeek requests require a real token kept outside source
control.

### Database

Start PostgreSQL from the repository root:

```bash
docker compose up -d
```

Apply database migrations from `backend`:

```bash
alembic upgrade head
```

The backend uses a `DATABASE_URL` environment variable. Local secrets and personal collection exports are intentionally excluded from source control.

For repeatable real-authentication checks of Free and Pro entitlements, Game
Night voting and live timers, use the guarded dedicated-account workflow in
[`docs/local-free-pro-testing.md`](docs/local-free-pro-testing.md). It seeds
only a local development PostgreSQL target and documents cleanup and LAN/phone
configuration.

### Backend

From `backend` with the virtual environment activated:

```bash
uvicorn api.main:app --reload
```

FastAPI's interactive API documentation is available at `/docs` on the local API server.

For local testing from another device on the same network, the API can be exposed on the local network:

```bash
uvicorn api.main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend

From `frontend`:

```bash
npm ci
npm run dev
```

For local mobile testing:

```bash
npm run dev -- --host
```

The frontend API URL can be configured using the `VITE_API_BASE_URL` environment variable.

Build the frontend with:

```bash
npm run build
```

The authenticated frontend uses client-side routes. A production static
host must rewrite unknown, non-asset navigation requests to `/index.html`
with a successful response so direct links and refreshes work. The PWA
service worker also uses `/index.html` as its navigation fallback, but it
does not replace the host rewrite for a visitor's first request.

## Production deployment

Production is defined in `render.yaml` as a Render Blueprint containing the
static PWA, FastAPI service and private PostgreSQL 16 database. GitHub Actions
must pass before Render deploys a commit. Alembic migrations run as an
explicit pre-deploy command rather than inside the web process.

Secrets and environment-specific URLs are prompted for by Render and are not
stored in source control. The database must use a paid plan so point-in-time
recovery and logical exports are available for the closed alpha.
Render is pinned to Python 3.12.14 and Node 22 by the Blueprint. Production
startup fails with a variable-name-only error when required configuration,
including `BGG_API_TOKEN`, is blank.

Follow [the production deployment runbook](docs/production-runbook.md) for
domain setup, Resend verification, environment values, smoke testing,
backup/restore rehearsal and rollback.

## Roadmap

Development is currently organised around reaching a small closed alpha before expanding the recommendation engine.

**UX-1B is on `origin/main`:** recoverable requests, accessible registration/password reset, and bounded tablet/desktop layouts shipped in `aa68663`, with GitHub Actions run #44 passing. See [UX-1B release notes](docs/ux-1b-release-notes.md) for validation and limitations. **Foundation B production verification is in progress; authenticated Render checks remain next.**

1. ~~**Release Foundation A**~~ — done: GitHub Actions, clean frontend linting, production builds and valid PWA assets provide an automated quality gate.
2. ~~**Release Foundation B configuration**~~ — done: the Render Blueprint, production configuration validation, Resend integration and deployment/recovery runbook are in the repository.
3. **Release Foundation B verification** — provision the Render environment, verify real email delivery, rehearse backup recovery and complete the production smoke tests.
4. **Release Foundation C** — add production monitoring, feedback capture, privacy information, account deletion, essential product events and an authenticated journey check.
5. **Personal production use** — use the deployed application for 24–48 hours and resolve release-blocking issues.
6. **Closed alpha** — invite 3–5 independent testers and observe onboarding, first recommendation, return use and failure points.
7. **Discover preferences** — add favourites, Not Interested and explicit preference controls using evidence from the alpha.
8. **Recommendation Engine v2** — improve ranking and explanations based on accepted choices, redraws, recorded plays and tester feedback.
9. **Early beta** — expand to 10–20 testers once the main journeys and recommendation loop are reliable.

Player analytics, richer metadata, billing, social and group features, wider AI use and BoardGameGeek write-back remain later or dependency-gated work. They do not block the closed alpha.

## Potential product model

The immediate priority is building a useful product rather than implementing billing. If the application develops into a public release, one possible model is to keep the core picker and collection experience free while evaluating advanced analytics and personalisation as optional premium functionality.

Potential free functionality could include collection management, importing, the basic picker, game reveals and basic play recording. Potential premium functionality could include deeper player analytics, win/loss history, head-to-head statistics, advanced trends, richer collection analytics and advanced recommendation preferences.

This is a product direction rather than a committed pricing model; monetisation will only be considered after the core experience is useful and validated.

## Project goals

The project is intended to demonstrate practical experience with:

- external API and file-based data ingestion
- XML and JSON parsing
- transformation into consistent domain models
- idempotent data loading
- source identifier mapping and deduplication
- relational data modelling
- PostgreSQL and SQL aggregation
- schema migration management
- Python application architecture
- REST API design
- automated testing
- Docker-based development
- explainable recommendation logic
- React and TypeScript frontend integration
- analytical data modelling for game, session and player-level reporting
- CI/CD and repeatable cloud deployment configuration
- production operations, recovery planning and release validation

## Status

**Active development**

The core application is functional end to end: account onboarding and recovery, collection ingestion, PostgreSQL persistence, explainable recommendations, Discover, Want to Play, rich play tracking and collection insights are implemented. BG Stats supports both historical-play import and one-tap hand-off for plays logged in the app.

Automated quality gates and repeatable Render deployment configuration are also in place. Current development is focused on provisioning and verifying the production environment, then adding the monitoring, privacy, feedback and operational safeguards needed for a 3–5 person closed alpha. Recommendation expansion will follow evidence from those testers rather than delaying the first release.
