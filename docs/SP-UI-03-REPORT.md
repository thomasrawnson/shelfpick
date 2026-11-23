# SP-UI-03: Tonight, less templated and with a clearer hierarchy

Date: 23 November 2026 · Branch `sp-ui-03` from `origin/main` 506de60 · Track: Fast Track. Nothing deployed, submitted or
pushed to main. Draft PR for owner review. Tonight only: no backend, recommendation, copy-logic or other-tab change.

## Prerequisites and overlap

SP-UI-01 (#36) and SP-UI-02 (#37, #38) are merged. SP-UI-02's Tonight work is kept: the 16px rhythm, the compact chip
row, the 56px clearance beside the avatar, links as bold Forest text with a chevron. **None of items 1 to 8 was already
delivered**: SP-UI-02 had removed the old "Choose your player count" hint and tested for its absence (that test now expects
the new hint, in a different place and with the owner's wording); chosen chips had a Forest outline but no check and no group
semantics; "Start a group vote" was an outlined secondary button; the eyebrow, the avatar and the Fine-tune "+" used gold;
"Choose players by name" and Fine-tune were filled boxes; the four labels had four styles; the avatar was 40px.

## What changed

| # | Result |
| --- | --- |
| 1 | "Choose how many are playing" under Find a game while no count is chosen, linked with `aria-describedby`; gone once a count is chosen |
| 2 | Chosen count and complexity: `primary-soft` fill, 2px Forest edge, a drawn check, `aria-pressed`, inside labelled `role="group"`s |
| 3 | One filled button (Find a game). The group vote is a Forest text action with a trailing chevron |
| 4 | No gold on Tonight (eyebrow, avatar, Fine-tune "+"). The avatar takes the neutral `surface-raised` fill on this screen only |
| 5 | "Choose players by name" and Fine-tune are plain rows between hairlines with the same trailing chevron (Fine-tune turns it down when open) |
| 6 | One label style, `.tonight-label`, for Tonight, Who is playing, Complexity and Recently played |
| 7 | Avatar 44x44 (it was 40) with its existing accessible name; Recently played fades its right edge; the count chips reflow to two rows of three, and complexity to two by two then one per row, at accessibility sizes (container queries in em) |
| 8 | Fraunces 600 for the headline, DM Sans for the rest of Tonight, from `--font-tonight-display` and `--font-tonight-body`; self-hosted variable Latin woff2 (36.6 KB and 36.9 KB), `font-display: swap`, system fallback stacks, OFL texts beside the files, `src/assets/fonts/README.md` records source and versions |

Code: the old Tonight rules were spread over `shell.css`, `ui.css`, `commercial.css`, `picker.css` and
`native-dynamic-type.css`, with `!important` fights. They are replaced, not layered over, by `styles/tonight.css`
(+248 / -641 lines in total). The Tonight controls got new class names (`tonight-choice`, `tonight-row`, `tonight-actions`, …),
so nothing shared with another screen was touched. `DESIGN.md` records the one-accent rule, the selected-state pattern and the
two font tokens; `docs/design-system.md` and `ROADMAP.md` are updated.

## Evidence

| Check | Result |
| --- | --- |
| Unit (`npm test`) | **285/285**. Four new markup tests: hint and `aria-describedby`, one primary button and a text-action group vote, check plus `aria-pressed` on exactly the chosen count and complexity, labelled groups and one label class |
| ESLint, `tsc -b`, `npm run build`, `check:pwa`, `build:ios` | pass. `check:colors` reports 40 raw colours, none in the new files |
| Playwright `tonight-ui.spec.ts`, 390x844 light and dark, real local backend (20 tests, run three times) | hint and enabled state; selected markers and pressed state; exactly one `.primary-button`, filled with the brand colour, group vote unfilled, rows unfilled; no gold token on any Tonight element (colour, fill, border, stroke); avatar 44x44, neutral fill, `avatarCollisions` empty; four labels share one computed style; mask on Recently played; Fraunces and DM Sans `loaded`, headline weight 600, only same-origin font files, no Google Fonts request for them, licence files present; AX1, AX3 and AX5 (the repo's native Dynamic Type emulation): count grid is 3 columns by 2 rows, no broken words, no clipped text, headline inside the screen, no avatar collision |
| Contrast (WCAG AA, measured) | light: selected choice 6.28:1, group vote 6.87:1, labels and hint 5.15:1, row text 13.41:1. dark: selected choice **4.53:1**, group vote 6.52:1, labels and hint 10.35:1, row text 17.89:1 |
| Full Playwright suite, all 18 specs, iPhone 15 and SE projects | **136 passed, 0 failed**. Run in three batches with the local sign-in limit cleared before each (the limit is reached partway through a single run; the fix is in PR #59) |
| **Simulator** (iPhone 17, iOS 27.0, Debug build, local API; **Simulator evidence, not a device**) | signed in; Tonight in light, dark and Dynamic Type "accessibility extra large": both fonts render from the app bundle, chips show two rows of three, the headline wraps without clipping. `docs/screenshots/sp-ui-03/simulator/` |
| Before and after | `docs/screenshots/sp-ui-03/before/` and `after/` (empty and selected, light and dark; AX1, AX3, AX5; avatar crops) |

## Notes and risks

- **Existing tests changed because behaviour changed:** `picker-player-mode` and `picker-defaults` unit tests (new markup),
  the SP-UI-02 Tonight e2e (new hint), the Fine-tune alignment e2e (a plain row has no inset, so the body lines up with its
  label), and a class name in `ui-layout.spec.ts`.
- **Fixed so a full run can pass, all failing on `origin/main`:** `analytics-choice.spec.ts` could not be collected (Playwright
  needs an object pattern), the Feedback test asserted 1.1 (11), and two Year in Review tests asserted old slide titles. The
  same edits are in PR #59, so they merge without conflict.
- **Lora and Nunito Sans are still fetched from Google Fonts on every screen**, Tonight included (pre-existing). Only the new
  pair is local. The rollout decision below removes that request.
- The repo's impeccable launcher is not usable here (it ships only a Windows binary and is not executable), so context was read
  from `PRODUCT.md`, `DESIGN.md` and `docs/design-system.md` directly. Its craft floor discourages an eyebrow above a heading;
  the brief names "Tonight" as a label, so it stays.
- Dark-mode selected text is 4.53:1, a thin pass; do not lighten the fill.
- No physical-device check, no VoiceOver walkthrough.

## NEXT (owner gates)

1. Physical-phone check of Tonight in light and dark, including a large text size.
2. Decide whether to roll Fraunces and DM Sans out to the other tabs (repoint `--font-display` and `--font-ui`, delete the
   two Tonight tokens, drop the Google Fonts import and update the colour of nothing else).
