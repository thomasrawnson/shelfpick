// Builder form state for custom scoresheets and its conversion to the
// format-1 schema. The server validates the result again.

import type { CategoryType, ScoresheetSchema, WinCondition } from "./engine"

export interface CategoryDraft {
  key: string
  // Kept from the saved sheet so ids stay stable across edits.
  id: string | null
  label: string
  help: string
  type: CategoryType
  pointsPer: string
  allowNegative: boolean
  perRound: boolean
}

export interface BuilderDraft {
  name: string
  winCondition: WinCondition
  targetScore: string
  // "" means rounds are open-ended.
  rounds: string
  categories: CategoryDraft[]
  // Category keys, in order.
  tieBreakers: string[]
  sharedTies: boolean
}

export const LIMITS = { name: 100, label: 60, help: 200, categories: 40, rounds: 50, tieBreakers: 9 }

let counter = 0
export function newCategory(label = ""): CategoryDraft {
  counter += 1
  return { key: `c${Date.now().toString(36)}${counter}`, id: null, label, help: "", type: "number", pointsPer: "1", allowNegative: false, perRound: false }
}

export function emptyDraft(gameName: string): BuilderDraft {
  return {
    name: `${gameName} (my sheet)`.slice(0, LIMITS.name),
    winCondition: "highest",
    targetScore: "",
    rounds: "",
    categories: [newCategory("Points")],
    tieBreakers: [],
    sharedTies: true,
  }
}

export function draftFromSchema(schema: ScoresheetSchema): BuilderDraft {
  const categories = schema.categories.map((category) => ({
    ...newCategory(category.label),
    id: category.id,
    help: category.help,
    type: category.type,
    pointsPer: String(category.points_per),
    allowNegative: category.allow_negative,
    perRound: category.scope === "per_round",
  }))
  const keyFor = new Map(categories.map((category) => [category.id, category.key]))
  return {
    name: schema.name,
    winCondition: schema.win_condition,
    targetScore: schema.target_score === undefined ? "" : String(schema.target_score),
    rounds: schema.rounds === null ? "" : String(schema.rounds),
    categories,
    tieBreakers: schema.tie_breakers.filter((id) => id !== "shared").map((id) => keyFor.get(id) ?? "").filter(Boolean),
    sharedTies: schema.tie_breakers.includes("shared"),
  }
}

export function slugId(label: string): string {
  const slug = label
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40)
  if (slug === "") return "category"
  return /^[a-z]/.test(slug) ? slug : `c_${slug}`
}

export type BuildResult = { ok: true; schema: ScoresheetSchema } | { ok: false; error: string }

export function schemaFromDraft(draft: BuilderDraft, bggId: number): BuildResult {
  const name = draft.name.trim()
  if (name === "") return { ok: false, error: "Give the scoresheet a name." }
  if (draft.categories.length === 0) return { ok: false, error: "Add at least one category." }
  if (draft.categories.length > LIMITS.categories) return { ok: false, error: `Use at most ${LIMITS.categories} categories.` }

  let rounds: number | null = null
  if (draft.rounds.trim() !== "") {
    rounds = Number(draft.rounds)
    if (!Number.isInteger(rounds) || rounds < 1 || rounds > LIMITS.rounds) {
      return { ok: false, error: `Rounds must be a whole number from 1 to ${LIMITS.rounds}, or blank.` }
    }
  }

  const used = new Set<string>()
  const idFor = new Map<string, string>()
  const categories = []
  for (const [index, category] of draft.categories.entries()) {
    const label = category.label.trim()
    if (label === "") return { ok: false, error: `Category ${index + 1} needs a name.` }
    const pointsPer = Number(category.pointsPer)
    if (category.pointsPer.trim() === "" || !Number.isFinite(pointsPer) || Math.abs(pointsPer) > 1000) {
      return { ok: false, error: `${label}: points per entry must be a number from −1000 to 1000.` }
    }
    let id = category.id ?? slugId(label)
    const base = id
    let suffix = 2
    while (used.has(id)) { id = `${base}_${suffix}`; suffix += 1 }
    used.add(id)
    idFor.set(category.key, id)
    const isBoolean = category.type === "boolean"
    categories.push({
      id,
      label: label.slice(0, LIMITS.label),
      help: (category.help.trim() || `Enter ${label.toLowerCase()}.`).slice(0, LIMITS.help),
      type: category.type,
      points_per: pointsPer,
      allow_negative: category.type === "number" && category.allowNegative,
      scope: !isBoolean && category.perRound ? "per_round" as const : "once" as const,
    })
  }

  const schema: ScoresheetSchema = {
    format_version: 1,
    bgg_id: bggId,
    name: name.slice(0, LIMITS.name),
    supported_players: [1, 20],
    win_condition: draft.winCondition,
    rounds,
    categories,
    tie_breakers: [],
    source: { rulebook_title: "Custom scoresheet", edition_or_year: "Custom", checked_against_rulebook: false },
    notes: "",
  }

  if (draft.winCondition === "target") {
    const target = Number(draft.targetScore)
    if (draft.targetScore.trim() === "" || !Number.isFinite(target)) {
      return { ok: false, error: "Enter the target score." }
    }
    schema.target_score = target
  }

  if (draft.winCondition !== "cooperative") {
    const breakers = draft.tieBreakers
      .map((key) => idFor.get(key))
      .filter((id): id is string => id !== undefined)
    schema.tie_breakers = [...new Set(breakers)].slice(0, LIMITS.tieBreakers)
    if (draft.sharedTies) schema.tie_breakers.push("shared")
  }

  return { ok: true, schema }
}
