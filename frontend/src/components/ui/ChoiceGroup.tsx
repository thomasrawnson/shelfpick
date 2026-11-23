import { useEffect, useRef, type ReactNode } from "react"

import { lightImpact } from "../../haptics"

type Option<T extends string> = {
  value: T
  label: string
  // Small extra content after the label, for example a Pro badge.
  trailing?: ReactNode
}

type Props<T extends string> = {
  value: T
  options: ReadonlyArray<Option<T>>
  onChange: (value: T) => void
  ariaLabel: string
  // "segmented": a track of equal options. "chips": separate pills.
  variant?: "segmented" | "chips"
  // One row that scrolls sideways instead of wrapping (a long tab row).
  scroll?: boolean
  className?: string
}

// The one selected-state control for every segmented control and chip row (SP-UI-04).
// Selected = Forest on a Forest-soft fill with a 2px Forest edge and bold text; unselected = no fill and supporting
// text. The state is exposed as aria-pressed, so it is never colour alone (see .choice in styles/choice.css).
function ChoiceGroup<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
  variant = "segmented",
  scroll = false,
  className = "",
}: Props<T>) {
  const selectedRef = useRef<HTMLButtonElement>(null)

  // A scrolling row keeps the chosen option in view.
  useEffect(() => {
    if (scroll) selectedRef.current?.scrollIntoView({ inline: "nearest", block: "nearest" })
  }, [scroll, value])

  return (
    <div
      className={["choice-group", variant, scroll ? "scrolls" : "", className].filter(Boolean).join(" ")}
      role="group"
      aria-label={ariaLabel}
    >
      {options.map((option) => {
        const selected = value === option.value
        return (
          <button
            type="button"
            key={option.value}
            ref={selected ? selectedRef : undefined}
            className={selected ? "choice selected" : "choice"}
            aria-pressed={selected}
            onClick={() => {
              if (!selected) void lightImpact()
              onChange(option.value)
            }}
          >
            {option.label}
            {option.trailing}
          </button>
        )
      })}
    </div>
  )
}

export default ChoiceGroup
