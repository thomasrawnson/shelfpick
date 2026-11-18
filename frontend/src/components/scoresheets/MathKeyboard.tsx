import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react"

import {
  applyKey,
  displayExpression,
  evaluateExpression,
  formatNumber,
  speakExpression,
  type MathKey,
} from "../../scoresheets/math-input"

type Props = {
  // What is being entered, e.g. "Birds for Ana".
  label: string
  help?: string
  initial: string
  // Return a problem with the value, or null when it can be stored.
  validate: (value: number) => string | null
  // value is null when the entry was cleared.
  onCommit: (value: number | null, move: "next" | "done") => void
  isLast: boolean
}

const KEYS: { key: MathKey; text: string; name: string; className?: string }[] = [
  { key: "7", text: "7", name: "7" },
  { key: "8", text: "8", name: "8" },
  { key: "9", text: "9", name: "9" },
  { key: "*", text: "×", name: "times", className: "math-key-op" },
  { key: "4", text: "4", name: "4" },
  { key: "5", text: "5", name: "5" },
  { key: "6", text: "6", name: "6" },
  { key: "-", text: "−", name: "minus", className: "math-key-op" },
  { key: "1", text: "1", name: "1" },
  { key: "2", text: "2", name: "2" },
  { key: "3", text: "3", name: "3" },
  { key: "+", text: "+", name: "plus", className: "math-key-op" },
  { key: ".", text: ".", name: "decimal point" },
  { key: "0", text: "0", name: "0" },
  { key: "backspace", text: "⌫", name: "Delete", className: "math-key-op" },
  { key: "clear", text: "C", name: "Clear", className: "math-key-op" },
]

const TYPED: Record<string, MathKey> = {
  "+": "+", "-": "-", "*": "*", x: "*", X: "*", ".": ".", ",": ".",
  Backspace: "backspace", Delete: "clear",
}

// A calculator-style keypad for one scoresheet cell. Evaluates "12+7×2"
// with a small parser (no eval) and shows the running result.
export default function MathKeyboard({ label, help, initial, validate, onCommit, isLast }: Props) {
  const ids = useId()
  const [text, setText] = useState(initial)
  const [error, setError] = useState("")
  const display = useRef<HTMLDivElement>(null)

  useEffect(() => { display.current?.focus() }, [])

  const value = evaluateExpression(text)
  const hasOperator = /\d[+\-*]/.test(text)

  function press(key: MathKey) {
    setText((current) => applyKey(current, key))
    setError("")
  }

  function commit(move: "next" | "done") {
    if (text.trim() === "") { onCommit(null, move); return }
    if (value === null) { setError("Finish the sum first."); return }
    const problem = validate(value)
    if (problem) { setError(problem); return }
    onCommit(value, move)
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.metaKey || event.ctrlKey || event.altKey) return
    const key = /^\d$/.test(event.key) ? (event.key as MathKey) : TYPED[event.key]
    if (key) { event.preventDefault(); press(key); return }
    if (event.key === "Enter" || event.key === "=") { event.preventDefault(); commit(isLast ? "done" : "next") }
  }

  const spoken = text === ""
    ? "empty"
    : `${speakExpression(text)}${hasOperator && value !== null ? ` equals ${formatNumber(value)}` : ""}`

  return (
    <div className="math-keyboard" role="group" aria-labelledby={`${ids}-label`} onKeyDown={onKeyDown}>
      <div className="math-keyboard-head">
        <span id={`${ids}-label`} className="math-keyboard-label">{label}</span>
        {help && <span className="math-keyboard-help">{help}</span>}
      </div>
      <div
        ref={display}
        className="math-display"
        tabIndex={-1}
        role="status"
        aria-live="polite"
        aria-label={`Entry: ${spoken}`}
      >
        <span className="math-expression" aria-hidden="true">{text === "" ? "0" : displayExpression(text)}</span>
        {hasOperator && (
          <span className="math-result" aria-hidden="true">= {value === null ? "…" : formatNumber(value)}</span>
        )}
      </div>
      {error && <p className="error-message math-error" role="alert">{error}</p>}
      <div className="math-keys">
        {KEYS.map((item) => (
          <button
            key={item.key}
            type="button"
            className={item.className ? `math-key ${item.className}` : "math-key"}
            aria-label={item.name}
            onClick={() => press(item.key)}
          >
            {item.text}
          </button>
        ))}
      </div>
      <div className="math-actions">
        <button type="button" className="secondary-button" onClick={() => commit("done")}>Done</button>
        {!isLast && <button type="button" className="primary-button" onClick={() => commit("next")}>Next</button>}
      </div>
    </div>
  )
}
