import { useEffect, useRef, useState } from "react"

import { lightImpact } from "./haptics"
import { pullOffset, shouldRefresh } from "./pull-to-refresh"

// Pull down from the top of the page to refresh. Uses passive touch listeners, so
// native scrolling is untouched; nothing happens unless the page is already at the top.
export function usePullToRefresh(onRefresh: () => Promise<unknown> | void, enabled = true) {
  const [offset, setOffset] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const startY = useRef<number | null>(null)
  const current = useRef(0)
  const busy = useRef(false)
  const refresh = useRef(onRefresh)

  useEffect(() => { refresh.current = onRefresh }, [onRefresh])

  useEffect(() => {
    if (!enabled) return
    function onStart(event: TouchEvent) {
      const atTop = (document.scrollingElement?.scrollTop ?? window.scrollY) <= 0
      startY.current = atTop && !busy.current ? event.touches[0]?.clientY ?? null : null
    }
    function onMove(event: TouchEvent) {
      if (startY.current === null) return
      const next = pullOffset(startY.current, event.touches[0]?.clientY ?? startY.current)
      current.current = next
      setOffset(next)
    }
    async function onEnd() {
      const wasPulling = startY.current !== null
      startY.current = null
      if (!wasPulling) return
      const trigger = shouldRefresh(current.current)
      current.current = 0
      if (!trigger) { setOffset(0); return }
      busy.current = true
      setRefreshing(true)
      void lightImpact()
      try { await refresh.current() } finally {
        busy.current = false
        setRefreshing(false)
        setOffset(0)
      }
    }
    window.addEventListener("touchstart", onStart, { passive: true })
    window.addEventListener("touchmove", onMove, { passive: true })
    window.addEventListener("touchend", onEnd)
    window.addEventListener("touchcancel", onEnd)
    return () => {
      window.removeEventListener("touchstart", onStart)
      window.removeEventListener("touchmove", onMove)
      window.removeEventListener("touchend", onEnd)
      window.removeEventListener("touchcancel", onEnd)
    }
  }, [enabled])

  return { offset, refreshing }
}
