# SP-UI-02 — Layout polish, compact play logging and data consistency

Branch `codex/sp-ui-02`, worktree `~/Developer/_worktrees/shelfpick/sp-ui-02`, based on `origin/main` 02c503b (SP-UI-01 merged, PR #36). Controlled Track. The owner approved the design checkpoint on 17 Nov 2026, after one round of feedback. The owner also approved the counting rule.

## What changed

### 1. Shared layout
- The tab bar is compact: 62px tall, sitting just above the home indicator instead of padding into it. The bottom space comes from one variable, `--shelfpick-nav-clearance`, which replaces two clearances that were added together.
- One fixed avatar spot. The "keep 56px clear" rule never matched after SP-UI-01 wrapped screens in `.page-transition`. It now covers every tab and the centred Tonight step titles.
- Discover's "Want to Play" link and Tonight's Share button no longer meet the avatar. Share moved to the left, as the owner asked.

### 2. Log play (all entry points)
- Full-screen sheet. The header has Cancel, a small cover with the title, and Save. The tab bar is hidden and the page behind is inert.
- Each player is one flat row: trophy, avatar, name, score and "best N". Players can be removed in Edit mode.
- Recent-player chips appear above an "Add player" field. Players carry over from Tonight and Rematch. A count-only Tonight session says "add N more players".
- Places and winners come from the scores, for highest or lowest wins, and ties share a place. The direction is guessed from earlier plays and can be changed. You can override the winner by hand. Places move behind "Set places manually".
- A summary line (date · place · time) opens the editors. The default location is the last one used, and the Pro live timer sits inside.
- Result type is a menu, and SP-PLAY-01's co-op and team behaviour is unchanged. The footer shows best score at this player count, average and worst winning score.

### 3. Tonight
- A disabled button now says why ("Choose your player count", "Choose how much time you have").
- The selected option has a forest border, and the time tile also gets a check mark.
- The pick cover is smaller, so the title, details and **Log a play** sit above the tab bar.
- "92 match" became **Great fit / Good fit / Worth a look**. The 0–100 scale is explained under More reasons as a comparison, not a prediction.
- Recently played titles clamp to two lines with no mid-word breaks.

### 4. Shelf, Plays, Discover
- Shelf's heading is "Shelf" on every segment. Search is wider, and one 44px button switches layout. Controls are tighter.
- Player counts read "Solo", "2 players" or "2–4 players" everywhere (`player-count.ts`).
- Plays: compact hairline rows, about 11 per screen instead of about 5. The cover opens the game, the row opens Edit, and Rematch is a small text action.
- Discover rows are lighter: a labelled bookmark "Want to Play" button, "Why it's trending" on Hot ("Why this match?" stays on For You), and "BGG ›" and "Not interested" on one quiet line.

### 5. Stats (built by a subagent; I reviewed it and fixed the leftovers)
- "Stats" everywhere, including Settings copy.
- Collection: one sync explanation with "Sync collection ›", and empty Shelf leaders tiles are hidden.
- Play: "All time" label and "Timed on X of Y plays".
- Players: Plays / Wins / Win rate columns, with "Plays each person took part in". "Most played together" ranked each player's top game, so it is now **Favourite game**. Real groups stay under "Who plays together".
- Recaps: compact ‹ › month buttons, and "3 different games, one play each" for single-play months.
- Year in review: segments and counter come from one helper (tested). Buttons have equal heights, the slide is shorter and celebratory, and "Timed on" is hidden at 100%.

### Owner feedback round (checkpoint)
- No underlined links anywhere. Links are Forest and bold, and standalone actions end in ›.
- Dark-mode text is pure white, secondary text is brighter, and text is antialiased.
- Log play has no boxes around the summary line or Competitive.
- More group stats (wins, win %, average, best ever) are **recorded** in `ROADMAP.md` as a separate follow-up.

### 6. Data consistency: findings and fixes

**Counting rule (owner-approved): a play counts once if it is on a game in your account, whatever the game's current ownership or expansion status. A player's count is the plays they took part in, and is labelled as such.**

| Screen | Before | Now |
| --- | --- | --- |
| Plays | 830: plays on games currently on the shelf, minus expansions (the frontend dropped the rest). | Every play. `GET /plays` no longer requires a shelf membership, and each play carries `game {name, cover, is_expansion, on_shelf}`. Off-shelf plays show "Not on shelf" and are read-only, because edits and rematches need the game on the shelf. |
| Stats › Play | 839: every play on the account. | Unchanged; it was already the rule. |
| Stats › Players (Tom) | 821: plays where Tom's player row took part. | Unchanged, now labelled "Plays each person took part in". |

- **830 vs 839:** the 9 plays are on games that left the shelf (BGG sync removed them or you removed them; plays are kept) or are flagged as expansions. Fixed: Plays now shows all 839.
- **839 vs 821:** 18 plays without Tom's player linked. Possible causes: not recorded, a name variant (for example "Thomas"), "Unknown player" from import, or a deleted player. This is different by design and is labelled.
- **A Feast for Odin, 6 vs 5:** the BG Stats importer dedupes only on the play `uuid`, so plays never merge. It skips plays marked ignored, plays with no `playerScores`, plays with no BGG id or date, and plays whose game was not on the shelf when imported. One of these is the likely cause, most likely a play logged without players or against a duplicate or expansion entry.
  - Not changed: importing player-less plays would invent data.
  - To confirm read-only: check that play's `ignored`, `playerScores` and `gameRefId` in your BG Stats export.
- **182 vs 181 (+15 expansions hidden):** the shelf comes from BGG sync plus manual adds, not BG Stats. BGG sync never removes a `manual` membership, so a game added by hand and later sold stays. BGG "own" can also differ from BG Stats' owned flag. This is by design. To fix your account, remove that game from the shelf.
- **Real bug fixed:** game history sorted same-day plays in an arbitrary order (plays are saved at noon). It now orders by date, then newest-logged. This was why `play-logging.spec.ts` failed on `main`.

No schema change. Build number 8 → 9.

## Evidence

| Layer | Result |
| --- | --- |
| Backend (`pytest`) | **436 passed**, 14 skipped (opt-in Postgres suites). New: one rule across `/plays` total, Stats total and a player's count, covering removed games and expansions. New: same-day history order. Run with explicit local env; `backend/.env` was not copied. |
| Frontend unit | **182 pass.** New: `play-log-scoring.test.mjs` (finishing order with ties for highest and lowest wins, auto winner and override, manual places, direction, record context, player-count format, fit bands), feed counting rule, year-recap segments = slides, win rate, Stats copy. |
| Static | ESLint, `tsc -b`, `build` (with `VITE_API_BASE_URL`), `check:pwa`, `build:ios`, `git diff --check` all pass. `check:colors` flags only a pre-existing SP-UI-01 rule. |
| Browser (Playwright WebKit) | Full suite **62 passed, 0 failed**, 50 skipped (second phone project), including Dynamic Type AX. New specs: `ui-polish` (Log play 3 players with all rows and Save on screen, no control overflow, places from scores; Tonight hint; Time-step and pick actions above the tab bar; avatar), `ui-layout` (avatar meets no control on any tab; each tab's last item clears the tab bar; bar ≤ 76px), `ui-stats`. |
| **Simulator (not a physical device)** | Build 9, Debug, ad hoc signed, on iPhone 17 / iOS 27.0, against a **local** backend, signed in as the local test account. Checked: Tonight, Time step, Tonight's pick (action above the bar), Plays rows, and the Log play sheet with 3 players (no tab bar, safe area kept). Found and fixed two issues here: sticky `:hover` borders on name fields after a tap, and the Time-step title touching the avatar at native text size. |

Screenshots:
- **Before:** `docs/screenshots/sp-ui-02/before/` (Tonight), `docs/screenshots/sp-ui-01/after/` (Shelf, Plays, Discover, Stats as of SP-UI-01), `docs/screenshots/sp-play-01/` (old Log play).
- **After:** `docs/screenshots/sp-ui-02/after/` (every tab's end state, Tonight steps, Stats sections, play-logging flows), `checkpoint/`, `simulator/`. Browser covers are synthetic sample art.

## Risks and open points
- **Owner decision:** the Stats table's win rate is wins ÷ plays taken part in. The player profile uses wins ÷ decided plays, so the two can show different numbers.
- Off-shelf plays in the Plays tab are read-only, because the backend refuses edits to games not on the shelf.
- Not tested: real BGG covers, VoiceOver, physical device, the keyboard on a real phone. The Simulator's text entry was unreliable, so scores were entered only in the browser tests.
- **Deploy the backend before the app build:** `GET /plays` changed shape (additive `game`) and scope (all plays).
- The Simulator test left a few local-only "Alex …" test players in the loopback dev database.

## Owner gates (NEXT)
1. Physical-phone check: log a real 3-player game end to end and check counts against BG Stats.
2. Review and merge the draft PR, then deploy the backend, then build 9.
3. Refresh App Store screenshots (Log play, Tonight, Plays and Stats changed).
4. Submit.
