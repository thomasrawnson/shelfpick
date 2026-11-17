import { lightImpact } from "../../haptics"

type Option<T extends string> = {
  value: T
  label: string
}

type Props<T extends string> = {
  value: T
  options: Option<T>[]
  onChange: (value: T) => void
  ariaLabel: string
}

function FilterTabs<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
}: Props<T>) {
  return (
    <div
      className="filter-tabs"
      role="group"
      aria-label={ariaLabel}
    >
      {options.map((option) => (
        <button
          type="button"
          key={option.value}
          className={
            value === option.value
              ? "active"
              : ""
          }
          aria-pressed={
            value === option.value
          }
          onClick={() => {
            if (value !== option.value) void lightImpact()
            onChange(option.value)
          }}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

export default FilterTabs
