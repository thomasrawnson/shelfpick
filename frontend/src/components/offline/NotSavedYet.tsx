type Props = { what: string; busy?: boolean; onRetry?: () => void }

// Shown instead of an error when the device is offline and nothing has been saved for this screen yet: the
// saved copies are written the first time a screen loads with a connection.
function NotSavedYet({ what, busy, onRetry }: Props) {
  return (
    <div className="retry-notice" aria-busy={busy}>
      <p role="status">
        You're offline, and {what} isn't saved on this device yet. Open it once with a connection and it will be here next time.
      </p>
      {onRetry && (
        <button type="button" className="secondary-button" disabled={busy} onClick={onRetry}>
          {busy ? "Checking…" : "Try again"}
        </button>
      )}
    </div>
  )
}

export default NotSavedYet
