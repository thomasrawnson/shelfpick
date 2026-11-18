import { useEffect, useRef, type ReactNode } from "react"
import { createPortal } from "react-dom"

// A full-screen sheet over the app. The tab bar and page behind it are inert.
function Sheet({ labelledBy, onEscape, children }: { labelledBy: string; onEscape: () => void; children: ReactNode }) {
  const sheet = useRef<HTMLDivElement>(null)
  const escape = useRef(onEscape)
  useEffect(() => { escape.current = onEscape })

  useEffect(() => {
    const root = document.getElementById("root")
    const previous = document.activeElement as HTMLElement | null
    document.documentElement.classList.add("play-sheet-open")
    if (root) root.inert = true
    sheet.current?.focus()
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") escape.current() }
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("keydown", onKey)
      document.documentElement.classList.remove("play-sheet-open")
      if (root) root.inert = false
      previous?.focus?.()
    }
  }, [])

  const content = (
    <div className="play-sheet-layer">
      <div ref={sheet} className="play-sheet" role="dialog" aria-modal="true" aria-labelledby={labelledBy} tabIndex={-1}>
        {children}
      </div>
    </div>
  )
  return typeof document === "undefined" ? content : createPortal(content, document.body)
}

export default Sheet
