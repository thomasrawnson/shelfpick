import type { AvatarId } from "./avatar-catalog"

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


export function getToken():
string | null {
  return localStorage.getItem(
    TOKEN_KEY,
  )
}


export function saveToken(
  token: string,
): void {
  localStorage.setItem(
    TOKEN_KEY,
    token,
  )
}


export function clearToken(): void {
  localStorage.removeItem(
    TOKEN_KEY,
  )
}
