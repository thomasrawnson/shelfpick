type Props = {
  maxPlayTime: number | null
  loading: boolean
  error: string
  onSelect: (value: number) => void
  onFindGame: () => void
  onBack: () => void
  supportingCopy?: string
  actionLabel?: string
}

const timeOptions = [
  { label: "Filler", description: "15 min or less", value: 15 },
  { label: "Quick", description: "30 min or less", value: 30 },
  { label: "Standard", description: "60 min or less", value: 60 },
  { label: "Main event", description: "90 min or less", value: 90 },
  { label: "Deep dive", description: "120 min or less", value: 120 },
  { label: "All night", description: "No limit", value: 0 },
]

function TimeStep({
  maxPlayTime,
  loading,
  error,
  onSelect,
  onFindGame,
  onBack,
  supportingCopy,
  actionLabel = "Find a game",
}: Props) {
  return (
    <section className="screen picker-step-screen time-step-screen">
      <header>
        <h1>How much time is available?</h1>
        {supportingCopy && <p className="subtitle">{supportingCopy}</p>}
      </header>

      <div className="picker-step-centered">
        <div className="time-grid">
          {timeOptions.map((option) => {
            const selected = maxPlayTime === option.value
            return (
              <button
                key={option.label}
                type="button"
                className={selected ? "time-tile selected" : "time-tile"}
                aria-pressed={selected}
                onClick={() => onSelect(option.value)}
              >
                <strong>{option.label}</strong>
                <span>{option.description}</span>
              </button>
            )
          })}
        </div>

        {error && <p className="error-message">{error}</p>}

        <div className="picker-step-actions">
          <button
            type="button"
            className="primary-button"
            disabled={maxPlayTime === null || loading}
            onClick={onFindGame}
          >
            {loading ? "Searching the shelf..." : actionLabel}
          </button>

          <button
            type="button"
            className="ghost-button"
            onClick={onBack}
            disabled={loading}
          >
            Back
          </button>
        </div>
      </div>
    </section>
  )
}

export default TimeStep
