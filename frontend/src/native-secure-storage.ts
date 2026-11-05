import { Capacitor } from "@capacitor/core"
import { KeychainAccess, SecureStorage } from "@aparajita/capacitor-secure-storage"

export const isNativeIos = Capacitor.isNativePlatform() && Capacitor.getPlatform() === "ios"

const INSTALL_MARKER = "shelfpick-native-install-v1"
const ACCOUNT_TOKEN_KEY = "boardgamepicker_access_token"
const GUEST_KEY_PREFIX = "shelfpick-game-night-guest:"
let installationCheck: Promise<void> | null = null

async function ensureNativeInstallation(): Promise<void> {
  if (!isNativeIos || localStorage.getItem(INSTALL_MARKER) === "1") return
  if (!installationCheck) {
    installationCheck = (async () => {
      // The app container is removed on uninstall, while Keychain items may
      // remain. Clear only credentials owned by this app before restoration.
      const keys = await SecureStorage.keys(false)
      for (const key of keys) {
        if (key === ACCOUNT_TOKEN_KEY || key.startsWith(GUEST_KEY_PREFIX)) {
          await SecureStorage.remove(key, false)
        }
      }
      localStorage.setItem(INSTALL_MARKER, "1")
    })().catch((error) => {
      installationCheck = null
      throw error
    })
  }
  await installationCheck
}

export async function getCredential(key: string): Promise<string | null> {
  if (!isNativeIos) return localStorage.getItem(key)
  await ensureNativeInstallation()
  // Do not migrate credentials from a company-ID WebView development build.
  localStorage.removeItem(key)
  const value = await SecureStorage.get(key, false, false)
  return typeof value === "string" ? value : null
}

export async function saveCredential(key: string, value: string): Promise<void> {
  if (!isNativeIos) {
    localStorage.setItem(key, value)
    return
  }
  await ensureNativeInstallation()
  localStorage.removeItem(key)
  await SecureStorage.set(key, value, false, false, KeychainAccess.whenUnlockedThisDeviceOnly)
}

export async function clearCredential(key: string): Promise<void> {
  if (!isNativeIos) {
    localStorage.removeItem(key)
    return
  }
  localStorage.removeItem(key)
  await SecureStorage.remove(key, false)
}
