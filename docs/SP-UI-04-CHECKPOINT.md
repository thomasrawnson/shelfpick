# SP-UI-04 checkpoint: shared selected state, Discover and Shelf

Date: 23 November 2026 · Branch `sp-ui-04` (local and pushed, no PR yet) · Controlled Track. Stopped for owner approval before
Stats and Plays. Nothing deployed.

## Base and overlap

- SP-UI-01 (#36) and SP-UI-02 (#37, #38) are merged. **SP-UI-03 (#60) is still an open draft**, so this branch is stacked on
  `sp-ui-03` (f875516), which already holds Tonight's selected state, the neutral avatar spot and the tab bar. Those are not
  redone. Merge #60 first, or this branch carries it.
- Skipped as already delivered: Tonight's selected-state work and 44pt avatar (SP-UI-03), tab bar height and avatar position
  (SP-UI-02). The avatar's neutral fill moved from "Tonight only" to every tab (a one-rule change).

## Built

- **`ChoiceGroup`** (`components/ui/ChoiceGroup.tsx`, `styles/controls.css`) replaces `SegmentedControl` and `FilterTabs`
  (deleted). Variants `segmented` and `chips`, optional `scroll`. Selected = Forest text on Forest-soft with a 2px Forest edge and
  bold weight; unselected = no fill, supporting text. Exposed as `aria-pressed` in a labelled `role="group"`.
  Used by: Shelf (Owned / Want to Play / Ranking; All / Played / Unplayed), Discover (Hot / For You), Stats (section row, now
  scrolling, and the 12 / 24 month toggle), Feedback sheet. Mechanical swaps outside the checkpoint scope: the Stats tab row and
  month toggle (the old component had to go).
- **Discover:** no "Hot now" badge (the For You match strength is plain text in the facts line); one labelled Want to Play
  button per card (44pt, pressed state); "Why it's trending", "View on BGG" and **Hide** (danger colour) sit in a "…" menu
  (`OverflowMenu`: Escape, outside tap, arrow keys, flips up near the tab bar); Hide shows an undo toast (`UndoToast`, 7 s,
  restores the card in place); the header pill is now a text link under the lists; Pro tag is a neutral outline.
- **Shelf:** "9 games" in secondary text with an "Add game" text button on one row; search (border, magnifier, name "Search your
  games"), sort and layout are one 40pt row; grid and list thumbnails are one square cover-fit crop (the grid had been
  `contain`, which also dropped the box tint); play counts are plain secondary text.
- Old CSS for the replaced controls was deleted, not overridden (about 700 lines across 7 stylesheets); `check:colors` is 35
  raw colours (was 40).

## Evidence

Screenshots, 390x844 light and dark, `docs/screenshots/sp-ui-04/`: `before/` (all five tabs), `checkpoint/` (all five tabs,
plus Discover menu and undo). Stats and Plays are unchanged in `checkpoint/` apart from the shared tab row and avatar.

| Check | Result |
| --- | --- |
| Unit | 285/285 (4 new `choice-group` tests; one `pro-comparison` test updated for the new markup) |
| ESLint, `tsc -b`, `npm run build` | pass |
| Playwright `sp-ui-04.spec.ts` (Discover and Shelf, light and dark, 24 tests) + `ui-layout` | 26/26 |
| Existing UI specs (`ui-polish`, `ui-refresh`, `tonight-ui`, `dynamic-type`, `settings-layout`, `ui-stats`, `stats-trends`, `year-recap`, `play-logging`) | 85/85, iPhone 15 |
| Contrast, selected edge vs unselected surface (needs 3:1) | light 6.35 / 6.87; dark 4.93 / 6.52 |
| Contrast, selected text on its fill (needs 4.5) | light 6.28; dark **4.53** (thin) |
| Contrast, unselected text | light 4.75 to 5.15; dark 7.83 to 10.35 |

Not run yet: the full Playwright suite, Dynamic Type AX specs for the new controls, the Simulator, Stats and Plays.

## Decisions for the owner

1. **Selected look.** The brief says "accent fill with dark on-accent text". The repo accent is Forest, which cannot take dark
   text in light mode, so I kept the SP-UI-03 pattern: Forest text on Forest-soft with a 2px Forest edge. A solid Forest fill
   with white text is the alternative; it would compete with the one filled primary button on Tonight.
2. **Shelf filter chips are 36pt tall with a 44pt hit area** (invisible padding). Every Discover target measures 44x44. Say
   if chips should be 44pt visibly.
3. **Tonight's count and complexity buttons** keep their own markup (SP-UI-03) and share only the look. Moving them onto
   `ChoiceGroup` is a small follow-up if you want a literal "one component".
4. **Search row is 40pt** as briefed; the repo guidance is 44pt targets. The layout toggle has a 44pt hit area; the search
   field and sort menu are 40pt tall.
5. Cover-fit crops box art on Shelf; DESIGN.md's "covers stay contained" will be amended to say Shelf thumbnails crop.

## Next, on approval

Stats (duplicate heading, scrolling tab row at AX sizes, flat "Play these" rows, left-aligned tiles, gold numbers), Plays
(compact filter row, four rows visible, "No result logged"), matching header height and baseline on all five tabs, the Dynamic
Type AX spec on five tabs, DESIGN.md and design-system.md, the Simulator smoke test, the full suite, `SP-UI-04-REPORT.md`
and the draft PR.
