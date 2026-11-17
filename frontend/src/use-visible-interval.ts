import { useEffect, useRef } from "react"

type VisibilityDocument = Pick<
  Document,
  "hidden" | "addEventListener" | "removeEventListener"
>

type Timers = Pick<Window, "setInterval" | "clearInterval">

/**
 * Runs `callback` every `intervalMs` while the document is visible. The timer
 * stops while the document is hidden. When it becomes visible again the
 * callback runs once straight away, then the interval resumes.
 * Returns a cleanup function.
 */
export function startVisibleInterval(
  callback: () => void,
  intervalMs: number,
  doc: VisibilityDocument = document,
  timers: Timers = window,
): () => void {
  let handle: number | null = null

  const start = () => {
    if (handle === null) handle = timers.setInterval(callback, intervalMs)
  }
  const stop = () => {
    if (handle !== null) {
      timers.clearInterval(handle)
      handle = null
    }
  }
  const onVisibilityChange = () => {
    if (doc.hidden) {
      stop()
    } else if (handle === null) {
      callback()
      start()
    }
  }

  doc.addEventListener("visibilitychange", onVisibilityChange)
  if (!doc.hidden) start()

  return () => {
    doc.removeEventListener("visibilitychange", onVisibilityChange)
    stop()
  }
}

/**
 * Calls `callback` every `intervalMs` while `enabled` and the page is visible.
 * Always calls the latest `callback`.
 */
export function useVisibleInterval(
  callback: () => void,
  intervalMs: number,
  enabled: boolean,
) {
  const latest = useRef(callback)
  useEffect(() => {
    latest.current = callback
  })

  useEffect(() => {
    if (!enabled) return
    return startVisibleInterval(() => latest.current(), intervalMs)
  }, [enabled, intervalMs])
}
