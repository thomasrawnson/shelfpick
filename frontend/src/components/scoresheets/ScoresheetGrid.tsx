import { useEffect, useRef, useState } from "react"

import {
  cellProblem,
  cellValue,
  sheetRows,
  withCell,
  type Breakdown,
  type ScoredPlay,
  type ScoresheetSchema,
  type SheetRow,
} from "../../scoresheets/engine"
import { formatNumber } from "../../scoresheets/math-input"
import MathKeyboard from "./MathKeyboard"

type Props = {
  sheet: ScoresheetSchema
  // Column headings: player names, or one "Team" column for co-op sheets.
  columns: string[]
  breakdowns: Breakdown[]
  roundCounts: Record<string, number>
  scored: ScoredPlay
  onChange: (column: number, breakdown: Breakdown) => void
  onAddRound: (categoryId: string) => void
  caption: string
}

function ordinal(rank: number) {
  const tens = rank % 100
  if (tens >= 11 && tens <= 13) return `${rank}th`
  return `${rank}${["th", "st", "nd", "rd"][rank % 10] ?? "th"}`
}

function shown(value: number | boolean | number[] | undefined) {
  if (value === undefined) return ""
  if (typeof value === "boolean") return value ? "✓" : ""
  return typeof value === "number" ? formatNumber(value) : ""
}

// A category × player grid: players are columns and category labels stay
// pinned on the left while the grid scrolls sideways. Tapping a cell opens
// the maths keyboard; tick-box categories toggle in place.
export default function ScoresheetGrid({ sheet, columns, breakdowns, roundCounts, scored, onChange, onAddRound, caption }: Props) {
  const rows = sheetRows(sheet, roundCounts)
  const [active, setActive] = useState<{ row: number; column: number } | null>(null)
  const cellRefs = useRef(new Map<string, HTMLButtonElement>())
  const editable = rows.flatMap((row, rowIndex) => (row.category.type === "boolean" ? [] : [rowIndex]))

  function cellKey(row: number, column: number) {
    return `${row}:${column}`
  }

  function setCell(row: SheetRow, column: number, value: number | boolean | null) {
    const count = roundCounts[row.category.id] ?? 1
    onChange(column, withCell(sheet, breakdowns[column] ?? {}, row, value, count))
  }

  function nextCell(row: number, column: number) {
    const position = editable.indexOf(row)
    if (position >= 0 && position < editable.length - 1) return { row: editable[position + 1], column }
    if (column < columns.length - 1 && editable.length > 0) return { row: editable[0], column: column + 1 }
    return null
  }

  function close(row: number, column: number) {
    setActive(null)
    window.setTimeout(() => cellRefs.current.get(cellKey(row, column))?.focus(), 0)
  }

  const keyboardHost = useRef<HTMLDivElement>(null)

  // Keep the cell being typed into visible just above the docked keyboard.
  useEffect(() => {
    if (!active) return
    const cell = cellRefs.current.get(cellKey(active.row, active.column))
    const keyboard = keyboardHost.current?.querySelector(".math-keyboard")
    const scroller = cell?.closest(".play-sheet-form")
    if (!cell || !keyboard || !scroller) return
    const cellBox = cell.getBoundingClientRect()
    const limit = keyboard.getBoundingClientRect().top - 12
    const top = scroller.getBoundingClientRect().top + 8
    const shift = cellBox.bottom > limit ? cellBox.bottom - limit : cellBox.top < top ? cellBox.top - top : 0
    if (shift !== 0) scroller.scrollBy({ top: shift, behavior: "smooth" })
  }, [active])

  const activeRow = active ? rows[active.row] : null
  const activeValue = active && activeRow ? cellValue(breakdowns[active.column] ?? {}, activeRow) : undefined

  return (
    <div className="scoresheet">
      <div className="scoresheet-scroll" role="region" aria-label={caption} tabIndex={0}>
        <table className="scoresheet-grid">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr>
              <th scope="col" className="scoresheet-corner">Category</th>
              {columns.map((name, column) => <th scope="col" key={column} className="scoresheet-player">{name}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => {
              const isLastRound = row.round !== null && sheet.rounds === null
                && row.round === (roundCounts[row.category.id] ?? 1) - 1
              const multiplier = row.round !== null || row.category.points_per === 1
                ? ""
                : row.category.points_per === 0
                  ? "tie-break"
                  : `×${formatNumber(row.category.points_per)}`
              return [
                <tr key={row.key}>
                  <th scope="row" className="scoresheet-category">
                    <span>{row.label}</span>
                    {multiplier && <><span className="sr-only">, </span><span className="scoresheet-multiplier">{multiplier}</span></>}
                  </th>
                  {columns.map((name, column) => {
                    const value = cellValue(breakdowns[column] ?? {}, row)
                    const isActive = active?.row === rowIndex && active.column === column
                    if (row.category.type === "boolean") {
                      return (
                        <td key={column}>
                          <button
                            type="button"
                            className="scoresheet-cell scoresheet-tick"
                            aria-pressed={value === true}
                            aria-label={`${row.label}, ${name}`}
                            onClick={() => setCell(row, column, value !== true)}
                          >
                            {value === true ? "✓" : ""}
                          </button>
                        </td>
                      )
                    }
                    const text = shown(value)
                    return (
                      <td key={column}>
                        <button
                          type="button"
                          ref={(element) => {
                            if (element) cellRefs.current.set(cellKey(rowIndex, column), element)
                            else cellRefs.current.delete(cellKey(rowIndex, column))
                          }}
                          className={isActive ? "scoresheet-cell active" : "scoresheet-cell"}
                          aria-label={`${row.label}, ${name}: ${text === "" ? "empty" : text}`}
                          aria-expanded={isActive}
                          onClick={() => setActive({ row: rowIndex, column })}
                        >
                          {text}
                        </button>
                      </td>
                    )
                  })}
                </tr>,
                isLastRound && (
                  <tr key={`${row.key}-add`} className="scoresheet-add-round">
                    <th scope="row" colSpan={columns.length + 1}>
                      <button type="button" className="sheet-text-button" onClick={() => onAddRound(row.category.id)}>
                        Add round
                      </button>
                    </th>
                  </tr>
                ),
              ]
            })}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row" className="scoresheet-category">Total</th>
              {columns.map((name, column) => {
                const rank = scored.ranks?.[column] ?? null
                const winner = scored.winners.includes(column)
                return (
                  <td key={column} className={winner ? "scoresheet-total winner" : "scoresheet-total"}>
                    <span className="scoresheet-total-value" aria-label={`${name} total ${formatNumber(scored.totals[column] ?? 0)}${rank ? `, ${ordinal(rank)}` : ""}`}>
                      {formatNumber(scored.totals[column] ?? 0)}
                    </span>
                    {rank !== null && <span className="scoresheet-rank" aria-hidden="true">{ordinal(rank)}</span>}
                  </td>
                )
              })}
            </tr>
          </tfoot>
        </table>
      </div>

      {active && activeRow && <div className="math-keyboard-spacer" aria-hidden="true" />}
      <div ref={keyboardHost}>
      {active && activeRow && (
        <MathKeyboard
          key={`${active.row}:${active.column}`}
          label={`${activeRow.label} for ${columns[active.column]}`}
          help={activeRow.round === null || activeRow.round === 0 ? activeRow.category.help : undefined}
          initial={typeof activeValue === "number" ? String(activeValue) : ""}
          validate={(value) => cellProblem(activeRow.category, value)}
          isLast={nextCell(active.row, active.column) === null}
          onCommit={(value, move) => {
            const { row, column } = active
            setCell(activeRow, column, value)
            const next = move === "next" ? nextCell(row, column) : null
            if (next) setActive(next)
            else close(row, column)
          }}
        />
      )}
      </div>
    </div>
  )
}
