export type LegalDraftKind = "privacy" | "terms"

declare const __SHELFPICK_LEGAL_DRAFTS__: boolean

export const LEGAL_DRAFT_MARKER =
  "DRAFT — NOT LEGALLY APPROVED"

export function legalDraftsEnabled(
  value: unknown,
): boolean {
  return value === "true"
}

export const LEGAL_DRAFTS_ENABLED =
  __SHELFPICK_LEGAL_DRAFTS__
