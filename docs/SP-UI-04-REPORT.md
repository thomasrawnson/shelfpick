# SP-UI-04: cross-tab consistency

Date: 23 November 2026 · Branch `sp-ui-04` · Controlled Track, one owner checkpoint (approved after Discover and Shelf).
Nothing deployed, submitted or pushed to main. Draft PR for owner review. No backend, recommendation, Pro or paywall change.

## Base and overlap

- SP-UI-01 (#36) and SP-UI-02 (#37, #38) are merged. **SP-UI-03 (#60) is still an open draft**, so this branch is stacked on
  `sp-ui-03` (f875516). Merge #60 first, or this PR carries it.
- **Skipped as already delivered:** Tonight's selected state, count and complexity check marks, one filled primary and the
  Fraunces / DM Sans work (SP-UI-03); the tab bar height and the avatar's position (SP-UI-02). The avatar's neutral fill was
  Tonight-only; it is now global (one rule). Tonight's count and complexity buttons keep their own markup and share the look.

## What changed

| Brief item | Result |
| --- | --- |
| 1 Shared selected state | `ChoiceGroup` (segmented, chips, optional scroll) replaces `SegmentedControl` and `FilterTabs` (deleted). Used by Shelf (sections, play filter), Discover (Hot / For You), Stats (section row, 12 / 24 months), Plays (date range) and the Feedback sheet. `aria-pressed` in a labelled group |
| 2 Discover | No "Hot now" badge (For You match strength is plain text in the facts line); one 44pt Want to Play button per card; Why it's trending, View on BGG and **Hide** (danger colour) in a "…" menu; Hide shows an undo toast that restores the card in place; the header pill is a text link under the lists |
| 3 One accent | No gold on any tab. Avatar neutral on every tab, Pro tag a neutral outline (Discover, Stats), Shelf play counts plain text, Stats numbers primary text; about 15 gold rules in `insights.css` and `stats.css` moved to neutral or Forest |
| 4 Shelf | "N games" (secondary) and "Add game" text button on one row; search (border, magnifier, name), sort and layout on one 40pt row; one square cover-fit crop in grid and list (the grid had been `contain`) |
| 5 Stats | No "Trends" heading (the panel is a labelled region); the tab row fits five tabs at the default size and scrolls at large text; "Play these to reach N" is flat rows with hairlines and chevrons; stat tiles left-aligned |
| 6 Plays | Game and Player menus on one row (`.select-field`, 40pt), date chips beneath with the count; at least four rows fit above the tab bar (seven in the fixture); every row ends in a result or "No result logged" |
| 7 Headers | The five tab screens share `.tab-screen`: same top, a 56px title row, 1.5rem heading. Title tops and baselines match within 1px on Shelf, Plays, Discover and Stats; Tonight's label starts on the same top line |

Old CSS for the replaced controls was deleted, not overridden (about 700 lines over seven stylesheets).
`check:colors`: 35 raw colours (was 40 on SP-UI-03).

## Evidence

Before and after at 390x844, light and dark, for all five tabs: `docs/screenshots/sp-ui-04/before/` and `after/`
(`checkpoint/` is the owner checkpoint set; `after/` also has the Discover menu and undo toast).

| Check | Result |
| --- | --- |
| Unit (`npm test`) | **286/286** (4 `choice-group`, 1 `playRowMeta`; one `pro-comparison` test updated for the new markup) |
| ESLint, `tsc -b`, `npm run build` (`VITE_API_BASE_URL` set), `check:colors` | pass; 35 raw colours |
| Full Playwright suite (all 20 specs, iPhone 15 and SE projects), run in three batches | **183 passed, 0 failed** (the SE project skips by design) |
| New `sp-ui-04.spec.ts` (iPhone 15, light and dark) | Discover, Shelf, Stats, Plays, headers and Dynamic Type, all passing |
| Shared component, every group on Shelf, Discover, Stats and Plays | exactly one option pressed, group named; no `tablist`, `.segmented-control` or `.filter-tabs` left on those tabs |
| Contrast, selected edge vs the unselected surface (needs 3:1) | light 6.35 to 6.87; dark 4.93 to 6.52 |
| Contrast, selected text on its fill (needs 4.5:1) | light 6.28; dark **4.53** (thin: do not lighten the dark fill) |
| Contrast, unselected text | light 4.75 to 5.15; dark 7.83 to 10.35 |
| Discover targets | every button, link and menu item on the page is at least 44x44 (measured, menu open) |
| Gold | computed text, fill, border and icon colours checked against the four gold tokens on Tonight, Shelf (Owned, Want to Play, Ranking), Plays, Discover and all five Stats sections: none |
| Avatar overlap | no control meets the avatar on any tab or Stats section; avatar is 44x44 |
| Dynamic Type AX1, AX3, AX5 (the repo's native emulation) | all five tabs: no sideways page scroll, headings not clipped, choice labels whole, Shelf count and Add game on one line each, controls inside the screen; at AX5 the Stats tab row scrolls and reaches the last tab |
| **Simulator** (iPhone 17e, iOS 27.2, Debug build, local API; **Simulator evidence, not a device**) | signed in to the local Free account; Tonight, Shelf, Plays, Discover and Stats in dark; Stats in light; Shelf and Stats at the largest accessibility size. `simulator/` |

## Interpretations and deviations (owner approved the first at the checkpoint)

- **Selected look.** The brief says "accent fill with dark on-accent text". The repo accent is Forest, which cannot take dark
  text on a solid fill in light mode, so the SP-UI-03 pattern is used everywhere: Forest text on Forest-soft with a 2px Forest edge.
- **"No result logged"** appears when a play has no winner or result. A missing duration is simply left out of the line, because
  a play with a winner and no timer does have a result.
- **Row heights.** The Shelf search row is 40pt as briefed; the repo guidance is 44pt. The layout toggle has a 44pt hit area;
  search and sort are 40pt tall. Shelf chips and the Plays chips are 36pt tall with a 44pt hit area. Discover's every target is 44pt.
- The "Play these" card keeps its outer card; the boxes inside it are gone. Plays row meta now wraps to two lines (clamped)
  so a winner's name is no longer cut off.
- The Stats section row and 12 / 24 toggle, which the old components also served, were swapped in the checkpoint commit because
  the old component had to go.
- Existing tests changed because behaviour changed: `pro-comparison` (Discover markup), `ui-layout` (Discover card actions),
  `stats-trends` (the Trends region replaces the heading).

## Risks and not verified

- **No physical-device check, no VoiceOver walkthrough.** The Simulator's Discover showed the error state (no BGG token
  locally), so the Discover card list is verified in Playwright with a mocked feed, not in the Simulator.
- Gold remains in places outside the five tabs' main states: the `ResilientGameArtwork` fallback mark (kept as briefed), the
  Year in Review story and share cards, game detail, Settings, onboarding and sign-in (Log in / Register is still its own
  segmented control and uses gold links). The gold check covers the screens and states listed above, not every nested screen.
- Settings and onboarding preference chips, the sign-in tabs and Tonight's count buttons are not yet on `ChoiceGroup`.
- Dark selected text is 4.53:1.
- The Plays and Stats data in the screenshots and tests are mocked requests; sign-in and accounts are real (local).

## NEXT (owner gates)

1. Physical-phone check of all five tabs in light and dark, including a large text size and the Discover menu and undo.
2. Decide whether to roll Fraunces and DM Sans out to Shelf, Plays, Discover and Stats (still Lora and Nunito Sans there).
3. Merge order: #60 (SP-UI-03) first, then this PR; or review this PR as the stack.
4. Follow-ups if wanted: move Tonight's count buttons, the sign-in tabs and the Settings and onboarding chips onto `ChoiceGroup`.
