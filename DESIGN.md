---
name: ShelfPick
description: A calm, collection-led Forest & Gold interface for confident game-night decisions.
colors:
  forest: "#315C48"
  forest-hover: "#284D3C"
  forest-soft: "#E3EBE6"
  gold: "#C28B37"
  gold-hover: "#A9752D"
  gold-soft: "#F4EAD7"
  canvas: "#F6F3EB"
  surface: "#FFFFFF"
  surface-raised: "#EEEAE0"
  ink: "#1E2A24"
  ink-secondary: "#667068"
  line: "#D9D5CB"
  success: "#3F7655"
  warning: "#A66D16"
  danger: "#B7463C"
  info: "#356A7A"
  dark-forest: "#70A889"
  dark-forest-hover: "#86B99C"
  dark-forest-soft: "#26382E"
  dark-gold: "#E3AD55"
  dark-gold-soft: "#403522"
  dark-canvas: "#151816"
  dark-surface: "#202521"
  dark-surface-raised: "#29302B"
  dark-ink: "#FFFFFF"
  dark-ink-secondary: "#B8C1BA"
  dark-line: "#39413B"
  black-canvas: "#000000"
  black-surface: "#0B0E0C"
  black-surface-raised: "#151A17"
  black-ink: "#FFFFFF"
  black-ink-secondary: "#C4CEC6"
  black-line: "#465149"
typography:
  display:
    fontFamily: "Lora, Georgia, 'Times New Roman', serif"
    fontSize: "31px"
    fontWeight: 600
    lineHeight: 1.1
  headline:
    fontFamily: "Lora, Georgia, 'Times New Roman', serif"
    fontSize: "24px"
    fontWeight: 600
    lineHeight: 1.15
  title:
    fontFamily: "Lora, Georgia, 'Times New Roman', serif"
    fontSize: "18px"
    fontWeight: 600
    lineHeight: 1.2
  body:
    fontFamily: "'Nunito Sans', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "'Nunito Sans', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "14px"
    fontWeight: 700
    lineHeight: 1.2
  meta:
    fontFamily: "'Nunito Sans', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "12px"
    fontWeight: 600
    lineHeight: 1.4
rounded:
  sm: "8px"
  md: "12px"
  lg: "16px"
  pill: "999px"
spacing:
  "1": "4px"
  "2": "8px"
  "3": "12px"
  "4": "16px"
  "5": "24px"
  "6": "32px"
components:
  button-primary:
    backgroundColor: "{colors.forest}"
    textColor: "{colors.surface}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "12px 16px"
    height: "46px"
  button-primary-hover:
    backgroundColor: "{colors.forest-hover}"
    textColor: "{colors.surface}"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.forest}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "12px 16px"
    height: "46px"
  input:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "12px 14px"
    height: "44px"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "16px"
  chip-selected:
    backgroundColor: "{colors.forest-soft}"
    textColor: "{colors.forest}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "7px 10px"
  nav-item-active:
    backgroundColor: "{colors.forest-soft}"
    textColor: "{colors.forest}"
    typography: "{typography.label}"
    rounded: "{rounded.lg}"
---

## SP-UI-02 compact logging and sharper type — 17 November 2026

Log play is a full-screen sheet in every entry point: Cancel, a small game cover
with the title, and Save in the header; the tab bar is hidden. One summary row
(date · place · time, opening the editors) and the result-type menu sit on a flat
hairline row with no boxes. Players are flat hairline rows: trophy toggle, avatar,
name, boxed score, "best N". Recent players are chips above an Add player field.
Scores set places and winners (highest or lowest wins, ties shared) with a manual
override; places move behind "Set places manually". A footer shows best score at
this player count, average and worst winning score. This replaces the 28 September
dedicated play-entry screen.

Inspired by BG Stats' scanning density (not its look): dark-mode text is pure
white with a brighter secondary tone, links are never underlined (Forest colour,
a trailing › for standalone actions), and Tonight's pick moves Share to the left
so it never meets the account avatar. Tonight's pick labels fit as Great fit /
Good fit / Worth a look with the 0–100 scale explained under More reasons.

Shared layout: the floating tab bar is 62px and sits just above the home
indicator; `--shelfpick-nav-clearance` is the single bottom inset for scroll
content. The account avatar owns a fixed top-right spot; every screen title row
keeps 56px clear. Plays and Discover use flat hairline rows (small cover, two
lines of text, one quiet trailing action) instead of boxed cards. Stats uses flat
tables with shared column headings.

## Pre-beta play-entry update — 28 September 2026

Picker play logging uses a dedicated narrow task screen rather than expanding
inside the recommendation card. It keeps the selected game's contained artwork,
title and participant summary ahead of the existing play fields, with one
Forest Save action and quiet Back/Cancel actions. Named Picker participants are
prefilled; count-only sessions retain separate blank participant rows. The
screen uses the established input, card, spacing, focus and bottom-navigation
clearance rules in both themes and at the existing responsive widths.

Beta testing remains on hold. `docs/pre-beta-work-plan-2026-09-28.md` defines
the remaining requested work; existing tokens below remain the implemented
baseline until a later scoped task changes them.

## Settings navigation update — 28 September 2026

Settings uses a grouped overview as its stable entry point. Profile,
Preferences, Appearance, Collection & Data, Plays, Pro, Help and About are
full-width rows that open focused routes; Back returns to the overview and
restores focus to the originating row. Subpages use the standard narrow shelf,
existing form/card primitives and one clear heading. Collection & Data keeps
BGG sync and BG Stats import together without unrelated account controls and
retains BoardGameGeek attribution. This structure does not add a primary-nav
destination or change Free/Pro access. About retains the same focused-panel and
secondary-action treatment for its labelled Pluto Night Labs website link; the
external action announces that it opens a new tab to assistive technology.

## Preset avatar update — 28 September 2026

Settings → Profile and onboarding use one shared three-column avatar selector.
Each choice is a native radio with a visible descriptive label, selected border
and check, keeping browser keyboard behavior and the product focus ring. Forest,
Gold and Clay retain their existing IDs and treatments. Dice teal, Meeple rust
and Card blue add restrained board-game motifs using the existing semantic
palette; initials remain the foreground identity at compact sizes in navigation
and named-player selection. The catalogue is available wherever the shared
picker or `PlayerAvatar` renderer is used. This bounded update adds no image
hosting, upload controls, navigation or entitlement gate. Preset-avatar work is
complete; photo upload is retained as post-beta work and is not a beta blocker.

## Collection Add game update — 28 September 2026

Owned Collection keeps Add game visible as a labelled Forest action when games
are present or filters have no matches. The genuinely empty shelf uses the same
action as its primary next step and offers BGG import through Collection & Data.
Manual addition remains an inline, focused BoardGameGeek search panel: opening
moves focus to its labelled query, Close returns focus to the trigger, and
success, no-result and failure states remain visible without discarding the
query. Collection filters, sorting and navigation state remain outside and
unchanged by the add task.

SP-PB09B keeps that panel and route structure. Each result presents explicit,
independent **Add to Owned** and **Add to Want to Play** actions. Existing
membership is stated as **Already Owned** and/or **Already Want to Play** rather
than inferred from colour or iconography. While one mutation is pending, both
destinations are disabled to prevent duplicate or competing submissions; the
query and full result list remain visible for success, failure and retry. On
phone widths the two 44px actions stack, while wider layouts keep a compact
wrapping action group.

## Heading and supporting-copy update — 28 September 2026

Primary Picker, Collection, Discover, Rankings, Insights, Game Night and
Settings states use one page-level heading. Category eyebrows and subtitles are
omitted when they only rename or restate that heading. Supporting copy sits
immediately beneath the heading only when it explains scope, input consequences
or the next decision. Personalisation/fallback context, units, recovery,
validation, entitlement limitations, BGG attribution and accessible names are
functional copy and must not be removed for visual minimalism. Loading and
error states retain the same stable page heading as their completed screen.

## Overview

**Creative North Star: "The Considered Game Shelf"**

ShelfPick should feel like opening a well-kept personal game shelf: warm, calm, tactile and easy to scan. The interface helps hobbyists make a confident choice, so game artwork and recommendation reasoning lead while the brand supplies structure and recognition.

Forest Green carries action, selection and trust. Warm Gold marks moments of emphasis, collection character and small editorial details. Cream canvas, paper-like surfaces and restrained depth keep the product inviting in light mode; the dark theme translates the same relationships into charcoal-green layers rather than becoming a separate visual identity. The optional **Black (experimental)** theme keeps that Forest & Gold identity on a true-black canvas with near-black semantic surfaces, brighter text and explicit borders. It is available to Free and Pro while tested.

**Key Characteristics:**

- Collection-led, with game artwork as the strongest visual content.
- Calm and practical, with a warm tabletop character rather than a dense dashboard feel.
- Explainable, with concise hierarchy that makes recommendations and their reasons easy to trust.
- Consistent across light and dark themes, mobile-first flows and wider app surfaces.

The pre-beta visual principle is **“warm shelf, confident choices.”** Delivery
is sequenced as UI-1 confirmed defect repair, UI-2 core visual polish, and UI-3
full-width, content-forward desktop redesign. UI-1 must make external artwork
failure safe, keep fixed navigation clear of content, restore dark inactive-state
contrast, improve Collection scanability, correct misleading sparse states, and
remove only the legacy overrides responsible for drift. UI-2 then refines core
hierarchy, type, spacing, component consistency and responsive behaviour. UI-3
is the later desktop structural redesign; do not introduce its card/grid model
piecemeal during UI-1.

Game Night remains a distinct primary-navigation destination and must not be
merged into Picker. Visual work preserves recommendation rules, exact-player
logic, the BoardGameGeek Not Recommended >=30% exclusion, routes, deep links,
browser Back behaviour, collection state and scroll restoration. Logo work and
the Free/Pro proposition are separate pre-beta priorities.

### Game Night phone voting — 28 September 2026

Update (SP-UNLOCK-01, 17 November 2026): phone voting is free for every account. After a guest votes, and on the closed-results view, a plain "Get ShelfPick" App Store link appears (hidden inside the native app). Exported cards show the unmodified Powered by BGG logo with boardgamegeek.com beneath.

The host explicitly opens voting from an existing shortlist. The host screen
centres an accessible QR code, provides the same URL in a copyable field and
shows joined/submitted progress without revealing live tallies. The mobile
guest surface is a narrow public session view with ShelfPick branding, a
bounded display-name join step, large single-choice ballot rows, explicit
abstention and accurate saved/error states. It never exposes the host's wider
collection, account or play history.

After closure, host and guests see the same winner, tie or no-vote facts. The
host retains the established **Choose this game** confirmation before reveal
and play logging. Copy explains that a session-scoped browser identity restores
one ballot but cannot guarantee one real person across multiple browsers or
devices. Invalid and expired links explain that the session is unavailable;
closed links show final results.

## SP-UI-05 Game detail: calmer layout, safer destructive actions — 23 November 2026

- **First screen.** Back to shelf, a "…" menu and the avatar share one 44px nav row (one centre line). Under it: a capped
  120px cover beside the year, the title and one meta line ("2 players · 30 min"; there is no separate Players section), then
  Log a play, then flat facts. Everything is left-aligned. The cover keeps its cover-derived tint (`use-cover-accent`) and the
  year takes the AA-adjusted cover accent; nothing else on the page is tinted and there is no gold.
- **Flat facts.** Rating "8.1 / 10", Weight "2.2 / 5", Minutes and the history tiles are left-aligned primary-colour numbers
  between hairlines, not boxes. A missing or zero duration is "—", never 0; one play reads "1 play".
- **Mechanics and Categories** are plain secondary text, the first six, with "Show all N" (`aria-expanded`) beyond that. A literal
  "Tags" entry from a BoardGameGeek import is hidden in the display layer only (`detail-terms.ts`); stored data is unchanged.
- **Destructive-action pattern: overflow menu plus confirmation sheet.** A destructive action is never a visible button. It lives
  in a "…" menu (`OverflowMenu`, danger colour) and always opens a confirmation sheet (`ConfirmSheet`, `role="alertdialog"`):
  a title and one sentence that name what will go, Cancel first (and focused), and a danger-coloured confirm button. Escape and
  a tap outside cancel; the page behind is inert; focus returns to the "…" button. Used by **Delete play** (in each Recent plays
  entry) and **Remove from collection** (in the nav-row menu). Discover's **Hide** uses the same menu with an undo toast instead of
  a sheet, because it is reversible.
- **Recent plays.** Each entry has the date and facts with a 44pt chevron (`aria-expanded`, named "Collapse play on <date>")
  that folds the entry. Players list winners first; a winner is marked by a Forest check and the word "Won", with no outline.
  Rematch is the main action (a Forest outline pill with room around its label), Share play and Edit are quiet text, and
  "Send to BG Stats" and Delete play sit in the "…" menu.
- **Section labels** ("Categories", "Mechanics", "Your history", "Recent plays") use `.section-label` (small, uppercase, tracked,
  secondary), the same spec as Tonight's `.tonight-label`.

## SP-UI-04 Cross-tab consistency — 23 November 2026

Every tab now uses one selected state and one accent. This section is the reference; where it disagrees with an older
section below (for example "Filter tabs use a Forest label and short underline" or gold as a metadata colour), this wins.

- **One accent colour.** Forest is the only interactive accent on all five tabs (Tonight, Shelf, Plays, Discover, Stats) and
  in the tab bar and avatar. Gold is not used for text, numbers, fills, borders or badges there: the account avatar takes a
  neutral `surface-raised` fill on every tab; the Pro tag is a quiet neutral outline; Shelf play counts and Stats numbers are
  plain secondary and primary text. (The Year in Review story, the paywall and Pro screens keep their own treatment.)
- **One selected-state pattern, one component.** `ChoiceGroup` (`components/ui/ChoiceGroup.tsx`, `styles/controls.css`) is
  the only segmented control and chip row: variants `segmented` (a track of equal options) and `chips`, with an optional
  `scroll` for a long row. Selected = Forest text on a Forest-soft fill with a 2px Forest edge and bold weight; unselected =
  no fill and supporting text. The state is exposed as `aria-pressed` inside a labelled `role="group"`, so it is never
  colour alone. Measured contrast (WCAG): the selected edge against the unselected surface is at least 3:1 (4.9 to 6.9) and
  the selected text on its fill at least 4.5:1 (6.28 light, 4.53 dark; do not lighten the dark fill). A standalone toggle
  (Discover's Want to Play) is `.choice.pill`, the same look.
  Used by: Shelf (Owned / Want to Play / Ranking; All / Played / Unplayed), Discover (Hot / For You), Stats (the section row,
  which scrolls sideways at large text, and the 12 / 24 month toggle), Plays (date range) and the Feedback sheet. Tonight's
  count and complexity buttons (SP-UI-03) share the look and add a check; they are not yet on the component.
- **Calm lists.** Discover cards: cover, title, facts, one labelled Want to Play button (44pt), and a "…" overflow menu
  (`OverflowMenu`) that holds Why it's trending, View on BGG and Hide. Hide is the danger colour and shows an undo toast
  (`UndoToast`). There is no "Hot now" badge; the header pill is a text link under the lists. Stats "Play these to reach N" is
  flat rows between hairlines with a chevron, not boxes inside a card; stat tiles are left-aligned. A tab's title is never
  repeated by a heading under the tab row.
- **Shelf.** The count ("182 games", secondary text) and an "Add game" text button share one row; search (border, magnifier,
  name), sort and layout are one 40pt row (`.select-field` is the shared compact menu, also used for the Plays filters);
  thumbnails are one square cover-fit crop with the `ResilientGameArtwork` fallback. This supersedes "covers stay contained"
  for Shelf thumbnails only; game detail, Discover and shared cards still contain the box art.
- **Plays.** Game and Player menus share one row, date chips sit beneath, and every row ends with its result (a winner, a
  co-op result or "No result logged").
- **One title row.** The five tab screens (`.tab-screen`) share the same top, a 56px title row that centres the 1.5rem heading
  on the avatar (a 44pt target at a fixed top-right spot), so the title baseline does not move between tabs. Tonight's small
  label sits on the same top line.
- **Targets.** 44pt effective targets everywhere; the Shelf search row is 40pt as specified, with a 44pt hit area on the layout
  toggle, and the Shelf filter chips are 36pt with a 44pt hit area.

## SP-UI-03 Tonight: less templated, clearer hierarchy — 23 November 2026

Tonight (`PlayerStep`, class `tonight-screen`, rules in `styles/tonight.css`, loaded last) is the first screen on the
new pattern. The rules below apply to it now and are the reference when other screens adopt them.

- **One accent.** Forest is the only interactive accent on Tonight. Gold is not used for the eyebrow, the avatar or the
  Fine-tune control, and the account avatar takes a neutral fill (`surface-raised`) on this screen only.
- **Selected-state pattern.** A chosen option is never colour-only: `primary-soft` fill, a 2px Forest edge, Forest text
  and a drawn check in the top-right corner (`.tonight-choice.selected` plus `.tonight-check`), with `aria-pressed`
  on the button and the options inside a labelled `role="group"`. The player count and complexity use the same control.
- **One primary action.** "Find a game" is the only filled button. "Start a group vote" is a quiet Forest text action
  with a trailing chevron. When Find a game is off, "Choose how many are playing" sits under it and is linked with
  `aria-describedby`; it goes once a count is chosen.
- **Fewer boxes.** Only tappable options (choices, the primary button) keep a fill. "Choose players by name" and
  Fine-tune are plain list rows between hairlines with the same trailing chevron (Fine-tune turns it down when open).
- **One section label.** `.tonight-label`: 0.75rem, weight 700, 0.08em tracking, uppercase, `--color-text-support`. It is
  used for Tonight, Who is playing, Complexity and Recently played.
- **Dynamic Type.** Sizes are rem and em. The choice grids reflow by container width in em: six across, then two rows of
  three (and complexity two by two, then one per row) at the accessibility sizes. The avatar is a 44pt target.
- **Recently played** fades its right edge (a mask), so a cut-off title reads as "more", not as a fault.
- **Typefaces (Tonight only).** `--font-tonight-display` is Fraunces (weight 600, the headline "What should we play?") and
  `--font-tonight-body` is DM Sans (everything else on the screen). Both are variable Latin woff2 files in
  `src/assets/fonts/`, bundled and precached, `font-display: swap`, with a system-font fallback stack, and no request
  goes to a font host for them. The SIL OFL licence texts sit beside the files. The rest of the app still uses Lora and
  Nunito Sans (loaded from Google Fonts); rolling the pair out repoints `--font-display` and `--font-ui` at these values
  and removes the two Tonight tokens, and is an owner decision.

## Five-tab shell — SP-UI-01 (17 November 2026)

Tabs are **Tonight · Shelf · Plays · Discover · Stats** (single words, one row).
Tonight is the Picker with group size, complexity and Fine-tune, a text action
"Start a group vote" (old Game Night, `?mode=vote`) and a quiet Recently played
cover row. Shelf is the Collection (Owned, Want to Play, Ranking) with a grid
(default) / list toggle, covers fitted without cropping and a two-line title.
Plays lists recent plays across games with game, player and date filters, a
prominent Log play, Rematch and Edit. Stats is the renamed Insights. Old URLs
redirect (`legacyRedirect` in `routes.ts`); guest voting links never change.

- Header: the avatar sits in the title row at the page padding; screen titles are 1.5rem.
- Spacing: Tonight uses one 16px rhythm between control groups; rows are full-width and tappable.
- Cover accent: game detail and the pick result tint from the cover (`cover-accent.ts`);
  accent text is adjusted to WCAG AA on every light and dark surface, with a palette fallback
  when the cover cannot be read (CORS).
- Motion: tab transition, pick reveal and skeleton shimmer all switch off under reduced motion.
  Pull-to-refresh on Shelf, Plays and Discover; light haptic on tab change.

## Colors

**The Forest Means Action Rule.** Use Forest Green for primary actions, selected controls, active navigation, focus rings and interactive affordances that move the user forward.

**The Gold Earns Attention Rule.** Warm Gold is brand colour for the logo, artwork and share cards. It is not an interface colour: none of the five tabs uses it (see SP-UI-03 and SP-UI-04), and it is never a button, link or selected state.

**The Semantic Color Rule.** Success, warning, danger and info retain their functional hues and labels. Never substitute Forest or Gold where the user needs to understand status or risk.

Use `canvas` for the page environment, `surface` for the main app plane and `surface-raised` for controls, nested cards and quiet groupings. In dark mode use the corresponding `dark-*` tokens and preserve the same ordering from background to surface to raised surface. Black uses the isolated `black-*` equivalents with `#000000` canvas, `#0B0E0C` surface and `#151A17` raised surface; do not replace these with component-level hardcoded colours. Supporting text uses the production `--color-text-support` mix so it stays readable on raised surfaces in every implemented theme.

Potential future cosmetic Pro themes are product proposals, not implemented or
marketed capabilities:

- **Gaming Table:** walnut, cream and brass.
- **Anime Arcade:** midnight violet, coral and cyan.
- **Quiet Garden:** sage, mist blue and soft neutrals.

Any later decision to build or gate these requires its own contrast, persistence
and entitlement review. It does not change Black's current Free-and-Pro access.

## Typography

**The Two-Voice Type Rule.** (Tonight alone uses Fraunces and DM Sans through `--font-tonight-display` and `--font-tonight-body`; see SP-UI-03.) Lora provides a considered editorial voice for page headings, section titles, game names and meaningful numeric highlights; Nunito Sans carries controls, body copy, metadata and navigation.

Keep the scale compact. The default page heading is 31px, screen headings commonly settle between 24px and 28px, and card titles sit near 18px. Body text is 16px; supporting text is 14px; metadata is 12px; overlines are 11px with generous tracking. Use weight and spacing before introducing a new size. Keep long titles to readable line lengths and allow wrapping instead of shrinking them into illegibility.

## Layout

**The Bounded Shelf Rule.** Core flows are mobile-first and fill the viewport at 480px and below. On larger screens the standard app container remains a focused 390px shelf; data-rich collection, detail, rankings and insight surfaces may expand to the established 1040px wide shell at 700px and above.

Use the 4px spacing scale, with 12px to 16px inside controls and cards, 24px between major sections and 32px around screen-level pauses. Preserve a minimum 44px interactive target. The fixed five-item navigation sits above safe-area insets, and scrolling content keeps enough bottom space to remain reachable above it. At narrow widths, grids collapse or tighten at the existing 480px, 420px, 380px and 360px breakpoints; do not introduce horizontal page scrolling.

Game cover art should remain contained, correctly proportioned and visually dominant. Text columns use `min-width: 0`, wrapping or ellipsis where established so long game names cannot force layouts wider than the viewport.

## Elevation & Depth

**The Quiet Layering Rule.** Establish hierarchy with warm tonal steps and borders first, then use the shared card shadow for true floating surfaces such as the app shell, bottom navigation, dialogs and prominent recommendation cards.

The base shadow is `0 4px 16px var(--color-shadow)`, with 10% black in light mode and 24% black in dark mode. Stronger shadows such as `0 18px 38px var(--color-shadow)` are reserved for dialogs or overlays. Avoid stacking shadows on every card. The app-shell texture uses a soft Gold glow and a nearly imperceptible raised-surface grain; it should read as atmosphere rather than decoration.

Motion is brief and explanatory: 120ms press transforms, 140–160ms color and state changes, and a 350ms screen entrance with an 8px rise. Honor `prefers-reduced-motion` by effectively disabling animations and transitions.

## Shapes

**The Soft Geometry Rule.** Use 8px for compact controls, 12px for standard fields and buttons, and 16px for cards. Larger app shells and floating navigation may use 24px to 28px radii. Use full pills only for chips, tags, compact status controls and small external actions; content cards remain softly rectangular.

Borders are one pixel and use the semantic line token. Circular shapes belong to icon buttons, avatars, radio-like indicators and small decorative game-night elements. Avoid mixing sharp corners into established flows unless the element is a deliberate edge-to-edge list row.

## Components

**The One Primary Action Rule.** A view or decision step should have one visually dominant Forest button. Secondary actions use a Forest outline; quiet or reversible actions use transparent ghost treatment. Disabled actions use raised-surface fill and supporting text rather than reduced-opacity Forest.

Inputs and search fields sit on `surface-raised`, use primary text and readable supporting placeholders, and switch their border to the active semantic color on focus. Error and retry states use danger text, border and a danger-soft surface; success states use the equivalent success tokens.

Cards use tonal separation and a border before elevation. Recommendation cards give the cover, game title and fit explanation the clearest hierarchy. Compact badges and chips may use Forest-soft for selection or a neutral outline for a quiet tag, with text colors chosen for contrast.

Segmented controls and chip rows are one component (`ChoiceGroup`; see SP-UI-04): the selected option is Forest on Forest-soft with a 2px Forest edge. The bottom navigation currently uses five equal targets with 24px icons, short labels and a Forest-soft active tile, including the usable host-led Game Night flow. Dialogs use the surface color, the established 16px–18px radius range, a clear close action and the stronger overlay shadow.

### Picker participant modes — 28 September 2026

Picker participant selection has two mutually exclusive presentations. With
named players selected, show their derived count and names as a read-only
summary with an Edit players action; do not show the numeric count grid beside
it. Provide a quiet, explicit Use group size instead action for changing modes.
When no named players are selected, retain the existing numeric control so an
anonymous or count-only group can continue. Recommendation criteria and play
entry must consume the same active-mode count.

### Saved Picker defaults — 28 September 2026

Settings → Preferences presents usual player count, preferred play style and
usual play time as three related default groups with one Save action and clear
saving, success and failure feedback. The page explains once that defaults seed
a new Picker session while each session remains editable. No preference is the
neutral play-style choice; missing legacy data resolves to the same state.

A fresh Picker snapshots the latest saved defaults. Count applies only to
count-only mode, because named players remain authoritative. Forward/Back,
rerenders and dedicated play entry preserve explicit session choices. Start over
begins a new session and reapplies the latest defaults. Saving Settings affects
the next fresh session and never silently rewrites an active Picker session.

### Picker personal-ranking explanation — 28 September 2026

When a Pro count-based Picker result's final score is changed by the account
owner's personal ShelfPick ranking, the result may state **Higher in your
personal rankings** or **Lower in your personal rankings**. Do not show this
copy for neutral, missing, sparse or tied data, or when score clamping removes
the effect. Named-player sessions omit the owner-only ranking signal entirely;
never present it as a shared preference or imply rankings for other players.

### Live play details and active-timer indicator

The shared play form accepts an optional Free-form location label and keeps
manual duration entry available to every account. Recent play history shows a
saved location when present; older and imported plays without one remain valid.

SP-PB11 keeps an active Pro timer visible while the user navigates within
ShelfPick. The compact in-app indicator shows the game name, elapsed time and an
explicit running or paused label, with a keyboard- and screen-reader-accessible
action to reopen the full timer controls. It reads from the authoritative timer
session and never runs an independent display clock. Place it in the
authenticated app shell where it remains clear of bottom navigation, safe-area
insets and each screen's primary actions on mobile and desktop.

Elapsed display is derived from persisted timestamps and pause intervals after
backgrounding, suspension or reload. Responsive and recovery review must cover
long game names, running/paused states, keyboard focus, accessible names,
navigation clearance and horizontal overflow. Outside-app lock-screen, Live
Activity or ongoing-notification support is a separate future platform task,
not part of this component.

Only one timer may exist per account. Finish freezes its duration and opens the
existing play form for review; it never records a play automatically. Failed
saves retain the draft and finished timer, while success removes timer state in
the same transaction as the one play record. Discard is explicit and confirmed.

If Pro access changes while a timer is retained, ShelfPick replaces the normal
indicator and timer controls with an account-scoped recovery state. A running or
paused timer is neither finished nor discarded: the screen explains that its
data is safe, offers the ordinary Free play form with the available draft and
duration, and states that a manual save does not alter the retained timer. A
finished timer opens that same form with its timer session ID so the existing
atomic, idempotent save removes the timer only after one play is safely stored.
Restoring Pro restores the authoritative timer controls. The recovery read is
authenticated and user-scoped; Start, Pause, Resume, Finish, Discard and the
normal timer read remain Pro-enforced.

### Branded saved-play sharing

SP-PB12 adds Share play only to persisted Collection history. The preview is a
modal layer over the unchanged game-detail screen; Close and Escape return
focus to the originating play action. Its portrait image uses the approved
ShelfPick logo, cream canvas, Forest structure and restrained Gold emphasis.
Game artwork leads when safely available, while a calm initials panel handles
missing images and CORS failures without blocking export. Long titles and names
wrap or truncate within the card rather than reducing text below readable sizes.

Title and play date are always included. Positive duration and recorded result
flags may add context, but missing scores are never displayed as zero and the
card never infers a winner; cooperative wins and scored ties use existing game
mechanics, winner flags and non-missing scores. Player names, scores and location are independent
preview controls; names, scores and location begin hidden, and email-like
participant labels are always redacted. The preview and output use the same
renderer. Native file sharing and PNG download require explicit actions, and
the interface never claims that ShelfPick posted or uploaded the result.

SP-PB12B refines that same renderer as a cover-led editorial poster. The full
cover is contained inside a quiet Forest-soft stage without cropping; portrait,
landscape and square sources retain their aspect ratio. Detail-rich variants
use a slightly shorter stage so title, facts, outcome, participants and the
restrained footer always retain separate safe zones. Missing or blocked artwork
uses the same stage with an intentional initials tile. Email-like text is
redacted from opted-in location as well as participant labels before preview or
PNG generation. The footer retains the approved ShelfPick wordmark, quiet
sign-off and BoardGameGeek data attribution without competing with the cover.

SP-PB13 extends the same sharing language inside Insights → Recaps. Current and
previous local calendar months use compact labelled navigation; loading, retry,
empty and populated states retain the selected month. Empty months explain that
only saved plays count and cannot be shared. Populated months lead with factual
play/game totals, recorded-duration coverage and a single explicit Share this
month action. The 1200x1500 recap is an editorial collage rather than a generic
dashboard: a tight collage of one to four tiles leads. Tiles touch with no
gutters and only the collage's outer corners are rounded. Box art is never
cropped or covered: the whole cover is contained above a reserved label strip,
over a blurred, darkened copy of itself so the tile stays edge to edge. Each
tile's strip carries the game name and that month's play count; a failed cover
or an export with covers off fills the tile with a solid branded colour and
initials, with the same strip. A bordered stat band follows with plays, games,
nullable recorded time and the deterministic most-played/variety line, then the
established ShelfPick/BGG footer. Share dialogs use one compact header row (title and a small Close) with
no subtitle, and their Share and Download buttons are one compact size, side by
side.

Stats > Recaps leads with "This month in games" and a compact centred month
switcher (44px targets, next disabled at the current month), then the year
recap below. Each recap is a compact preview card: the real share card scaled
down beside a short summary and a Share action, so what you see is what you
share. The year card shows hero numbers (plays, games, recorded hours), the top
game and busiest month, using only fields the year-recap response already has. Player names, scores and location
never enter the monthly response, preview or image.

SP-BETA-08 keeps these cover-led compositions while making exported artwork a
server-owned release policy. On 2026-11-19 the owner decided covers are shown
by default (`EXPORT_COVER_ARTWORK_ENABLED` defaults to `true`); the server flag
remains a kill switch; BGG's image host has no CORS headers, so exported covers are relayed through the authenticated `/export-cover` API proxy. Unless the API explicitly permits cover artwork,
every preview and its matching PNG/native-share file uses the established
branded initials tile; configuration errors also fall back safely. This export
rule does not alter ordinary in-app covers. Users are not offered an artwork
override, and the ShelfPick wordmark plus BoardGameGeek data attribution remain
in both modes.

SP-PB14A keeps collection usage and lifetime play history visibly distinct.
**Owned games played** belongs to current-shelf coverage; **Games in history**,
most played and last played cover every saved account play even when a title is
no longer Owned. Recorded time shows an unavailable state when absent, retains
a genuine recorded zero, and states partial timed-play coverage. Player
frequency is **Most played together**, never “favourite.” Player profiles show
win, loss, draw and unrecorded outcome counts; win rate names its decided-play
denominator and uses an unavailable state when no outcome is determinable.

## Do's and Don'ts

### Do:

- **Do** let game covers, titles and recommendation reasoning carry the strongest hierarchy.
- **Do** use semantic tokens and existing shared primitives before adding screen-specific values.
- **Do** preserve clear surface separation, readable supporting text and visible borders in both themes.
- **Do** keep actions concise, deterministic and explicit about what happens next.
- **Do** verify new work at mobile width, wider desktop width, and in light and dark mode.

### Don't:

- **Don't** use Warm Gold as an interface colour (buttons, links, selected states, numbers or badges).
- **Don't** add ornamental gradients, shadows or glass effects to ordinary cards and controls.
- **Don't** let branding compete with cover artwork or recommendation content.
- **Don't** communicate success, warning, danger or info through brand color alone.
- **Don't** invent new radii, spacing increments or typography roles when an established token fits.
