// Phone voting is free for every account (SP-UNLOCK-01). The backend setting
// GAME_NIGHT_PHONE_VOTING_ENABLED remains the authority for API access: when it
// is off the server returns 503 and the UI shows the truthful unavailable state.
export const PHONE_VOTING_V1_AVAILABLE = true
