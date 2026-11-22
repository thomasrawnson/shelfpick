declare const __SHELFPICK_PURCHASES__: boolean

// Whether this build offers Pro for sale (VITE_PURCHASES_ENABLED=true). It is independent of
// the Privacy Policy and Terms links, which every build shows.
export const PURCHASES_ENABLED = __SHELFPICK_PURCHASES__

// Compiled into the paywall so the release lane can read the effective state back out of the
// archived IPA (fastlane/bundle_flags.rb). The ternary folds at build time: one token survives.
export const PURCHASES_BUILD_MARKER = __SHELFPICK_PURCHASES__ ? "shelfpick-purchases-on" : "shelfpick-purchases-off"
