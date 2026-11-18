import { useEffect, useState } from "react"

type Result<T> = { key: string; data: T | null; error: Error | null }

// Loads one stats resource. `key` must change whenever the request does; the
// request in flight is aborted when it does, and `retry` repeats it.
export function useStats<T>(key: string, load: (signal: AbortSignal) => Promise<T>) {
  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState<Result<T> | null>(null)
  const fullKey = `${key}#${attempt}`

  useEffect(() => {
    const controller = new AbortController()
    load(controller.signal).then(
      data => setResult({ key: fullKey, data, error: null }),
      (error: unknown) => {
        if (!controller.signal.aborted) {
          setResult({ key: fullKey, data: null, error: error instanceof Error ? error : new Error("Request failed") })
        }
      },
    )
    return () => controller.abort()
    // `load` is a fresh closure each render; `fullKey` identifies the request.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fullKey])

  const current = result?.key === fullKey ? result : null
  return {
    data: current?.data ?? null,
    error: current?.error ?? null,
    loading: current === null,
    retry: () => setAttempt(value => value + 1),
  }
}
