# SP-SCORE-03A iPhone playtest package

This package is local-only and isolated from ShelfPick production. It uses a
loopback-bound PostgreSQL 16 container with a tmpfs data directory: no named
volume, production database, existing development volume, or user data is
used. It has not been deployed.

## Candidate identity

- Branch: `main` (uncommitted owner work preserved)
- Base commit: `871d4bf5436ca41b3f4301f10cc647001b5b3bcf`
- Candidate files and SHA-256 values are recorded by:

  ```sh
  shasum -a 256 \
    frontend/src/scoresheets.ts \
    frontend/src/components/collection/ScoresheetPanel.tsx \
    frontend/src/components/collection/PlayLogForm.tsx \
    frontend/src/styles/collection.css \
    frontend/src/scoresheets.test.mjs \
    frontend/src/scoresheet-integration.test.mjs \
    backend/tests/test_scoresheet_persistence_postgres.py \
    backend/scripts/scoresheet_preview.py \
    docker-compose.score03a.yml
  ```

## Start and seed

Choose a temporary review password; do not commit it.

```sh
docker compose -f docker-compose.score03a.yml up -d

cd backend
export DATABASE_URL='postgresql+psycopg://shelfpick_test:shelfpick_score03a_local@127.0.0.1:55433/shelfpick_score03a_test'
export JWT_SECRET='replace-with-a-local-random-value'
export APP_ENV=development
export SCORESHEET_PREVIEW_PASSWORD='replace-with-a-local-review-password'
export CORS_ORIGINS='http://localhost:5173,http://127.0.0.1:5173,http://LAN-IP-OF-MAC:5173'
export FRONTEND_URL='http://LAN-IP-OF-MAC:5173'
.venv/bin/python -m alembic upgrade head
.venv/bin/python -m scripts.scoresheet_preview setup
.venv/bin/uvicorn api.main:app --host 0.0.0.0 --port 8000
```

In another shell:

```sh
cd frontend
VITE_API_BASE_URL='http://LAN-IP-OF-MAC:8000' npm run dev -- --host 0.0.0.0 --port 5173
```

Open `http://LAN-IP-OF-MAC:5173` on the iPhone and sign in as
`score03a-review@example.com` with the temporary review password. Keep this on
a trusted local network. The database remains loopback-only. Add the LAN
frontend origin to `CORS_ORIGINS` when starting the backend.

## Review checklist

For Wingspan, Terraforming Mars, and Harmonies: open the game from Collection,
log a two-player play with the native scoresheet, confirm live totals and the
winner, save, leave the game, reopen it, and confirm names, totals, winner, and
history count. Also check incomplete/invalid values, a tied result, Wingspan
Oceania Nectar, light/dark themes, and the on-screen keyboard at narrow portrait
width. Physical iPhone Safari and VoiceOver remain owner-run checks.

## Reset and teardown

```sh
cd backend
.venv/bin/python -m scripts.scoresheet_preview reset
cd ..
docker compose -f docker-compose.score03a.yml down
```

`reset` removes only the marker-owned review account and its data. `down`
destroys the tmpfs-backed database. A public URL requires separate deployment
authorisation.
