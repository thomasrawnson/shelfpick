export const AVATAR_CATALOG = [
  {
    id: "forest",
    label: "Forest",
    description: "Deep green circle",
    motif: "forest",
  },
  {
    id: "gold",
    label: "Gold",
    description: "Warm gold circle",
    motif: "gold",
  },
  {
    id: "clay",
    label: "Clay",
    description: "Slate circle",
    motif: "clay",
  },
  {
    id: "dice",
    label: "Dice",
    description: "Teal circle",
    motif: "dice",
  },
  {
    id: "meeple",
    label: "Meeple",
    description: "Warm rust circle",
    motif: "meeple",
  },
  {
    id: "cards",
    label: "Cards",
    description: "Plum circle",
    motif: "cards",
  },
] as const

export type AvatarId = (typeof AVATAR_CATALOG)[number]["id"]
export type AvatarMotif = (typeof AVATAR_CATALOG)[number]["motif"]

export const AVATAR_IDS = AVATAR_CATALOG.map(({ id }) => id)

export function isAvatarId(value: string): value is AvatarId {
  return AVATAR_IDS.some((id) => id === value)
}
