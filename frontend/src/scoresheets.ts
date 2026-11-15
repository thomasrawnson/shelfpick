export type ScoresheetField = {
  readonly id: string
  readonly label: string
  readonly kind: "score" | "tiebreaker"
  readonly expansionId?: string
}

export type ScoresheetExpansion = {
  readonly id: string
  readonly label: string
}

export type ScoresheetTemplate = {
  readonly id: string
  readonly version: number
  readonly bggId: number
  readonly gameName: string
  readonly fields: readonly ScoresheetField[]
  readonly expansions: readonly ScoresheetExpansion[]
  readonly tieBreakers: readonly string[]
}

export type ScoresheetEntry = Record<string, string>

export type ScoresheetCalculation = {
  complete: boolean
  totals: Array<number | null>
  winnerIndexes: number[]
  missingFieldIds: string[]
  invalidFieldIds: string[]
}

const templates: readonly ScoresheetTemplate[] = [
  {
    id: "wingspan-standard",
    version: 1,
    bggId: 266192,
    gameName: "Wingspan",
    fields: [
      { id: "birds", label: "Birds", kind: "score" },
      { id: "bonus_cards", label: "Bonus cards", kind: "score" },
      { id: "end_round_goals", label: "End-of-round goals", kind: "score" },
      { id: "eggs", label: "Eggs", kind: "score" },
      { id: "cached_food", label: "Cached food", kind: "score" },
      { id: "tucked_cards", label: "Tucked cards", kind: "score" },
      { id: "nectar", label: "Nectar", kind: "score", expansionId: "oceania" },
      { id: "unused_food", label: "Unused food", kind: "tiebreaker" },
    ],
    expansions: [
      { id: "oceania", label: "Oceania (adds Nectar)" },
    ],
    tieBreakers: ["unused_food"],
  },
  {
    id: "terraforming-mars-standard",
    version: 1,
    bggId: 167791,
    gameName: "Terraforming Mars",
    fields: [
      { id: "terraform_rating", label: "Terraform rating", kind: "score" },
      { id: "milestones", label: "Milestones", kind: "score" },
      { id: "awards", label: "Awards", kind: "score" },
      { id: "greenery", label: "Greenery", kind: "score" },
      { id: "cities", label: "Cities", kind: "score" },
      { id: "cards", label: "Cards", kind: "score" },
      { id: "money", label: "M€ remaining", kind: "tiebreaker" },
      { id: "unplayed_cards", label: "Unplayed cards", kind: "tiebreaker" },
    ],
    expansions: [],
    tieBreakers: ["money", "unplayed_cards"],
  },
  {
    id: "harmonies-standard",
    version: 1,
    bggId: 414317,
    gameName: "Harmonies",
    fields: [
      { id: "trees", label: "Trees", kind: "score" },
      { id: "mountains", label: "Mountains", kind: "score" },
      { id: "fields", label: "Fields", kind: "score" },
      { id: "buildings", label: "Buildings", kind: "score" },
      { id: "water", label: "Water", kind: "score" },
      { id: "animal_cards", label: "Animal cards", kind: "score" },
      { id: "animal_cubes", label: "Animal cubes placed", kind: "tiebreaker" },
    ],
    expansions: [],
    tieBreakers: ["animal_cubes"],
  },
]

function isActiveField(field: ScoresheetField, activeExpansions: ReadonlySet<string>) {
  return field.expansionId === undefined || activeExpansions.has(field.expansionId)
}

function parseCell(value: string | undefined) {
  if (value === undefined || value.trim() === "") return { kind: "missing" } as const

  const number = Number(value)

  if (!Number.isSafeInteger(number) || number < 0) {
    return { kind: "invalid" } as const
  }

  return { kind: "valid", value: number } as const
}

export function getScoresheetTemplate(bggId: number) {
  return templates.find(template => template.bggId === bggId) ?? null
}

export function getActiveScoresheetFields(
  template: ScoresheetTemplate,
  activeExpansionIds: readonly string[],
) {
  const activeExpansions = new Set(activeExpansionIds)
  return template.fields.filter(field => isActiveField(field, activeExpansions))
}

export function calculateScoresheet(
  template: ScoresheetTemplate,
  entries: readonly ScoresheetEntry[],
  activeExpansionIds: readonly string[] = [],
): ScoresheetCalculation {
  const fields = getActiveScoresheetFields(template, activeExpansionIds)
  const scoreFields = fields.filter(field => field.kind === "score")
  const fieldById = new Map(fields.map(field => [field.id, field]))
  const totals: Array<number | null> = []
  const missingFieldIds = new Set<string>()
  const invalidFieldIds = new Set<string>()

  for (const entry of entries) {
    let total = 0
    let valid = true

    for (const field of scoreFields) {
      const cell = parseCell(entry[field.id])

      if (cell.kind === "missing") {
        missingFieldIds.add(field.id)
        valid = false
      } else if (cell.kind === "invalid") {
        invalidFieldIds.add(field.id)
        valid = false
      } else {
        total += cell.value
      }
    }

    totals.push(valid ? total : null)
  }

  if (entries.length === 0 || totals.some(total => total === null)) {
    return {
      complete: false,
      totals,
      winnerIndexes: [],
      missingFieldIds: [...missingFieldIds],
      invalidFieldIds: [...invalidFieldIds],
    }
  }

  if (entries.length === 1) {
    return {
      complete: true,
      totals,
      winnerIndexes: [],
      missingFieldIds: [],
      invalidFieldIds: [],
    }
  }

  const completeTotals = totals as number[]
  const highestTotal = Math.max(...completeTotals)
  let contenders = completeTotals
    .map((total, index) => total === highestTotal ? index : -1)
    .filter(index => index >= 0)

  for (const fieldId of template.tieBreakers) {
    if (contenders.length <= 1) break

    const field = fieldById.get(fieldId)
    if (field === undefined) continue

    const contenderValues = contenders.map(index => parseCell(entries[index]?.[fieldId]))

    contenderValues.forEach(cell => {
      if (cell.kind === "missing") missingFieldIds.add(fieldId)
      if (cell.kind === "invalid") invalidFieldIds.add(fieldId)
    })

    if (contenderValues.some(cell => cell.kind !== "valid")) {
      return {
        complete: false,
        totals,
        winnerIndexes: [],
        missingFieldIds: [...missingFieldIds],
        invalidFieldIds: [...invalidFieldIds],
      }
    }

    const values = contenderValues.map(cell => cell.kind === "valid" ? cell.value : 0)
    const highestValue = Math.max(...values)
    contenders = contenders.filter((_, index) => values[index] === highestValue)
  }

  return {
    complete: true,
    totals,
    winnerIndexes: contenders,
    missingFieldIds: [],
    invalidFieldIds: [],
  }
}

export function createScoresheetEntries(count: number): ScoresheetEntry[] {
  return Array.from({ length: Math.max(1, count) }, () => ({}))
}
