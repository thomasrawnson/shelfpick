# SP-IOS-01B — iPhone safe area and keyboard verification

4 November 2026. Isolated worktree `/private/tmp/shelfpick-sp-ios-01`, branch `codex/sp-ios-01`. The dirty primary checkout, deployed web app, Render configuration, backend, database schema and entitlements were untouched. No commit, push, merge or deployment occurred.

## Changes and cause

The mobile shell sets its top padding to zero. The header uses `env(safe-area-inset-top)`, but the native WebView lacked `viewport-fit=cover`, so that inset was zero and the profile button entered the status-bar area. On iOS only, startup now sets `viewport-fit=cover`, marks the root as native iOS, and gives the profile button a 44×44 CSS px target (44×44 pt at the 1:1 viewport scale). The existing safe-area header rule then positions the whole target below the status bar. Safari/PWA retains its original viewport metadata and CSS.

Collection search used a 14px input font, causing iOS focus auto zoom. Native iOS text inputs, selects and textareas now have a minimum 16px font. Page zoom remains enabled; no global scaling or accessibility setting was disabled.

## Simulator evidence

| Check | Result |
| --- | --- |
| Build/install | `npm run build:ios` and unsigned Xcode Debug build passed; rebuilt `com.shelfpick.prototype` installed and launched on iPhone 17, iOS 27.2. |
| Settings safe area | Full avatar/profile control was visible beneath the status bar in portrait and landscape. Tapping it opened Settings in both orientations; it remained reachable after Collection search focus and navigation. Source target is 44×44 CSS px. |
| Collection search | Focused and entered `7 Wonders`; both matching results and Add game remained visible at normal scale with the full software keyboard. Opening Add game focused its search field without zoom or horizontal clipping; Search and Close remained reachable. Done dismissed the keyboard, and the full bottom navigation returned at normal scale. |
| Software keyboard | Device Hub's software keyboard was checked on login, Collection search and Add Game search. The login form and focused search controls shifted above it without horizontal clipping. The OS keyboard covers the fixed bottom navigation while open; the visible Done control dismisses it and navigation returns. |
| Account deletion | After fresh login, Settings → Profile again showed the Delete account section, password field, acknowledgement checkbox and disabled final `Delete my account` button. This form is the confirmation flow; submitting it calls the deletion API directly. The final destructive action was not invoked; no password was entered. |
| Logout/login/persistence | Settings → Log out returned to the blank login form; a force quit and cold launch remained logged out. The owner then signed in directly on iPhone 17. Collection (183 owned games), Picker and Insights → Play (one prior test play) loaded. Another force quit and cold launch restored the signed-in Picker with no new login; Settings remained reachable. No credentials or tokens were recorded. |
| Appearance | Logged-out screen captured in [light](screenshots/sp-ios-01b/login-light.png) and [system dark](screenshots/sp-ios-01b/login-dark.png). Signed-in Collection, Settings and Appearance were visually checked in the app's Dark theme. The prior "Use device setting" preference was restored afterward. |

## Web regression

Node 22.23.3: 93 frontend tests passed, ESLint passed, `npm run build` passed and `npm run check:pwa` passed. Playwright production-preview checks at 390, 768, 1024 and 1440px found document and body widths equal to the viewport, with the original web viewport metadata and no native iOS marker. `git diff --check` passed.

## Remaining iOS gaps, in priority order

1. **P1 — Keyboard and accessibility:** The full software keyboard covers the bottom navigation until dismissed with Done. Focused search controls and results remain reachable, and navigation returns without zoom or clipping. Native VoiceOver remains untested.
2. **P1 — Native auth and links:** The prototype still stores its JWT in WebView `localStorage`. Verification/reset and Game Night join links still open web URLs; Universal Links and in-app return routing remain undecided.
3. **P2 — Review polish:** Native share sheet and BGG Safari handoff were observed in SP-IOS-01A, but file/image sharing, launch assets and App Review 4.2 suitability need a focused milestone. Account deletion is now accessible in-app, but the destructive confirmation was intentionally not completed.

Authenticated native layout was checked on iPhone 17 only. Web layout was checked at four viewport widths; those browser checks do not prove safe-area behavior on other iPhone models. No physical iPhone test was performed. Simulator observations do not establish physical-device accessibility or App Store approval.
