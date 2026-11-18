import { plural } from "../../stats-model"

export type BarDatum = { key: string; label: string; fullLabel: string; value: number }

type Props = {
  title: string
  summary: string
  data: BarDatum[]
  unit: string
  // Label every n-th bar so long series stay readable.
  labelEvery?: number
  valueHeader?: string
  labelHeader?: string
}

const WIDTH = 360
const HEIGHT = 176
const LEFT = 30
const RIGHT = 6
const TOP = 14
const BOTTOM = 26

// A hand-rolled bar chart. The SVG is described by one summary sentence for
// screen readers; the table below carries every value.
export default function BarChart({ title, summary, data, unit, labelEvery = 1, valueHeader = "Plays", labelHeader = "Month" }: Props) {
  const max = Math.max(1, ...data.map(datum => datum.value))
  const plotWidth = WIDTH - LEFT - RIGHT
  const plotHeight = HEIGHT - TOP - BOTTOM
  const pitch = plotWidth / Math.max(1, data.length)
  const barWidth = Math.max(2, pitch * 0.68)
  const y = (value: number) => TOP + plotHeight - (value / max) * plotHeight

  return (
    <figure className="stats-chart">
      <svg
        className="stats-chart-svg"
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label={`${title}. ${summary}`}
      >
        <line className="stats-chart-axis" x1={LEFT} x2={WIDTH - RIGHT} y1={y(0)} y2={y(0)} />
        <line className="stats-chart-grid" x1={LEFT} x2={WIDTH - RIGHT} y1={y(max)} y2={y(max)} />
        <text className="stats-chart-text" x={LEFT - 6} y={y(max) + 4} textAnchor="end">{max}</text>
        <text className="stats-chart-text" x={LEFT - 6} y={y(0) + 4} textAnchor="end">0</text>
        {data.map((datum, index) => {
          const x = LEFT + index * pitch + (pitch - barWidth) / 2
          const height = datum.value === 0 ? 0 : Math.max(2, y(0) - y(datum.value))
          return (
            <g key={datum.key}>
              <rect className="stats-chart-bar" x={x} y={y(0) - height} width={barWidth} height={height} rx={2}>
                <title>{`${datum.fullLabel}: ${plural(datum.value, unit)}`}</title>
              </rect>
              {index % labelEvery === 0 && (
                <text className="stats-chart-text" x={x + barWidth / 2} y={HEIGHT - 8} textAnchor="middle">{datum.label}</text>
              )}
            </g>
          )
        })}
      </svg>
      <details className="stats-chart-table">
        <summary>View {title.toLowerCase()} as a table</summary>
        <table>
          <caption className="sr-only">{title}</caption>
          <thead><tr><th scope="col">{labelHeader}</th><th scope="col">{valueHeader}</th></tr></thead>
          <tbody>
            {data.map(datum => (
              <tr key={datum.key}><th scope="row">{datum.fullLabel}</th><td>{datum.value}</td></tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  )
}
