# SP-UI-05: game detail, calmer layout and safer destructive actions

Date: 23 November 2026 · Branch `sp-ui-05` from `main` 71ddd7c · Fast Track. Nothing deployed or submitted. Draft PR for owner
review. Game detail only: no backend, schema, Log play form, tab bar, Tonight or other-tab change.

## Prerequisites and overlap

SP-UI-01 (#36), SP-UI-02 (#37, #38), SP-UI-03 (#60) and SP-UI-04 (#61) are all merged. Reused, not redone: the overflow menu
(`OverflowMenu`) and the one-accent rule (SP-UI-04), the avatar spot (SP-UI-02) and the cover-derived accent logic (SP-UI-01).
**New here:** `.section-label` (the shared small uppercase label; Tonight keeps `.tonight-label` for its font), and `ConfirmSheet`
(the destructive confirmation pattern). The menu's focus handling changed so a sheet opened from an item returns focus to the "…"
button.

## What changed

| # | Result |
| --- | --- |
| 1 Play actions | Per entry: **Rematch** (Forest outline pill, 18px padding) is the main action; **Share play** and **Edit** are quiet text; a "…" menu holds **Send to BG Stats** and **Delete play** (danger colour). Delete play always opens a confirmation sheet; Cancel is focused, Escape and a tap outside cancel. All four actions are on one row at 390 and none is clipped |
| 2 Collapse control | The old "—" was only a missing-duration placeholder, and entries had no fold control. Each entry now has a 44x44 chevron, named "Collapse play on <date>" / "Expand play on <date>", with `aria-expanded` and `aria-controls`; entries start open |
| 3 Mechanics and Categories | Plain secondary text, the first six, "Show all N" (`aria-expanded`) beyond that, "Show fewer" to fold. A literal **"Tags"** entry is hidden in the display layer (`detail-terms.ts`); stored data is unchanged. I could not confirm against live import data that real BGG imports carry "Tags", so this is a display filter only |
| 4 Facts | Flat, left-aligned primary-colour numbers between hairlines: "8.1 / 10", "2.2 / 5", Minutes, and the history tiles. "1 play" singular; a missing or zero average duration is "—", never 0 |
| 5 Remove from collection | Moved into the nav-row "…" menu; the confirmation sheet names the game ("Remove <game>?"). The full-width red button and the red divider are gone |
| 6 Players | Folded into one meta line under the title ("2 players · 30 min"); the Players section is gone |
| 7 Play rows | Winners (and draws) first; a winner is a Forest check plus the word "Won", no outline |
| 8 Headings | "Categories", "Mechanics", "Your history", "Recent plays" use `.section-label` |
| 9 Hero | A 120px capped cover beside the year, title and meta line, all left-aligned; Log a play right under it; Back to shelf, the "…" menu and the avatar share one 44px nav row (centre lines within 3px). Cover tint and the AA-adjusted year colour are kept |

Old detail and history CSS (about 850 lines across `collection.css` and `setup.css`) was deleted, not overridden; the shared
`collection-detail*` classes stay because the Want to Play detail screen still uses them.

## Evidence

Before and after at 390x844, light and dark: `docs/screenshots/sp-ui-05/before/` and `after/` (first screen, history, the play menu, and the
delete and remove sheets).

| Check | Result |
| --- | --- |
| Unit (`npm test`) | **297/297**: 7 new `game-detail` tests (six-term rule, Tags filter, scales, dash, singular, meta line, winners first) |
| ESLint, `tsc -b`, `npm run build`, `check:colors` | pass; 35 raw colours (unchanged) |
| Full Playwright suite (all 21 specs, iPhone 15 and SE projects), three batches | **all pass**: 54 + 95 + 61; one `ui-refresh` selector needed updating for the new markup and then passed (10/10) |
| New `sp-ui-05.spec.ts` (27 tests, light and dark, real local backend, mocked shelf and history) | cover, title, meta line and Log a play above the tab bar; cover at most 130px; Delete play not in the action row, opens the sheet, nothing deleted until confirmed, both sheet buttons tappable above the tab bar; no label clipped, one row, 44pt targets, label padding at least 12px; collapse chevron named, `aria-expanded`, at least 44x44; six chips plus Show all (8) that expands and folds; "8.1 / 10", "2.2 / 5", "—" for a missing and a zero average, "1 play"; Remove needs a named sheet and no red wide element is left; winners first with check and "Won"; no gold token on the page, the tab bar or the avatar; one section-label style; every control named; Dynamic Type AX1, AX3 and AX5 |
| **Simulator** (iPhone 17e, iOS 27.2, Debug build, local API; **Simulator evidence, not a device**) | signed in; Shelf, a game's detail in light, the "…" menu and the remove sheet (cancelled). That game has no plays, so the Recent plays entries are verified in Playwright only. `simulator/` |

## Risks and not verified

- **No physical-device check, no VoiceOver walkthrough.** Recent plays entries, the delete flow and the dark theme were not seen in the Simulator.
- Delete play and Remove from collection run against mocked requests in Playwright; the real delete endpoints are unchanged.
- The ConfirmSheet z-index (200) sits above the tab bar (120); a first version was hidden under it and is covered by a test now.
- The Want to Play detail screen still has its old layout and a red Remove button (out of scope: "game detail screen" is the owned shelf's).
- **Correction to SP-UI-04:** its `choice-group.test.mjs` was not listed in the `npm test` script, so CI never ran its 4 tests and my
  "285/285 including 4 new tests" was really 285 without them. It is in the script now and passes.

## NEXT (owner gate)

1. A physical-phone check of the detail page in light and dark, including a large text size, the "…" menus and both confirmation sheets.
