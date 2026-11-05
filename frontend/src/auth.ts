import type { AvatarId } from "./avatar-catalog"
import { clearCredential, getCredential, isNativeIos, saveCredential } from "./native-secure-storage.ts"

export interface AuthUser {
  id: number
  email: string
  display_name: string | null
  bgg_username: string | null
  onboarding_completed: boolean
  preferred_player_count: number | null
  preferred_play_time: number | null
  preferred_play_style?: "any" | "cooperative" | "competitive" | null
  profile_player_id: number | null
  player_name: string
  avatar_key: AvatarId
  email_verified: boolean
  tier: "FREE" | "PRO"
  entitlements: string[]
}

export interface AuthResult {
  access_token: string
  token_type: string
  user: AuthUser
}


const TOKEN_KEY =
  "boardgamepicker_access_token"

let nativeToken: string | null = null

export async function restoreToken(): Promise<string | null> {
  if (!isNativeIos) return getToken()
  nativeToken = await getCredential(TOKEN_KEY)
  return nativeToken
}


export function getToken():
string | null {
  return isNativeIos ? nativeToken : localStorage.getItem(TOKEN_KEY)
}


export async function saveToken(
  token: string,
): Promise<void> {
  await saveCredential(TOKEN_KEY, token)
  if (isNativeIos) nativeToken = token
}


export async function clearToken(): Promise<void> {
  nativeToken = null
  await clearCredential(TOKEN_KEY)
}
