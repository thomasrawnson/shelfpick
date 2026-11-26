import { useEffect } from "react"
import { createPortal } from "react-dom"

type Props = {
  message: string
  onUndo: () => void
  onExpire: () => void
  // Milliseconds before the toast goes away.
  duration?: number
}

// A brief "Hidden … Undo" notice above the tab bar. It is a polite live region, and Undo is a 44pt button. It is
// rendered on the page body: inside a screen it would be positioned against the screen's animated wrapper.
function UndoToast({ message, onUndo, onExpire, duration = 7000 }: Props) {
  useEffect(() => {
    const timer = window.setTimeout(onExpire, duration)
    return () => window.clearTimeout(timer)
  }, [message, duration, onExpire])

  return createPortal(
    <div className="undo-toast" role="status">
      <span>{message}</span>
      <button type="button" onClick={onUndo}>Undo</button>
    </div>,
    document.body,
  )
}

export default UndoToast
