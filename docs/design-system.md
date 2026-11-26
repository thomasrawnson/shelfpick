# ShelfPick Design System

## Brand

Primary: Forest Green. Accent: Warm Gold.

The approved icon source is the supplied `Cozy Board Game Shelf Icon.png`,
stored as `frontend/public/branding/shelfpick-icon-source.png`: three illustrated
board-game boxes, a gold meeple, a complete wooden shelf and a dark-green square
background. The in-app logo is its simplified Shelf + Meeple companion. Game
covers should remain visually dominant.

### Brand assets

- Use `shelfpick-logo-light.svg` on light authentication, onboarding and larger
  brand surfaces. Use `shelfpick-logo-dark.svg` on the matching dark surfaces.
- Use `shelfpick-mark.svg` for compact in-app brand contexts. The favicon uses
  the same simplified composition; install and social icons use uncropped
  exports of the approved illustration.
- Light artwork uses Forest Green `#315C48` and Warm Gold `#C28B37`. Dark artwork
  uses the existing dark brand-token values `#70A889` and `#E3AD55`.
- Keep the standalone mark at least 16px high. Use the 180px, 192px and 512px
  raster exports for platform metadata rather than scaling the wordmark. Use
  the dedicated padded maskable exports where a platform may apply an icon mask.
- Preserve aspect ratio, clear space and supplied colours. Do not recolour,
  stretch, rotate, outline or decorate the logo.
- The full logo names the product and should not sit beside duplicate visible
  `ShelfPick` text. Decorative duplicates must be hidden from assistive technology.

## Core rules

- Never hard-code UI colours in page or component CSS when a semantic token exists.
- New UI must support light and dark mode.
- Use semantic CSS tokens.
- Green represents primary actions and active states.
- Gold is an accent and should be used sparingly.
- Do not use gold as a warning colour.
- Game artwork should remain visually dominant.
- Prefer existing shared UI components over page-specific versions.
- New colours must first be added as semantic tokens with a documented purpose.
- New frontend visual work should read this document before implementation.
- Use “warm shelf, confident choices” as the pre-beta visual principle: warm
  neutrals structure the page, artwork carries visual weight, Forest indicates
  action or selection, and Gold provides restrained emphasis.
- Deliver layout work in sequence: UI-1 confirmed defect repair, UI-2 core
  visual polish, then UI-3 full-width content-forward desktop redesign.
- Game Night remains a distinct primary-navigation destination and is not
  merged with Picker.
- Preserve recommendation and exact-player-count rules, the BoardGameGeek Not
  Recommended >=30% exclusion, routes/deep links, browser Back behaviour, and
  collection state/scroll restoration during visual work.

## Tokens and theme mechanism

`frontend/src/styles/tokens.css` is the single palette source, imported by
`App.css`. Light values live on `:root`; dark values live on
`:root[data-theme="dark"]`. Native form controls use the matching `color-scheme`.
The small blocking `public/theme.js` script sets the root attribute from the OS
preference before React paints and follows subsequent OS changes. No theme
control or storage preference is introduced. Hosts/previews can set an explicit
`data-theme="light"` or `data-theme="dark"` on the initial HTML to opt out of OS
tracking. Without JavaScript the root palette is light.

| Semantic token (`--color-` prefix) | Light | Dark |
| --- | --- | --- |
| brand-primary | #315C48 | #70A889 |
| brand-primary-hover | #284D3C | #86B99C |
| brand-primary-soft | #E3EBE6 | #26382E |
| brand-accent | #C28B37 | #E3AD55 |
| brand-accent-hover | #A9752D | #EDBC6E |
| brand-accent-soft | #F4EAD7 | #403522 |
| bg | #F6F3EB | #151816 |
| surface | #FFFFFF | #202521 |
| surface-raised | #EEEAE0 | #29302B |
| text-primary | #1E2A24 | #FFFFFF |
| text-secondary | #667068 | #B8C1BA |
| text-inverse | #FFFFFF | #151816 |
| border | #D9D5CB | #39413B |
| success | #3F7655 | #68A77C |
| warning | #A66D16 | #DDB15B |
| danger | #B7463C | #DF746A |
| info | #356A7A | #6FA1AF |

Additional semantic tokens:

- `--color-text-support`: 90% secondary plus 10% primary for supporting text on
  all neutral surfaces. The supplied light secondary/raised pair is only 4.28:1;
  this derived tone clears 4.5:1 while retaining the original palette token.
  Legacy secondary/muted text aliases use this accessible supporting tone.

- `--color-accent-text`: darker gold in light mode for readable small text on
  neutral surfaces; the brand accent itself is unsuitable for small light-theme text.
- `--color-on-accent`: consistently dark text on gold fills in both themes.
- `--color-on-danger`, `--color-danger-hover`: destructive action text and hover.
- `--color-success-soft`, `--color-warning-soft`, `--color-danger-soft`,
  `--color-info-soft`: functional tints mixed with the current surface.
- `--color-overlay`: translucent black scrim, independent of the surface palette.
- `--color-shadow` and `--shadow-card`: theme-aware subtle elevation.

The existing `--sp-*`, `--shelfpick-*`, `--text-primary/secondary/muted/accent`,
`--felt`, `--card`, `--ink`, `--gold`, `--rust` and related aliases resolve to these
tokens centrally. They are compatibility names, not separate palettes. Use
`--color-*` for new work. In particular, `--card` means a surface, not heading text.

Type tokens: `--font-display` (Lora) and `--font-ui` (Nunito Sans) are the app voices. SP-UI-03 adds
`--font-tonight-display` (Fraunces) and `--font-tonight-body` (DM Sans), self-hosted from `src/assets/fonts/` under the
SIL OFL (licence texts beside the files), used on Tonight only until the owner decides to roll them out.

Spacing: `--space-1` through `--space-6` = 4, 8, 12, 16, 24, 32px.
Radii: `--radius-sm/md/lg` = 8, 12, 16px. Existing bespoke geometry is retained
where changing it would redesign the current layout. Typography and minimum
target-size tokens retain their existing names.

Links (SP-UI-02): links are never underlined. They use Forest text at bold weight;
standalone text actions ("View game details", "Start a group vote") end in a
chevron (›). Dark-mode text is pure white with a brighter secondary tone, rendered
antialiased, for a sharper read.

## Shared UI and states

Keep existing shared buttons, `SegmentedControl`, `FilterTabs`, `Disclosure`,
`ActionRow`, `PasswordField`, `RetryNotice` and `LoadingMessage`.

- Primary: primary fill, inverse text, primary-hover fill.
- Secondary: transparent/surface fill, primary text and border.
- Accent: accent fill, on-accent text, accent-hover fill; reserve for emphasis.
- Destructive: danger fill plus on-danger text, or danger text on a soft tint.
- Selected controls/navigation: primary text and primary-soft fill with a 2px primary edge. Every segmented control and chip row is
  the shared `ChoiceGroup` (SP-UI-04) and exposes `aria-pressed`; Tonight's count buttons also draw a check (SP-UI-03), so
  selection is never colour-only. Unselected options have no fill and supporting text.
- One accent: on Tonight, Shelf, Plays, Discover and Stats gold is not used and Forest is the only interactive accent. The
  account avatar is neutral, the Pro tag is a neutral outline, play counts and Stats numbers are plain text.
- Destructive actions (SP-UI-05): never a visible button; they sit in a "…" menu and open `ConfirmSheet` (alertdialog, names the
  thing, Cancel focused, danger confirm). `.section-label` is the one small uppercase heading style.
- Menus and toasts: `OverflowMenu` holds secondary actions behind a "…" button (44pt items, destructive in the danger colour);
  `UndoToast` offers Undo after a hide. `.select-field` is the compact 40pt menu.
- Disabled: secondary text on a raised surface; preserve existing disabled interaction.
- Forms: theme-aware surfaces, borders and focus rings; danger for invalid fields.
- Cards/dialogs: surface or surface-raised; scrims use overlay rather than a surface.

Functional colours remain distinct from brand colours. Do not use status colours
as decorative chart/rank colours. Existing product logic, component structure,
routes, responsive geometry and cover rendering are unchanged by this slice.

## Branding, browser chrome and PWA

See `frontend/public/branding/README.md` for the active drop-in asset slots and
future logo exports. Current artwork is intentionally preserved. The manifest
uses Forest Green (`#315C48`) and the cream startup background (`#F6F3EB`). HTML
theme-colour metadata follows light (`#315C48`) and dark (`#151816`) OS preferences.
If a future explicit in-app theme setting is added, synchronize browser metadata
with that setting too. Existing service-worker registration and update behavior remain.

## Colour guard and validation

From `frontend/`, run `npm run check:colors`. It recursively reports raw hex,
numeric RGB and HSL colours in CSS, TypeScript, JavaScript and SVG source. It is
advisory and is not wired into CI. Investigate each report; do not extend an
allowlist merely to silence an accidental UI colour. The check is textual and
can flag hex-like IDs/comments; review those in context.

Intentional exceptions: `styles/tokens.css` owns palettes; unused original
`assets/react.svg` and `assets/vite.svg` are template artwork. Raster/game artwork,
external image/data colours, metadata in HTML/Vite config and unchanged public
branding artwork are not UI colour declarations and are outside this source guard.

Run `npm test`, `npm run lint`, `npm run build`, `npm run check:pwa`,
`npm run check:colors`, and `git diff --check`. Inspect both themes for text,
buttons, selected filters, navigation, cards, forms, disabled/error states and
modal overlays. CSS/build checks do not prove authenticated or deployed behavior.
