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


function PlayStyleStep({
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
      (style) =>
        style
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
          Pick a play style
        </h1>
      </header>


      {options.length > 8 && (
        <input
          className="setup-input"
          type="search"
          value={search}
          placeholder="Search play styles"
          aria-label="Search play styles"
          onChange={(event) =>
            setSearch(
              event.target.value
            )
          }
        />
      )}


      <div className="picker-selection-list">
        {filteredOptions.map(
          (style) => {
            const isSelected =
              selected.includes(
                style
              )

            return (
              <button
                key={style}
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
                    style
                  )
                }
              >
                <span>
                  {style}
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
            No matching play styles.
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


export default PlayStyleStep
