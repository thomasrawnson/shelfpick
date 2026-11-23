// Mechanics and categories on the game detail screen (SP-UI-05).

// How many terms show before "Show all".
export const TERM_LIMIT = 6

// A few BoardGameGeek imports carry a literal "Tags" entry that is not a mechanic or a category. It is hidden when the
// list is displayed; the stored data is not changed.
const IMPORT_ARTEFACTS = new Set(["tags"])

export function displayTerms(terms: readonly string[]): string[] {
  return terms.filter((term) => !IMPORT_ARTEFACTS.has(term.trim().toLowerCase()))
}

export function shownTerms(terms: readonly string[], expanded: boolean): string[] {
  return expanded || terms.length <= TERM_LIMIT ? [...terms] : terms.slice(0, TERM_LIMIT)
}
