# SP-IOS-10B — V1 visual consistency candidate

Owner accepted SP-IOS-10A/V3 as the starting point. This uncommitted candidate lives in the separate `/private/tmp/shelfpick-sp-ios-10b` worktree. It copied the accepted candidate state without editing `/private/tmp/shelfpick-sp-ios-10a`, the protected iOS worktree, or their signing resources.

## Changes

- Collection, Ranking and Insights selected tabs now sit on neutral tab surfaces, making selection visually distinct in both themes. The Insights grid directly defines its four equal columns instead of relying on a late `!important` override.
- Discover uses a one-line heading. Its recommendation cards use the established border and 16px card radius instead of a shadow on every item.
- Add Game panel spacing and radius use existing tokens.
- Native navigation allows five equal buttons to shrink within the iPhone width. At 320px, web navigation uses tighter gaps, zero horizontal button padding and word-boundary label wrapping.

No recommendation, entitlement, backend, authentication, avatar or Picker logic changed. Existing focus rules were retained.

## Evidence

All `before` and `after` PNGs under [screenshots/sp-ios-10b](screenshots/sp-ios-10b/) were captured from the running iPhone 17e simulator at 1170×2532 using a disposable localhost API with synthetic games, plays and profile. Matched dark comparisons: Picker, Collection, Add Game, Discover, Insights Play, Game Night and Settings. Matched light comparisons: Collection, Discover and Insights Play. The [320px web capture](screenshots/sp-ios-10b/after/picker-web-320-light.png) is an actual Playwright browser fixture, not a simulator image.

The baseline iPhone capture clipped the rightmost Insights nav target. The final simulator capture shows all five targets and names fully within the screen. Collection/Insights selection is clearer, and Discover's heading fits on one line. Profile remained reachable; its saved avatar grid was previously verified in SP-IOS-10A/V3. Game Night and Settings showed no further visual defect requiring a design change.

Playwright checked Picker, Collection, Discover, Insights, Game Night and Settings at 320px: document scroll width equalled the viewport and nav buttons ended within it. At 390px and 430px, document scroll width also equalled the viewport. The 320px browser label capture no longer runs names together. This browser check does not establish native Dynamic Type or a 320px iOS device result.

## Validation and limits

- Frontend: 98 tests passed; ESLint, TypeScript/Vite build, PWA validation and `git diff --check` passed.
- Native: local ad hoc simulator build, install and launch passed; the final Render-configured iOS build compiled. The company-signed physical app was not installed or changed.
- The fixture omitted rankings and live-timer recovery endpoints, so their 404s are fixture limitations. No live Render account or data was used. Before/after light captures are limited to the three screens with primary visual edits; other affected screens have matched dark captures.
- A 320px native simulator and enlarged Dynamic Type repeat check were unavailable/not run. The accepted prior accessibility evidence remains the baseline; verify this nav change at larger text before App Store submission.

After capture, `frontend/dist` and the copied iOS web assets were rebuilt with the approved HTTPS Render API origin; the localhost fixture origin is absent. No commit, push, merge, deployment or distribution occurred.

Playwright also wrote its ordinary screenshot/snapshot diagnostics under the primary checkout's existing `.playwright-mcp/` output directory. No primary source file was edited and those diagnostics were not used as candidate source.
