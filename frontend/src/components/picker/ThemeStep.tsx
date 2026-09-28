import {
  useState,
} from "react"


type Props = {
  options: string[]
  selected: string[]
  onToggle: (
    value: string,
  ) => void
  onClear: () => void
  onDone: () => void
  onBack: () => void
}


function ThemeStep({
  options,
  selected,
  onToggle,
  onClear,
  onDone,
  onBack,
}: Props) {
  const [search, setSearch] =
    useState("")

  const filteredOptions =
    options.filter(
      (theme) =>
        theme
          .toLowerCase()
          .includes(
            search
              .trim()
              .toLowerCase()
          )
    )

  return (
    <section className="screen picker-selection-screen">
      <header>
        <h1>
          Pick a theme
        </h1>

        <p className="subtitle">
          Choose any that sound good
          tonight.
        </p>
      </header>


      {options.length > 8 && (
        <input
          className="setup-input"
          type="search"
          value={search}
          placeholder="Search themes"
          aria-label="Search themes"
          onChange={(event) =>
            setSearch(
              event.target.value
            )
          }
        />
      )}


      <div className="picker-selection-list">
        {filteredOptions.map(
          (theme) => {
            const isSelected =
              selected.includes(
                theme
              )

            return (
              <button
                key={theme}
                type="button"
                className={
                  isSelected
                    ? "picker-selection-row selected"
                    : "picker-selection-row"
                }
                aria-pressed={
                  isSelected
                }
                onClick={() =>
                  onToggle(
                    theme
                  )
                }
              >
                <span>
                  {theme}
                </span>

                <span
                  className={
                    isSelected
                      ? "picker-selection-check selected"
                      : "picker-selection-check"
                  }
                  aria-hidden="true"
                >
                  {isSelected
                    ? "✓"
                    : ""}
                </span>
              </button>
            )
          },
        )}

        {filteredOptions.length === 0 && (
          <p className="subtitle">
            No matching themes.
          </p>
        )}
      </div>


      <div className="picker-selection-footer">
        {selected.length > 0 && (
          <button
            type="button"
            className="picker-clear-button"
            onClick={
              onClear
            }
          >
            Clear selection
          </button>
        )}

        <button
          type="button"
          className="primary-button"
          onClick={
            onDone
          }
        >
          Done
        </button>

        <button
          type="button"
          className="ghost-button"
          onClick={
            onBack
          }
        >
          Back
        </button>
      </div>
    </section>
  )
}


export default ThemeStep
