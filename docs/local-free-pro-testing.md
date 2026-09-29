# Local Free and Pro manual testing

ShelfPick provides two dedicated development accounts for checking real login,
backend entitlement enforcement, Game Night phone voting and the live play
timer. The setup uses the normal authentication and entitlement paths; it does
not add a frontend override, public grant endpoint or production tier control.

## Safety boundaries

The account tool exits before opening a database session unless all of these
conditions are true:

- `APP_ENV` is exactly `development`;
- `DATABASE_URL` uses PostgreSQL;
- the database host is `localhost`, `127.0.0.1` or `::1`; and
- the database name is one of the explicitly allowed development names printed
  by the tool.

It owns only accounts carrying its private marker. If either reserved email
already belongs to an unmarked account, setup stops rather than changing that
account. Running setup again refreshes only the dedicated accounts and retains
any manual test activity already associated with them. Three synthetic games
are the only catalogue data added.

## Create the accounts

From a clean local checkout:

```bash
cd ~/Developer/shelfpick
docker compose up -d postgres
cp backend/.env.example backend/.env  # only when backend/.env does not exist
cd backend
.venv/bin/python -m alembic upgrade head
.venv/bin/python -m scripts.local_test_accounts setup
.venv/bin/python -m scripts.local_test_accounts status
```

The logins are:

| Access | Email | Password |
| --- | --- | --- |
| Free | `local-free@shelfpick.app` | `ShelfPickLocal123!` |
| Pro | `local-pro@shelfpick.app` | `ShelfPickLocal123!` |

To use a different local password, set
`SHELFPICK_LOCAL_TEST_PASSWORD` to at least 12 characters for every `setup`
run. The normal login form and backend password verification are used.

Start the API from `backend` and the web app from `frontend`:

```bash
# terminal 1
cd ~/Developer/shelfpick/backend
.venv/bin/python -m uvicorn api.main:app --reload --host 127.0.0.1 --port 8000

# terminal 2
cd ~/Developer/shelfpick/frontend
npm run dev -- --host 127.0.0.1 --port 5173
```

Open `http://127.0.0.1:5173`, then use a private/incognito window when switching
accounts. Each account owns the same three synthetic `[Local Dev]` games and
has an account player plus `Guest Tester`, which is enough to build a Game
Night shortlist. The Free account can use that basic shortlist but the backend
rejects hosting phone voting and starting a live timer. The Pro account can
open voting and start a timer. Open the voting join link in a separate private
browser context to exercise the accountless guest path.

## Test from a physical phone

`localhost` and `127.0.0.1` on a phone refer to the phone itself. A QR code or
join link containing either address will **not** reach the development machine.
Put the phone and computer on the same network, determine the computer's LAN
address (for example `192.168.1.25`), and use that address consistently.

Set the backend values in `backend/.env` before starting it:

```dotenv
CORS_ORIGINS=http://192.168.1.25:5173,http://localhost:5173,http://127.0.0.1:5173
FRONTEND_URL=http://192.168.1.25:5173
```

Then bind both servers to the LAN and point the frontend at the reachable API:

```bash
# terminal 1
cd ~/Developer/shelfpick/backend
.venv/bin/python -m uvicorn api.main:app --reload --host 0.0.0.0 --port 8000

# terminal 2
cd ~/Developer/shelfpick/frontend
VITE_API_BASE_URL=http://192.168.1.25:8000 npm run dev -- --host 0.0.0.0 --port 5173
```

Open `http://192.168.1.25:5173` on the phone. `FRONTEND_URL` is the origin used
to generate the voting join link and QR payload, so it must exactly match the
address that the guest phone can reach. Replace the example address with the
computer's actual LAN address and allow the two ports through the local
firewall if prompted. Physical-phone QR scanning remains a manual pre-beta
check until it has actually been performed.

## Remove the dedicated data

Removal is subject to the same local-only safeguards. It deletes the two marked
accounts and their dependent test activity. It deletes a synthetic game only
when nothing outside those accounts references it.

```bash
cd ~/Developer/shelfpick/backend
.venv/bin/python -m scripts.local_test_accounts remove
.venv/bin/python -m scripts.local_test_accounts status
```

The final status should report both accounts missing and `0/3` synthetic games.
