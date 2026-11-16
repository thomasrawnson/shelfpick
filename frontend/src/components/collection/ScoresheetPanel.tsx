import type {
  ScoresheetCalculation,
  ScoresheetEntry,
  ScoresheetTemplate,
} from "../../scoresheets"
import { getActiveScoresheetFields } from "../../scoresheets"

type Props = {
  template: ScoresheetTemplate
  playerNames: string[]
  entries: ScoresheetEntry[]
  activeExpansionIds: string[]
  calculation: ScoresheetCalculation
  onEntriesChange: (entries: ScoresheetEntry[]) => void
  onExpansionChange: (expansionId: string, active: boolean) => void
  onUseManual: () => void
}

function ScoresheetPanel({
  template,
  playerNames,
  entries,
  activeExpansionIds,
  calculation,
  onEntriesChange,
  onExpansionChange,
  onUseManual,
}: Props) {
  const fields = getActiveScoresheetFields(template, activeExpansionIds)
  const scoreFields = fields.filter(field => field.kind === "score")
  const tieBreakerFields = fields.filter(field => field.kind === "tiebreaker")
  const needsTieBreak = calculation.missingFieldIds.some(fieldId =>
    tieBreakerFields.some(field => field.id === fieldId),
  )

  function updateCell(playerIndex: number, fieldId: string, value: string) {
    onEntriesChange(entries.map((entry, index) => index === playerIndex
      ? { ...entry, [fieldId]: value }
      : entry))
  }

  const winnerNames = calculation.winnerIndexes.map(index =>
    playerNames[index]?.trim() || `Player ${index + 1}`,
  )

  return (
    <section className="scoresheet" aria-labelledby="scoresheet-heading">
      <div className="scoresheet-heading">
        <div>
          <h3 id="scoresheet-heading">{template.gameName} scoresheet</h3>
          <span>Totals update as you score.</span>
        </div>
        <button type="button" className="ghost-button" onClick={onUseManual}>
          Use manual scoring
        </button>
      </div>

      {template.expansions.map(expansion => (
        <label className="scoresheet-expansion" key={expansion.id}>
          <input
            type="checkbox"
            checked={activeExpansionIds.includes(expansion.id)}
            onChange={event => onExpansionChange(expansion.id, event.target.checked)}
          />
          <span>{expansion.label}</span>
        </label>
      ))}

      <div className="scoresheet-players">
        {entries.map((entry, playerIndex) => (
          <fieldset className="scoresheet-player" key={playerIndex}>
            <legend>
              {playerNames[playerIndex]?.trim() || `Player ${playerIndex + 1}`}
              <strong>
                {calculation.totals[playerIndex] === null
                  ? "Incomplete"
                  : `${calculation.totals[playerIndex]} pts`}
              </strong>
            </legend>

            <div className="scoresheet-fields">
              {scoreFields.map(field => (
                <label key={field.id}>
                  <span>{field.label}</span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    inputMode="numeric"
                    value={entry[field.id] ?? ""}
                    aria-invalid={calculation.invalidFieldIds.includes(field.id)}
                    onChange={event => updateCell(playerIndex, field.id, event.target.value)}
                  />
                </label>
              ))}
            </div>

            {tieBreakerFields.length > 0 && (
              <div className="scoresheet-tiebreakers">
                {tieBreakerFields.map(field => (
                  <label key={field.id}>
                    <span>{field.label} <small>Tie-breaker</small></span>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      inputMode="numeric"
                      value={entry[field.id] ?? ""}
                      aria-invalid={
                        calculation.invalidFieldIds.includes(field.id)
                        || calculation.missingFieldIds.includes(field.id)
                      }
                      onChange={event => updateCell(playerIndex, field.id, event.target.value)}
                    />
                  </label>
                ))}
              </div>
            )}
          </fieldset>
        ))}
      </div>

      <div className="scoresheet-result" role="status" aria-live="polite">
        {calculation.invalidFieldIds.length > 0
          ? "Use whole numbers of zero or more."
          : needsTieBreak
            ? "Enter the highlighted tie-breaker values to decide the result."
            : !calculation.complete
              ? "Complete every scoring category to calculate the result."
              : winnerNames.length === 0
                ? "Solo score ready to save."
                : winnerNames.length === 1
                  ? `${winnerNames[0]} wins.`
                  : `Tie: ${winnerNames.join(" and ")}.`}
      </div>
    </section>
  )
}

export default ScoresheetPanel
