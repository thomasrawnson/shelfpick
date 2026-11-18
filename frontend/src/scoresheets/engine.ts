// Client preview of the scoresheet engine. The server
// (backend/services/scoresheet_engine.py) is the source of truth and stores
// its own result; this mirrors it so totals and winners update as you type.
// Rules: scoresheets/SCHEMA.md.

export type WinCondition = "highest" | "lowest" | "cooperative" | "target"
export type CategoryType = "number" | "count" | "boolean"
export type CategoryScope = "once" | "per_round"

export interface ScoresheetCategory {
  id: string
  label: string
  help: string
  type: CategoryType
  points_per: number
  allow_negative: boolean
  scope: CategoryScope
  tie_break_direction?: "higher" | "lower"
}

export interface ScoresheetSchema {
  format_version: 1
  bgg_id: number
  name: string
  supported_players: [number, number]
  win_condition: WinCondition
  target_score?: number
  rounds: number | null
  categories: ScoresheetCategory[]
  tie_breakers: string[]
  result_bands?: { min_total: number; label: string }[]
  source: {
    rulebook_title: string
    edition_or_year: string
    url?: string
    checked_against_rulebook: boolean
  }
  notes: string
}

export type Entry = number | boolean | number[]
export type Breakdown = Record<string, Entry>

export interface ScoredPlay {
  totals: number[]
  // 1 is first; equal ranks tie. null when there is no finishing order.
  ranks: number[] | null
  winners: number[]
  resultBand: string | null
}

export function rawTotal(category: ScoresheetCategory, value: Entry | undefined): number {
  if (value === undefined) return 0
  if (category.type === "boolean") return value ? 1 : 0
  if (Array.isArray(value)) return value.reduce((sum, item) => sum + item, 0)
  return value as number
}

export function playerTotal(sheet: ScoresheetSchema, scores: Breakdown): number {
  return sheet.categories.reduce(
    (sum, category) => sum + rawTotal(category, scores[category.id]) * category.points_per,
    0,
  )
}

export function resultBand(sheet: ScoresheetSchema, total: number): string | null {
  if (!sheet.result_bands?.length) return null
  const bands = [...sheet.result_bands].sort((a, b) => b.min_total - a.min_total)
  return bands.find((band) => total >= band.min_total)?.label ?? null
}

function orderingKey(sheet: ScoresheetSchema, scores: Breakdown, total: number, reached: boolean): number[] {
  const key = [reached ? 0 : 1, sheet.win_condition === "lowest" ? total : -total]
  for (const id of sheet.tie_breakers) {
    if (id === "shared") break
    const category = sheet.categories.find((item) => item.id === id)
    if (!category) break
    const raw = rawTotal(category, scores[id])
    key.push(category.tie_break_direction === "lower" ? raw : -raw)
  }
  return key
}

function compareKeys(a: number[], b: number[]): number {
  for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
    const difference = (a[index] ?? 0) - (b[index] ?? 0)
    if (difference !== 0) return difference
  }
  return 0
}

export function scorePlay(sheet: ScoresheetSchema, players: Breakdown[]): ScoredPlay {
  const totals = players.map((scores) => playerTotal(sheet, scores))
  if (sheet.win_condition === "cooperative") {
    return { totals, ranks: null, winners: [], resultBand: totals.length ? resultBand(sheet, totals[0]) : null }
  }
  const reached = totals.map((total) => sheet.win_condition !== "target" || total >= (sheet.target_score ?? 0))
  if (players.length < 2 || !reached.some(Boolean)) {
    return { totals, ranks: null, winners: [], resultBand: null }
  }
  const keys = players.map((scores, index) => orderingKey(sheet, scores, totals[index], reached[index]))
  const ranks = keys.map((key) => 1 + keys.filter((other) => compareKeys(other, key) < 0).length)
  return {
    totals,
    ranks,
    winners: ranks.flatMap((rank, index) => (rank === 1 ? [index] : [])),
    resultBand: null,
  }
}

export function targetReached(sheet: ScoresheetSchema, total: number): boolean | null {
  if (sheet.win_condition !== "target") return null
  return total >= (sheet.target_score ?? 0)
}

// One editable cell of the grid: a once-scope category, or one round of a
// per-round category.
export interface SheetRow {
  key: string
  category: ScoresheetCategory
  round: number | null
  label: string
}

export function sheetRows(sheet: ScoresheetSchema, roundCounts: Record<string, number>): SheetRow[] {
  return sheet.categories.flatMap((category): SheetRow[] => {
    if (category.scope === "once") {
      return [{ key: category.id, category, round: null, label: category.label }]
    }
    const count = sheet.rounds ?? roundCounts[category.id] ?? 1
    return Array.from({ length: count }, (_, round) => ({
      key: `${category.id}:${round}`,
      category,
      round,
      label: `${category.label} · round ${round + 1}`,
    }))
  })
}

// The number of rounds shown for an open-ended per-round category.
export function openRoundCount(breakdowns: Breakdown[], categoryId: string): number {
  const lengths = breakdowns.map((scores) => {
    const value = scores[categoryId]
    return Array.isArray(value) ? value.length : 0
  })
  return Math.max(1, ...lengths)
}

export function cellValue(scores: Breakdown, row: SheetRow): Entry | undefined {
  const value = scores[row.category.id]
  if (row.round === null) return value
  return Array.isArray(value) ? value[row.round] : undefined
}

export function withCell(
  sheet: ScoresheetSchema,
  scores: Breakdown,
  row: SheetRow,
  value: number | boolean | null,
  roundCount: number,
): Breakdown {
  const next = { ...scores }
  if (row.round === null) {
    if (value === null) delete next[row.category.id]
    else next[row.category.id] = value
    return next
  }
  const length = sheet.rounds ?? roundCount
  const current = Array.isArray(next[row.category.id]) ? [...(next[row.category.id] as number[])] : []
  while (current.length < length) current.push(0)
  current[row.round] = typeof value === "number" ? value : 0
  next[row.category.id] = current
  return next
}

// Entries the server accepts: per-round lists padded to the round count.
export function completeBreakdown(sheet: ScoresheetSchema, scores: Breakdown, roundCounts: Record<string, number>): Breakdown {
  const complete: Breakdown = {}
  for (const category of sheet.categories) {
    const value = scores[category.id]
    if (category.scope === "per_round") {
      const length = sheet.rounds ?? roundCounts[category.id] ?? 1
      const rounds = Array.isArray(value) ? value.slice(0, length) : []
      while (rounds.length < length) rounds.push(0)
      complete[category.id] = rounds
    } else if (value !== undefined) {
      complete[category.id] = value
    }
  }
  return complete
}

export function cellProblem(category: ScoresheetCategory, value: number): string | null {
  if (!Number.isFinite(value) || Math.abs(value) > 1_000_000) return "That number is too large."
  if (category.type === "count" && (value < 0 || !Number.isInteger(value))) return "Enter a whole number, 0 or more."
  if (category.type === "number" && value < 0 && !category.allow_negative) return "This category can't be negative."
  return null
}
