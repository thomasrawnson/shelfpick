import type { LiveTimer } from "./api/client"

export function elapsedSeconds(timer: LiveTimer, nowMs = Date.now()): number {
  if (timer.status !== "running" || !timer.running_since) return timer.elapsed_seconds
  const serverSnapshotMs = Date.parse(timer.running_since) + Math.max(0, timer.elapsed_seconds - timer.accumulated_seconds) * 1000
  return timer.elapsed_seconds + Math.max(0, Math.floor((nowMs - serverSnapshotMs) / 1000))
}

export function formatElapsed(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds))
  const hours = Math.floor(safe / 3600)
  const minutes = Math.floor((safe % 3600) / 60)
  const remainder = safe % 60
  return [hours, minutes, remainder].map(value => String(value).padStart(2, "0")).join(":")
}
