# SP-SCORE-03B local iPhone preview

Date: 1 November 2026

The preview is available only on the Mac's current local network at
`http://192.168.68.103:5173`. It is not deployed to Vercel, Render, ShelfPick
production, or a public tunnel. The frontend and API listen only on
`192.168.68.103`; PostgreSQL listens only on `127.0.0.1:55433` and stores its
data in container tmpfs.

The disposable account credentials are deliberately not recorded in this
repository. They are supplied directly to the owner for the active playtest.

## Owner journey

1. Connect the iPhone to the same trusted Wi-Fi network as the Mac.
2. Open the preview URL in Safari and sign in with the supplied disposable
   account.
3. In Collection, open Wingspan, Terraforming Mars, and Harmonies in turn.
4. Choose **Log a play**, then the named native scoresheet.
5. Enter multiple players and category values; confirm totals and winner text.
6. Save, leave the game, reopen it, and confirm the saved result in history.
7. Include a shared-winner tie and a Wingspan play with Oceania Nectar enabled.
8. Confirm **Use manual scoring** remains available.
9. Repeat once in Light and once in Dark appearance.

Physical iPhone Safari, the on-screen keyboard, VoiceOver, and owner acceptance
remain human checks. The preview stops being reachable if the Mac sleeps,
changes network/IP address, or the local processes are stopped.

## Reset playtest data

From `backend`, with the disposable preview `DATABASE_URL`, `JWT_SECRET`, and
`APP_ENV=development` environment values set:

```sh
.venv/bin/python -m scripts.scoresheet_preview reset
```

Run `setup` again with a new uncommitted `SCORESHEET_PREVIEW_PASSWORD` to create
a clean account.

## Shut down and erase

Stop the local Vite and Uvicorn processes, then run:

```sh
docker compose -f docker-compose.score03a.yml down
```

Because PostgreSQL uses tmpfs and no named volume, `down` permanently removes
all preview database contents. Existing development and production data remain
untouched.
