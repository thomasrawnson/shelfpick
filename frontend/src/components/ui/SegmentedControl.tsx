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
  className?: string
}

function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
  className = "",
}: Props<T>) {
  return (
    <div
      className={
        [
          "segmented-control",
          className,
        ]
          .filter(Boolean)
          .join(" ")
      }
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

export default SegmentedControl
