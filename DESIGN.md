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
  dark-ink: "#F4F1E8"
  dark-ink-secondary: "#AAB4AD"
  dark-line: "#39413B"
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
destination or change Free/Pro access.

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

Forest Green carries action, selection and trust. Warm Gold marks moments of emphasis, collection character and small editorial details. Cream canvas, paper-like surfaces and restrained depth keep the product inviting in light mode; the dark theme translates the same relationships into charcoal-green layers rather than becoming a separate visual identity.

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

## Colors

**The Forest Means Action Rule.** Use Forest Green for primary actions, selected controls, active navigation, focus rings and interactive affordances that move the user forward.

**The Gold Earns Attention Rule.** Reserve Warm Gold for restrained emphasis such as eyebrows, rankings, selected metadata and occasional supporting links; it is not the default action color.

**The Semantic Color Rule.** Success, warning, danger and info retain their functional hues and labels. Never substitute Forest or Gold where the user needs to understand status or risk.

Use `canvas` for the page environment, `surface` for the main app plane and `surface-raised` for controls, nested cards and quiet groupings. In dark mode use the corresponding `dark-*` tokens and preserve the same ordering from background to surface to raised surface. Supporting text uses the production `--color-text-support` mix so it stays readable on raised surfaces in both themes.

## Typography

**The Two-Voice Type Rule.** Lora provides a considered editorial voice for page headings, section titles, game names and meaningful numeric highlights; Nunito Sans carries controls, body copy, metadata and navigation.

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

Cards use tonal separation and a border before elevation. Recommendation cards give the cover, game title and fit explanation the clearest hierarchy. Compact badges and chips may use Forest-soft for selection or Gold-soft for earned emphasis, with text colors chosen for contrast.

Filter tabs use a Forest label and short underline for the active state. Segmented controls place the selected option on Forest-soft. The bottom navigation currently uses five equal targets with 24px icons, short labels and a Forest-soft active tile, including the usable host-led Game Night flow. Dialogs use the surface color, the established 16px–18px radius range, a clear close action and the stronger overlay shadow.

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

## Do's and Don'ts

### Do:

- **Do** let game covers, titles and recommendation reasoning carry the strongest hierarchy.
- **Do** use semantic tokens and existing shared primitives before adding screen-specific values.
- **Do** preserve clear surface separation, readable supporting text and visible borders in both themes.
- **Do** keep actions concise, deterministic and explicit about what happens next.
- **Do** verify new work at mobile width, wider desktop width, and in light and dark mode.

### Don't:

- **Don't** turn Warm Gold into a general-purpose button or selected-state color.
- **Don't** add ornamental gradients, shadows or glass effects to ordinary cards and controls.
- **Don't** let branding compete with cover artwork or recommendation content.
- **Don't** communicate success, warning, danger or info through brand color alone.
- **Don't** invent new radii, spacing increments or typography roles when an established token fits.
