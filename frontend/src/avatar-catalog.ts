export const AVATAR_CATALOG = [
  {
    id: "forest",
    label: "Forest",
    description: "Deep green table token",
    motif: null,
  },
  {
    id: "gold",
    label: "Gold",
    description: "Warm gold table token",
    motif: null,
  },
  {
    id: "clay",
    label: "Clay",
    description: "Neutral clay table token",
    motif: null,
  },
  {
    id: "dice",
    label: "Dice teal",
    description: "Teal token with a die motif",
    motif: "dice",
  },
  {
    id: "meeple",
    label: "Meeple rust",
    description: "Warm rust token with a meeple motif",
    motif: "meeple",
  },
  {
    id: "cards",
    label: "Card blue",
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
