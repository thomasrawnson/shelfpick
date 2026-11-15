# Automated acceptance tests (SP-TEST-01A)

Automated checks for the onboarding **Account options** flow added in PR #14
(`9e7bc61 Fix onboarding account controls`). Results are `BROWSER VIEWPORT
PASS` (Playwright WebKit with mobile emulation) and, separately, Simulator
captures. Neither is physical-device, VoiceOver, owner or release evidence.

## What is covered

`frontend/e2e/onboarding-account.spec.ts` runs on two WebKit projects,
`iPhone 15` (393×659) and `iPhone SE` (320×568), against a real local API and
PostgreSQL database (no request mocking).

| Test | Checks |
| --- | --- |
| a | `local-onboarding@shelfpick.app` lands on onboarding step 1; Account options is visible and opens `/onboarding/account`. |
| b | Step 2 BGG username is entered, Account options opened, Back to onboarding returns to step 2 with the value kept and focus restored to Account options. |
| c | Log out reaches the signed-out screen with no stored token; the account signs back in. |
| d | Deletion shows the password field (type=password), irreversible warning and confirmation; submit stays disabled until both are given. Back to onboarding abandons it (the screen has no separate Cancel button); the account still signs in. |
| e | A fresh `e2e-disposable-…@shelfpick.app` account registers through the UI, is verified, signs in with onboarding incomplete, deletes itself with its password, is signed out, and its login is then rejected. |
| f | axe-core (WCAG 2.0/2.1 A+AA and 2.2 AA tags; fails on serious/critical) on onboarding and Account options; accessible names for Account options, Back to onboarding, Log out, password, confirmation and Delete my account; keyboard order. |
| g | iPhone SE with root `font-size: 200%`: no horizontal scroll; every visible control on steps 1–2 and Account options scrolls into the viewport and passes a trial click; the focused password field sits inside the visual viewport and is not covered. |
| h | `dynamic-type.spec.ts`: emulates the native iOS Dynamic Type path (`data-native-ios`, root/body 28, 40 and 53px = AX1, AX3, AX5) and asserts no word on sign-in, Register, onboarding steps 1–4 or Account options renders across two lines, with no horizontal overflow. |

### Known findings and test-design notes

- **axe `target-size` (WCAG 2.2, serious)** on the deletion confirmation
  checkbox, which renders at 12×12 CSS px. Its wrapping label is a 44px-tall
  activation area (asserted in test f), so it meets the repository's 44px
  effective-target rule. The finding is an explicit expected violation: any
  new violation fails, and if this one disappears the test fails so the
  exception is removed.
- **Keyboard order uses Option+Tab.** WebKit follows Safari's default, where
  plain Tab reaches only text fields. Option+Tab is Safari's full keyboard
  navigation.
- **Root font size 200% does not enlarge web text.** ShelfPick's web text
  tokens are pixel-based (onboarding body text stays 14px), so test g proves
  layout and reachability under a doubled root size, not text scaling. Native
  Dynamic Type uses the rem tokens in `native-dynamic-type.css`; see the
  Simulator capture below.
- **Email verification in test e uses the API, not `/verify-email`.** Under
  the Vite dev server, React StrictMode runs the page's confirm effect twice;
  the first call consumes the token and the second shows "invalid, expired or
  already used". Production builds run the effect once. The account is still
  created through the UI, and the token is confirmed through the normal
  `/auth/verification/confirm` endpoint.

## How to run

Prerequisites: Docker running the local Postgres from `docker-compose.yml`
(port 5433), a backend virtualenv, Node dependencies and the WebKit browser.

```bash
docker compose up -d postgres
docker exec boardgamepicker-commercial-postgres createdb -U boardgamepicker shelfpick_dev   # once
cd backend
APP_ENV=development DATABASE_URL=postgresql+psycopg://boardgamepicker:boardgamepicker_dev@localhost:5433/shelfpick_dev \
  JWT_SECRET=local-e2e-only-jwt-secret-not-for-any-real-host .venv/bin/python -m alembic upgrade head
cd ../frontend
npm ci
npx playwright install webkit   # once
npm run test:e2e
```

- The suite uses a dedicated `shelfpick_dev` database by default, so it never
  migrates or changes the day-to-day `boardgamepicker_commercial` database.
  Override with `E2E_DATABASE_URL` (still subject to the script's guards).
- Playwright starts uvicorn on `127.0.0.1:8000` and Vite on `127.0.0.1:5173`
  with explicit environment values, so a developer `backend/.env` cannot
  redirect it. Ports must be free unless `E2E_REUSE_SERVERS=true`.
- If the backend virtualenv is elsewhere (for example in a worktree), set
  `SHELFPICK_BACKEND_PYTHON=/path/to/.venv/bin/python`.
- Global setup runs `python -m scripts.local_test_accounts setup
  --reset-loopback-rate-limits`. That resets the onboarding account to
  verified, onboarding incomplete and no answers (no preferences, profile
  player, players or collection), and clears loopback auth rate-limit buckets
  so repeated runs stay under the 50-logins-per-15-minutes limit. The script
  still refuses anything other than `APP_ENV=development` on an allowed
  loopback PostgreSQL database, and it only changes marked accounts.
- `local_test_accounts verification-token EMAIL` issues a token only for
  `e2e-disposable-*@shelfpick.app` addresses. Disposable accounts from a run
  that fails before deletion stay in `shelfpick_dev`. Drop that database to
  clear them.
- Failures keep traces and screenshots in `frontend/test-results/`, and the
  HTML report is in `frontend/playwright-report/` (both gitignored).

## Simulator smoke capture

`frontend/scripts/sim-smoke.sh` builds the web app (`npm run build`, API
`http://127.0.0.1:8000` by default), runs `npx cap sync ios`, runs a Debug
`xcodebuild` for the chosen Simulator with an ad hoc (`-`) signature, boots it, sets
`content_size accessibility-extra-extra-extra-large`, installs and launches
`com.shelfpick.prototype`, and saves screenshots to
`docs/screenshots/sp-test-01a/`.

```bash
# Run the local API first (same environment as the e2e suite), then:
SIM_DEVICE="iPhone 15" frontend/scripts/sim-smoke.sh   # interactive: prompts for sign-in, captures onboarding, restores text size
frontend/scripts/sim-smoke.sh capture onboarding      # non-interactive follow-up after signing in
frontend/scripts/sim-smoke.sh restore                 # put the previous text size back
```

The ad hoc signature is set only on the xcodebuild command line: no team,
certificate or profile is used and project signing is unchanged. A fully
unsigned build (`CODE_SIGNING_ALLOWED=NO`) cannot use the Keychain, so sign-in
fails with "An OS error occurred (-34018)" after the API accepts the login.

The script never creates, erases or downloads a Simulator or runtime. If
`SIM_DEVICE` is missing, it exits with code 3 (BLOCKED) and lists the existing
devices. Signing in inside the Simulator is a manual (or separately authorised
automation) step. It is **Simulator evidence only**.

### SP-TEST-01A Simulator result (15 November 2026)

`SIMULATOR PASS` on iPhone 17, iOS 27.0 (no iPhone 15 Simulator is installed;
none was created), Xcode 27.2, scheme `App`, Debug, ad hoc signed, content size
`accessibility-extra-extra-extra-large`:

- `docs/screenshots/sp-test-01a/sign-in-ax3xl.png`: sign-in renders and scrolls.
- `docs/screenshots/sp-test-01a/onboarding-ax3xl.png`: after the owner signed in
  as `local-onboarding@shelfpick.app` at normal size, the session persisted
  across a relaunch and onboarding step 1 rendered at AX3XL.
- First captures showed headings and the Log in/Register tabs breaking
  mid-word ("Welco/me", "REGI/STER", "choosi/ng."), caused by
  `overflow-wrap: anywhere` with 1.82rem native h1s. Fixed in
  `native-dynamic-type.css`: native h1 is capped at `min(1.823529rem, 11vw)`,
  auth tab labels at `min(var(--text-support), 11vw)`, and the tabs stack when
  both labels cannot fit. Default text sizes are unchanged. The current
  screenshots show the fixed layout; test h guards it.
- Still observed: the onboarding step-number circles are smaller than their
  digits at AX3XL (not a word break; not changed).
- Automated text entry through the Simulator tool was unreliable in this
  WKWebView (dropped characters, focus jumps), so sign-in was manual.

Log: `docs/test-evidence/sp-test-01a/sim-smoke.txt`.

## Still needs a manual pass on a real device

Automated checks can't show what VoiceOver says or how a person moves through it. On a physical iPhone with VoiceOver:

- **Spoken label quality:** Account options, Back to onboarding, Log out, the
  password field, the "I understand this cannot be undone." checkbox and
  Delete my account each announce a clear name, role and state, including the
  disabled → enabled change of Delete my account.
- **Swipe order:** right/left swipes on onboarding and Account options follow
  the visual order, the hidden onboarding content is not reachable while
  Account options is open, and focus returns to Account options after Back to
  onboarding.
- **Outcome announcements:** Log out and successful deletion land on sign-in
  with an understandable announcement, and error alerts (wrong password) are
  spoken.
- **Real Dynamic Type at accessibility sizes:** sign-in, onboarding and Account
  options on a physical iPhone, confirming the heading and tab word-break fix
  (verified so far in browser emulation and the Simulator only).
- **Keyboard with the on-screen keyboard open:** the deletion password field
  stays visible above the real iOS keyboard. Browser emulation has no
  software keyboard.
