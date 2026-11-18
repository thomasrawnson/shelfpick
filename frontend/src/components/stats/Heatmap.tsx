import { useEffect, useMemo, useRef } from "react"

import type { PlayHeatmap } from "../../api/client"
import { formatDay, heatmapMonthMarkers, heatmapSummary, heatmapWeeks, plural } from "../../stats-model"

const CELL = 12
const GAP = 3
const PITCH = CELL + GAP
const LEFT = 30
const TOP = 20
const DAY_LABELS: Array<[number, string]> = [[0, "Mon"], [2, "Wed"], [4, "Fri"]]

// A hand-rolled calendar heatmap: one column per week, one row per weekday.
// Scrolls sideways on a phone; the days-with-plays table is the text equivalent.
export default function Heatmap({ heatmap, scrollToEnd }: { heatmap: PlayHeatmap; scrollToEnd: boolean }) {
  const weeks = useMemo(() => heatmapWeeks(heatmap), [heatmap])
  const markers = useMemo(() => heatmapMonthMarkers(weeks), [weeks])
  const scroller = useRef<HTMLDivElement>(null)
  const width = LEFT + weeks.length * PITCH
  const height = TOP + 7 * PITCH

  useEffect(() => {
    if (scrollToEnd && scroller.current) scroller.current.scrollLeft = scroller.current.scrollWidth
  }, [heatmap.year, scrollToEnd])

  return (
    <figure className="stats-chart stats-heatmap">
      <div
        className="stats-heatmap-scroll"
        ref={scroller}
        role="region"
        aria-label={`Calendar heatmap for ${heatmap.year}`}
        tabIndex={0}
      >
        <svg
          className="stats-chart-svg stats-heatmap-svg"
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label={`Calendar of plays in ${heatmap.year}. ${heatmapSummary(heatmap)}`}
        >
          {markers.map(marker => (
            <text className="stats-chart-text" key={marker.label + marker.column} x={LEFT + marker.column * PITCH} y={12}>{marker.label}</text>
          ))}
          {DAY_LABELS.map(([row, label]) => (
            <text className="stats-chart-text" key={label} x={0} y={TOP + row * PITCH + CELL - 1}>{label}</text>
          ))}
          {weeks.map((week, column) =>
            week.map((cell, row) =>
              cell && (
                <rect
                  key={cell.date}
                  className={`stats-heat-cell heat-${cell.level}`}
                  x={LEFT + column * PITCH}
                  y={TOP + row * PITCH}
                  width={CELL}
                  height={CELL}
                  rx={2}
                >
                  <title>{`${formatDay(cell.date)}: ${plural(cell.plays, "play")}`}</title>
                </rect>
              ),
            ),
          )}
        </svg>
      </div>
      <div className="stats-heat-legend" aria-hidden="true">
        <span>Fewer</span>
        {[0, 1, 2, 3, 4].map(level => (
          <svg key={level} width={CELL} height={CELL}><rect className={`stats-heat-cell heat-${level}`} width={CELL} height={CELL} rx={2} /></svg>
        ))}
        <span>More</span>
      </div>
      <details className="stats-chart-table">
        <summary>View {heatmap.year} play days as a table</summary>
        {heatmap.days.length === 0 ? (
          <p className="stats-note">No plays recorded in {heatmap.year}.</p>
        ) : (
          <table>
            <caption className="sr-only">Days with plays in {heatmap.year}</caption>
            <thead><tr><th scope="col">Date</th><th scope="col">Plays</th></tr></thead>
            <tbody>
              {heatmap.days.map(day => (
                <tr key={day.date}><th scope="row">{formatDay(day.date)}</th><td>{day.plays}</td></tr>
              ))}
            </tbody>
          </table>
        )}
      </details>
    </figure>
  )
}
