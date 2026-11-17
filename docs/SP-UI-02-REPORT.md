# SP-UI-02 — Layout polish, compact play logging and data consistency

Branch `codex/sp-ui-02`, worktree `~/Developer/_worktrees/shelfpick/sp-ui-02`, based on `origin/main` 02c503b (SP-UI-01 merged, PR #36). Controlled Track.

**Status: checkpoint (item 7). Items 2 (Log play) and 3 (Tonight) are built. Items 1, 4, 5 and 6 (fixes) wait for owner approval.**

## Checkpoint: what changed

### Log play (item 2)
- `PlayLogForm` is now a full-screen sheet: Cancel · game title · Save in the header. The tab bar and the page behind it are hidden and inert. Escape cancels. Every entry point uses it: Plays (Log play, Rematch, Edit), game detail, game history Edit, Tonight's pick, Game Night and the live timer.
- There is one compact row per player: winner toggle, avatar, name, score and "best N". Rows are removed through an **Edit** control, not a "Remove" link on every card.
- There are no empty name boxes by default. Recent players show as chips (most recently played first, up to 6), above an "Add player" field. Tonight and Rematch players are prefilled. A count-only Tonight session says "add 3 more players".
- Scores set the finishing order and winners (shared places for ties) for **Highest wins** or **Lowest wins**. Direction is guessed from earlier plays of the game and can be changed in a small menu. Tapping a trophy overrides the winner ("Winner chosen by hand · Use scores"). Places move behind "Set places manually".
- Date, location and duration are on one summary line ("Today · Sheepfold Home · 60 min") that opens the editors. Location defaults to the one used last, and the live timer (Pro) is inside.
- Result type is a menu. SP-PLAY-01 co-op and team behaviour is unchanged.
- The footer shows record context for the game: "Best 3p · Avg · Worst win". Anything without data is hidden.
- The date overflow and the clipped "COMPETITIVE" label no longer exist: those controls were replaced.

### Tonight (item 3)
- A disabled **Find a game** button now explains why ("Choose your player count", "Choose how much time you have").
- A selected player count, complexity or time has a forest border. The selected time tile also has a check mark.
- On Tonight's pick, the cover is about half the old size, so the title, details, **Log a play** and Try another fit above the tab bar.
- "92 match" became **Great fit / Good fit / Worth a look**, shown in the forest-soft colour instead of on gold. "More reasons" explains the 0–100 scale and says it is a comparison, not a prediction.
- Recently played titles clamp to two lines with an ellipsis, with no mid-word breaks.

### Not done yet
- The avatar still crowds the share button on Tonight's pick. That is item 1 and comes next.

## Count investigation (findings so far, from code; no real data checked)

| Screen | Number | Rule (confirmed in code) |
| --- | --- | --- |
| Plays | 830 | Plays whose game is **currently on the shelf and not an expansion**. `PlaysView.loadFeed` drops plays whose game is not in `GET /games` (owned, `is_expansion = false`). The backend `GET /plays` joins `user_games` but not the expansion flag. |
| Stats › Play | 839 | **Every play on the account**: `COUNT(plays) WHERE user_id` (`insights_repository.total_plays`), including removed games and expansions. A test locks this "account history" rule. |
| Stats › Players (Tom) | 821 | **Plays where Tom's `Player` row is a participant** (`get_frequent_players`). |

Likely explanations (hypotheses, need a read-only check of the real account):
- **839 − 830 = 9:** plays on games no longer on the shelf (BGG sync removed a `bgg` membership, or the game was removed by hand; plays are kept) or on games flagged as expansions.
- **839 − 821 = 18:** plays without Tom linked. Possible causes: not recorded, a name variant ("Thomas" is a separate player), "Unknown player" from import, or a deleted player.
- **A Feast for Odin 6 vs 5:** imports dedupe only on the BG Stats play `uuid`, so two plays never merge. The importer skips plays marked ignored, plays with no `playerScores`, plays with no BGG id or date, and plays whose game was not on the shelf at import time. One of these is the likely cause, most likely a play logged without players or against an expansion or duplicate game entry.
- **182 vs 181 (+15 expansions hidden):** the shelf comes from BGG sync plus manual adds, not BG Stats. BGG sync never removes a `manual` membership, so a game added by hand and later sold stays. The other possibility is that BGG "own" differs from BG Stats' owned status.

Proposed rule (after approval): **a play counts once if it is on a game in your account, whatever its current ownership or expansion status.** The Plays tab would show all 839 (with game name and cover from `/plays`). Players stays different by design and gets the label "plays Tom took part in". No schema change is needed.

## Evidence so far

| Layer | Result |
| --- | --- |
| Unit (`npm test`) | 177 pass. New `play-log-scoring.test.mjs`: finishing order with ties for highest and lowest wins, winner auto-select and manual override, manual places, direction inference, record context, player-count formatting, fit bands. |
| Static | ESLint clean, `tsc -b` clean, build passes (with `VITE_API_BASE_URL` set), `check:pwa` passes, `git diff --check` clean. |
| Browser (Playwright WebKit, iPhone 15, 390×844) | Full suite: **58 passed, 0 failed**, 46 skipped (second phone project), including `dynamic-type.spec.ts`. New `e2e/ui-polish.spec.ts`: 3-player Log play with all rows and Save on screen and no control overflow (light and dark); score-focused state; saved places from scores; Tonight hint; Time-step action on screen; pick action and title above the tab bar. `play-logging.spec.ts` (SP-PLAY-01) was rewritten for the sheet and **now passes**. It had failed on `main` because the local e2e database was behind migration `a7c1e9d3b5f2`, which I applied to the loopback `shelfpick_dev` only. |
| Simulator / device | Not run yet. |

Screenshots: before = `docs/screenshots/sp-play-01/` (old Log play form) and `docs/screenshots/sp-ui-02/before/` (Tonight steps and pick), `checkpoint/` (Log play keyboard closed and score focused, Tonight's pick; light and dark) and `after/`. Covers are synthetic sample art.
