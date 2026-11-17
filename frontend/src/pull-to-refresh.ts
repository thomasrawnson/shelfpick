export const PULL_TRIGGER_PX = 56
export const PULL_MAX_PX = 88

// Finger travel is damped so the indicator follows the pull without running away.
export function pullOffset(startY: number, currentY: number): number {
  const travel = currentY - startY
  return travel > 0 ? Math.min(travel * 0.5, PULL_MAX_PX) : 0
}

export function shouldRefresh(offset: number): boolean {
  return offset >= PULL_TRIGGER_PX
}
