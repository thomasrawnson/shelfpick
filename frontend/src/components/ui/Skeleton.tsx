type Props = {
  rows?: number
  variant?: "row" | "tile"
  label?: string
}

// Quiet placeholder blocks that hold a screen's shape while data loads.
function Skeleton({ rows = 4, variant = "row", label = "Loading" }: Props) {
  return (
    <div className={`skeleton skeleton-${variant}`} role="status" aria-busy="true">
      <span className="sr-only">{label}…</span>
      {Array.from({ length: rows }, (_, index) => (
        <span className="skeleton-block" key={index} aria-hidden="true" />
      ))}
    </div>
  )
}

export default Skeleton
