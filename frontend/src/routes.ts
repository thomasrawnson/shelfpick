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
  onboarding: "/onboarding",
  picker: "/picker",
  pickerPlay: "/picker/log-play",
  collection: "/collection",
  collectionOwned: "/collection/owned",
  collectionWishlist:
    "/collection/want-to-play",
  collectionRanking:
    "/collection/ranking",
  gameNight: "/game-night",
  rankings: "/rankings",
  discover: "/discover",
  insights: "/insights",
  setup: "/setup",
  settings: "/settings",
  settingsProfile: "/settings/profile",
  settingsPro: "/settings/pro",
} as const


export function collectionPath(
  section: CollectionSection,
): string {
  if (section === "wishlist") {
    return APP_PATHS.collectionWishlist
  }

  if (section === "ranking") {
    return APP_PATHS.collectionRanking
  }

  return APP_PATHS.collectionOwned
}


export function collectionGamePath(
  bggId: number,
): string {
  return `${APP_PATHS.collectionOwned}/${bggId}`
}


export function wishlistGamePath(
  bggId: number,
): string {
  return `${APP_PATHS.collectionWishlist}/${bggId}`
}


export function appViewForPath(
  pathname: string,
): AppView {
  if (
    pathname === APP_PATHS.collection
    || pathname.startsWith(
      `${APP_PATHS.collection}/`,
    )
  ) {
    return "collection"
  }

  if (pathname === APP_PATHS.discover) {
    return "discover"
  }

  if (pathname === APP_PATHS.gameNight) {
    return "gameNight"
  }

  if (pathname === APP_PATHS.insights) {
    return "insights"
  }

  if (pathname === APP_PATHS.rankings) {
    return "collection"
  }

  if (pathname === APP_PATHS.setup) {
    return "setup"
  }

  if (pathname === APP_PATHS.settings || pathname === APP_PATHS.settingsProfile || pathname === APP_PATHS.settingsPro) {
    return "setup"
  }

  return "picker"
}


export function isProtectedAppPath(
  pathname: string,
): boolean {
  return (
    pathname === APP_PATHS.picker
    || pathname.startsWith(
      `${APP_PATHS.picker}/`,
    )
    || pathname === APP_PATHS.collection
    || pathname.startsWith(
      `${APP_PATHS.collection}/`,
    )
    || pathname === APP_PATHS.discover
    || pathname === APP_PATHS.gameNight
    || pathname === APP_PATHS.rankings
    || pathname === APP_PATHS.insights
    || pathname === APP_PATHS.setup
    || pathname === APP_PATHS.settings
    || pathname === APP_PATHS.settingsProfile
    || pathname === APP_PATHS.settingsPro
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

  return isProtectedAppPath(url.pathname)
    ? `${url.pathname}${url.search}${url.hash}`
    : null
}
