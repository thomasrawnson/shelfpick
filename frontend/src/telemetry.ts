type ErrorSink = (event: { area: "react_render" }) => void

let errorSink: ErrorSink | null = null

export function setErrorSink(sink: ErrorSink | null): void {
  errorSink = sink
}

export function captureClientError(_error: unknown, area: "react_render"): void {
  try {
    errorSink?.({ area })
  } catch {
    // Monitoring must never break the fallback UI.
  }
}
