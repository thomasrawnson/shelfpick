export const AVATAR_CATALOG = [
  {
    id: "forest",
    label: "Forest",
    description: "Deep green token with a tree motif",
    motif: "forest",
  },
  {
    id: "gold",
    label: "Gold",
    description: "Warm gold token with a star motif",
    motif: "gold",
  },
  {
    id: "clay",
    label: "Clay",
    description: "Neutral clay token with a board motif",
    motif: "clay",
  },
  {
    id: "dice",
    label: "Dice",
    description: "Teal token with a die motif",
    motif: "dice",
  },
  {
    id: "meeple",
    label: "Meeple",
    description: "Warm rust token with a meeple motif",
    motif: "meeple",
  },
  {
    id: "cards",
    label: "Cards",
    description: "Blue token with a card motif",
    motif: "cards",
  },
] as const

export type AvatarId = (typeof AVATAR_CATALOG)[number]["id"]
export type AvatarMotif = (typeof AVATAR_CATALOG)[number]["motif"]

export const AVATAR_IDS = AVATAR_CATALOG.map(({ id }) => id)

export function isAvatarId(value: string): value is AvatarId {
  return AVATAR_IDS.some((id) => id === value)
}
