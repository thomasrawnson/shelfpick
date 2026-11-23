import { useEffect, useId, useRef, type ReactNode } from "react"
import { createPortal } from "react-dom"

type Props = {
  title: string
  children: ReactNode
  confirmLabel: string
  busyLabel: string
  busy: boolean
  onConfirm: () => void
  onCancel: () => void
}

// A small bottom sheet that asks before something is removed (SP-UI-05). It names what is affected, defaults focus to
// Cancel, closes on Escape or a tap outside, and makes the page behind it inert. The confirm button uses the danger colour.
function ConfirmSheet({ title, children, confirmLabel, busyLabel, busy, onConfirm, onCancel }: Props) {
  const titleId = useId()
  const bodyId = useId()
  const cancel = useRef<HTMLButtonElement>(null)
  const dismiss = useRef(onCancel)
  const working = useRef(busy)
  useEffect(() => {
    dismiss.current = onCancel
    working.current = busy
  })

  useEffect(() => {
    const root = document.getElementById("root")
    const previous = document.activeElement as HTMLElement | null
    if (root) root.inert = true
    cancel.current?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !working.current) dismiss.current()
    }
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("keydown", onKey)
      if (root) root.inert = false
      previous?.focus?.()
    }
  }, [])

  return createPortal(
    <div className="confirm-layer" onClick={(event) => { if (event.target === event.currentTarget && !busy) onCancel() }}>
      <div className="confirm-sheet" role="alertdialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={bodyId}>
        <h2 id={titleId}>{title}</h2>
        <p id={bodyId}>{children}</p>
        <div className="confirm-actions">
          <button type="button" ref={cancel} className="secondary-button" disabled={busy} onClick={onCancel}>Cancel</button>
          <button type="button" className="confirm-danger" disabled={busy} onClick={onConfirm}>{busy ? busyLabel : confirmLabel}</button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

export default ConfirmSheet
