type Props = { offset: number; refreshing: boolean }

function PullIndicator({ offset, refreshing }: Props) {
  if (offset === 0 && !refreshing) return null
  return (
    <div className="pull-indicator" style={{ height: refreshing ? 44 : offset }} role="status" aria-live="polite">
      <span className={refreshing ? "pull-spinner is-spinning" : "pull-spinner"} aria-hidden="true" />
      <span className="sr-only">{refreshing ? "Refreshing" : "Pull to refresh"}</span>
    </div>
  )
}

export default PullIndicator
