import type {
  PickerComplexityBand,
  PickerMode,
  PickerPlayStyle,
} from "../../api/client"

import ActionRow
  from "../ui/ActionRow"

import Disclosure
  from "../ui/Disclosure"


type Props = {
  players: number | null
  selectedPlayerIds: number[]
  selectedPlayerNames: string[]
  complexityBand: PickerComplexityBand | null
  preferredCategories: string[]
  preferredMechanics: string[]
  youngestPlayerAge: number | null
  playStyle: PickerPlayStyle
  mode: PickerMode
  onSelectCount:
    (players: number | null) => void
  onComplexityChange:
    (value: PickerComplexityBand | null) => void
  onYoungestPlayerAgeChange:
    (value: number | null) => void
  onPlayStyleChange:
    (value: PickerPlayStyle) => void
  onModeChange:
    (value: PickerMode) => void
  onChoosePlayers: () => void
  onOpenTheme: () => void
  onOpenMechanics: () => void
  onClearFineTune: () => void
  onContinue: () => void
}


const playerOptions = [1, 2, 3, 4, 5, 6]

const complexityOptions: Array<{
  label: string
  value: PickerComplexityBand | null
}> = [
  { label: "Any", value: null },
  { label: "Light", value: "light" },
  { label: "Medium", value: "medium" },
  { label: "Heavy", value: "heavy" },
]

const modeOptions: Array<{
  value: PickerMode
  label: string
  description: string
}> = [
  {
    value: "best_match",
    label: "Best match",
    description: "Give me the strongest fit",
  },
  {
    value: "different",
    label: "Something different",
    description: "Bring neglected games forward",
  },
  {
    value: "surprise",
    label: "Surprise me",
    description: "Pick a wildcard that still fits",
  },
]

const playStyleOptions: Array<{
  value: PickerPlayStyle
  label: string
}> = [
  { value: "any", label: "Either" },
  { value: "cooperative", label: "Cooperative" },
  { value: "competitive", label: "Competitive" },
]

const ageOptions = [null, 6, 8, 10, 12, 14, 16]

function selectionSummary(values: string[]) {
  if (values.length === 0) {
    return "Any"
  }

  if (values.length === 1) {
    return values[0]
  }

  return `${values.length} selected`
}

function PlayerStep({
  players,
  selectedPlayerIds,
  selectedPlayerNames,
  complexityBand,
  preferredCategories,
  preferredMechanics,
  youngestPlayerAge,
  playStyle,
  mode,
  onSelectCount,
  onComplexityChange,
  onYoungestPlayerAgeChange,
  onPlayStyleChange,
  onModeChange,
  onChoosePlayers,
  onOpenTheme,
  onOpenMechanics,
  onClearFineTune,
  onContinue,
}: Props) {
  const activeFineTuneCount = [
    mode !== "best_match",
    playStyle !== "any",
    preferredCategories.length > 0,
    preferredMechanics.length > 0,
    youngestPlayerAge !== null,
  ].filter(Boolean).length

  const fineTuneHint = activeFineTuneCount > 0
    ? `${activeFineTuneCount} preference${activeFineTuneCount === 1 ? "" : "s"} applied`
    : "Optional preferences"

  return (
    <section className="screen picker-step-screen player-step-screen">
      <header>
        <h1>What should we play?</h1>
        <p className="subtitle">
          Set the table and any limits. We’ll choose from your collection.
        </p>
      </header>

      <div className="picker-step-centered">
        <p className="picker-essential-label">Who is playing?</p>

        <button
          type="button"
          className="picker-navigation-card"
          onClick={onChoosePlayers}
        >
          <span>
            <strong>Choose specific players</strong>
            <small>
              {selectedPlayerIds.length > 0
                ? selectedPlayerNames.join(", ")
                : "Use known player preferences and play history"}
            </small>
          </span>
          <span className="picker-navigation-chevron" aria-hidden="true">›</span>
        </button>

        <p className="player-or">or choose a group size</p>

        <div className="player-grid">
          {playerOptions.map((option) => (
            <button
              key={option}
              type="button"
              className={
                players === option && selectedPlayerIds.length === 0
                  ? option === 1
                    ? "player-chip solo selected"
                    : "player-chip selected"
                  : option === 1
                    ? "player-chip solo"
                    : "player-chip"
              }
              aria-label={
                option === 1
                  ? "Solo"
                  : `${option === 6 ? "6 or more" : option} players`
              }
              aria-pressed={
                players === option && selectedPlayerIds.length === 0
              }
              onClick={() => onSelectCount(option)}
            >
              <strong>
                {option === 1 ? "Solo" : option === 6 ? "6+" : option}
              </strong>
            </button>
          ))}
        </div>

        <div className="preference-section player-complexity-section">
          <p className="preference-label">Complexity</p>
          <div className="complexity-grid">
            {complexityOptions.map((option) => {
              const selected = complexityBand === option.value
              return (
                <button
                  key={option.label}
                  type="button"
                  className={
                    selected
                      ? "complexity-option selected"
                      : "complexity-option"
                  }
                  aria-pressed={selected}
                  onClick={() => onComplexityChange(option.value)}
                >
                  <strong>{option.label}</strong>
                </button>
              )
            })}
          </div>
        </div>

        <Disclosure
          label="Fine-tune"
          hint={fineTuneHint}
          className="advanced-filters picker-first-step-advanced"
        >
          {activeFineTuneCount > 0 && (
            <div className="fine-tune-status">
              <span>
                {activeFineTuneCount} preference
                {activeFineTuneCount === 1 ? "" : "s"} applied
              </span>
              <button
                type="button"
                className="fine-tune-clear"
                onClick={onClearFineTune}
              >
                Clear
              </button>
            </div>
          )}

          <div className="advanced-pick-style">
            <span className="advanced-preference-label">Pick style</span>
            <div className="picker-mode-list compact">
              {modeOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={
                    mode === option.value
                      ? "picker-mode-option selected"
                      : "picker-mode-option"
                  }
                  aria-pressed={mode === option.value}
                  title={option.description}
                  onClick={() => onModeChange(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="advanced-play-style">
            <span className="advanced-preference-label">Play style</span>
            <div className="play-style-grid">
              {playStyleOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={
                    playStyle === option.value
                      ? "preference-chip selected"
                      : "preference-chip"
                  }
                  aria-pressed={playStyle === option.value}
                  onClick={() => onPlayStyleChange(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="preference-link-list">
            <ActionRow
              label="Theme"
              value={selectionSummary(preferredCategories)}
              onClick={onOpenTheme}
            />
            <ActionRow
              label="Mechanics"
              value={selectionSummary(preferredMechanics)}
              onClick={onOpenMechanics}
            />
          </div>

          <div className="advanced-age-filter">
            <p className="preference-label">Youngest player age</p>
            <div className="age-filter-grid">
              {ageOptions.map((age) => (
                <button
                  key={age ?? "any"}
                  type="button"
                  className={
                    youngestPlayerAge === age
                      ? "preference-chip selected"
                      : "preference-chip"
                  }
                  aria-pressed={youngestPlayerAge === age}
                  onClick={() => onYoungestPlayerAgeChange(age)}
                >
                  {age === null ? "Any" : `${age}+`}
                </button>
              ))}
            </div>
          </div>
        </Disclosure>

        <div className="picker-step-actions">
          <button
            type="button"
            className="primary-button"
            disabled={players === null}
            onClick={onContinue}
          >
            Continue
          </button>
        </div>
      </div>
    </section>
  )
}

export { PlayerStep }
