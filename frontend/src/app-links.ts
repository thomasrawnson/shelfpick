import { APP_STORE_URL } from "./app-store"

// External ShelfPick links. Change them here.
export const SOCIAL_LINKS = {
  website: { url: "https://plutonightlabs.com", label: "plutonightlabs.com" },
  youtube: { url: "https://www.youtube.com/@shelfpick", label: "@shelfpick" },
} as const

export const REVIEW_URL = `${APP_STORE_URL}?action=write-review`
export const CONTACT_URL = "mailto:hello@plutonightlabs.com"

// Version and build of the next App Store candidate. These must match the
// values set in Xcode at archive time.
export const APP_VERSION = "1.3.1"
export const APP_BUILD = "26"
