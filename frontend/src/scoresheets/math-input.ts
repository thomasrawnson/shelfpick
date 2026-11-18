// Safe arithmetic for the scoresheet keyboard: numbers, +, −, × and a
// leading minus. Parsed by hand; never passed to eval or Function.

export type MathKey = "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "." | "+" | "-" | "*" | "backspace" | "clear"

const OPERATORS = new Set(["+", "-", "*"])
export const MAX_EXPRESSION_LENGTH = 40

type Token = { kind: "number"; value: number } | { kind: "op"; value: "+" | "-" | "*" }

function tokenize(text: string): Token[] | null {
  const tokens: Token[] = []
  let index = 0
  while (index < text.length) {
    const char = text[index]
    if (char === " ") { index += 1; continue }
    if (OPERATORS.has(char)) {
      tokens.push({ kind: "op", value: char as "+" | "-" | "*" })
      index += 1
      continue
    }
    const match = /^\d+(\.\d+)?|^\.\d+/.exec(text.slice(index))
    if (!match) return null
    tokens.push({ kind: "number", value: Number(match[0]) })
    index += match[0].length
  }
  return tokens
}

// Returns the value of "12+7*2"-style input, or null when it is incomplete
// or invalid. Multiplication binds tighter than addition and subtraction.
export function evaluateExpression(text: string): number | null {
  const normalized = text.replace(/×/g, "*").replace(/[−–]/g, "-")
  if (normalized.trim() === "" || normalized.length > MAX_EXPRESSION_LENGTH) return null
  const tokens = tokenize(normalized)
  if (!tokens || tokens.length === 0) return null

  let position = 0
  const peek = () => tokens[position]

  function factor(): number | null {
    let sign = 1
    while (peek()?.kind === "op" && peek()?.value === "-") { sign = -sign; position += 1 }
    const token = peek()
    if (token?.kind !== "number") return null
    position += 1
    return sign * token.value
  }

  function term(): number | null {
    let value = factor()
    if (value === null) return null
    while (peek()?.kind === "op" && peek()?.value === "*") {
      position += 1
      const next = factor()
      if (next === null) return null
      value *= next
    }
    return value
  }

  let total = term()
  if (total === null) return null
  while (peek()?.kind === "op" && (peek()?.value === "+" || peek()?.value === "-")) {
    const op = peek()!.value
    position += 1
    const next = term()
    if (next === null) return null
    total = op === "+" ? total + next : total - next
  }
  if (position !== tokens.length) return null
  // Keep sums like 0.1+0.2 tidy.
  const rounded = Math.round(total * 1e6) / 1e6
  return Number.isFinite(rounded) ? rounded : null
}

// Apply one key press to the expression being typed.
export function applyKey(text: string, key: MathKey): string {
  if (key === "clear") return ""
  if (key === "backspace") return text.slice(0, -1)
  if (text.length >= MAX_EXPRESSION_LENGTH) return text
  const last = text.at(-1) ?? ""
  if (OPERATORS.has(key)) {
    if (text === "") return key === "-" ? "-" : text
    if (OPERATORS.has(last)) {
      // "5*-" is a negative factor; otherwise the new operator replaces the old.
      if (key === "-" && last === "*") return text + key
      return text.slice(0, -1) + key
    }
    return text + key
  }
  if (key === ".") {
    const current = text.split(/[+\-*]/).at(-1) ?? ""
    if (current.includes(".")) return text
    return text + (current === "" ? "0." : ".")
  }
  return text + key
}

// What a screen reader hears for the expression, e.g. "12 plus 7 times 2".
export function speakExpression(text: string): string {
  return text
    .replace(/\*/g, " times ")
    .replace(/\+/g, " plus ")
    .replace(/(\d)-/g, "$1 minus ")
    .replace(/^-/, "minus ")
    .replace(/\s+/g, " ")
    .trim()
}

export function displayExpression(text: string): string {
  return text.replace(/\*/g, "×").replace(/-/g, "−")
}

export function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : String(Math.round(value * 1000) / 1000)
}
