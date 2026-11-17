import type {
  AppView,
} from "./components/AppNavigation"

import type {
  CollectionSection,
} from "./components/CollectionView"


export const APP_PATHS = {
  login: "/login",
  forgotPassword: "/forgot-password",
  resetPassword: "/reset-password",
  verifyEmail: "/verify-email",
  privacyDraft: "/legal/privacy-draft",
  termsDraft: "/legal/terms-draft",
  onboarding: "/onboarding",
  onboardingAccount: "/onboarding/account",
  tonight: "/tonight",
  tonightPlay: "/tonight/log-play",
  shelf: "/shelf",
  shelfOwned: "/shelf/owned",
  shelfWishlist:
    "/shelf/want-to-play",
  shelfRanking:
    "/shelf/ranking",
  plays: "/plays",
  discover: "/discover",
  stats: "/stats",
  // Guest voting links keep their original public path.
  gameNightJoin: "/game-night/join",
  liveTimer: "/live-timer",
  setup: "/setup",
  settings: "/settings",
  settingsProfile: "/settings/profile",
  settingsPreferences: "/settings/preferences",
  settingsAppearance: "/settings/appearance",
  settingsCollectionData: "/settings/collection-data",
  settingsPlays: "/settings/plays",
  settingsHelp: "/settings/help",
  settingsAbout: "/settings/about",
  settingsPro: "/settings/pro",
} as const

export type TonightMode = "pick" | "vote"

export function tonightModePath(mode: TonightMode): string {
  return `${APP_PATHS.tonight}?mode=${mode}`
}

// Paths from before the five-tab navigation. Each resolves to its new home,
// keeping sub-paths and query strings. Guest voting links are not legacy.
export function legacyRedirect(
  pathname: string,
  search = "",
): string | null {
  const tail = (prefix: string) =>
    pathname === prefix ? "" : pathname.startsWith(`${prefix}/`) ? pathname.slice(prefix.length) : null

  const picker = tail("/picker")
  if (picker !== null) return `${APP_PATHS.tonight}${picker}${search}`
  const collection = tail("/collection")
  if (collection !== null) return `${APP_PATHS.shelf}${collection}${search}`
  if (pathname === "/game-night") return tonightModePath("vote")
  if (pathname === "/insights") return `${APP_PATHS.stats}${search}`
  if (pathname === "/rankings") return APP_PATHS.shelfRanking
  return null
}

export function isIncompleteOnboardingPath(pathname: string): boolean {
  return pathname === APP_PATHS.onboarding || pathname === APP_PATHS.onboardingAccount
}


export function gameNightJoinToken(pathname: string): string | null {
  const prefix = `${APP_PATHS.gameNightJoin}/`
  if (!pathname.startsWith(prefix)) return null
  const token = pathname.slice(prefix.length)
  if (!token || token.includes("/")) return null
  try {
    return decodeURIComponent(token)
  } catch {
    return token
  }
}


export function shelfPath(
  section: CollectionSection,
): string {
  if (section === "wishlist") {
    return APP_PATHS.shelfWishlist
  }

  if (section === "ranking") {
    return APP_PATHS.shelfRanking
  }

  return APP_PATHS.shelfOwned
}


export function shelfGamePath(
  bggId: number,
): string {
  return `${APP_PATHS.shelfOwned}/${bggId}`
}


export function wishlistGamePath(
  bggId: number,
): string {
  return `${APP_PATHS.shelfWishlist}/${bggId}`
}


export function appViewForPath(
  pathname: string,
): AppView {
  const onPath = (base: string) =>
    pathname === base || pathname.startsWith(`${base}/`)

  if (onPath(APP_PATHS.shelf)) return "shelf"
  if (onPath(APP_PATHS.plays)) return "plays"
  if (onPath(APP_PATHS.discover)) return "discover"
  if (onPath(APP_PATHS.stats)) return "stats"
  if (pathname === APP_PATHS.setup || onPath(APP_PATHS.settings)) return "setup"
  return "tonight"
}


export function isProtectedAppPath(
  pathname: string,
): boolean {
  const onPath = (base: string) =>
    pathname === base || pathname.startsWith(`${base}/`)

  return (
    legacyRedirect(pathname) !== null
    || onPath(APP_PATHS.tonight)
    || onPath(APP_PATHS.shelf)
    || onPath(APP_PATHS.plays)
    || pathname === APP_PATHS.discover
    || pathname === APP_PATHS.liveTimer
    || pathname === APP_PATHS.stats
    || pathname === APP_PATHS.setup
    || onPath(APP_PATHS.settings)
  )
}


export function safeReturnPath(
  value: unknown,
): string | null {
  if (
    typeof value !== "string"
    || !value.startsWith("/")
    || value.startsWith("//")
  ) {
    return null
  }

  const url = new URL(
    value,
    "https://boardgamepicker.local",
  )

  const redirected = legacyRedirect(url.pathname, url.search)
  if (redirected) return `${redirected}${url.hash}`

  return isProtectedAppPath(url.pathname)
    ? `${url.pathname}${url.search}${url.hash}`
    : null
}
