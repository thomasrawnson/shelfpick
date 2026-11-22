import { isNativeTransportError, reportReachable, reportUnreachable, RequestTimeoutError } from "../offline/connectivity.ts"

export class SessionExpiredError extends Error {
  constructor() { super("Your session has expired. Please log in again.") }
}

export class FieldValidationError extends Error {
  fields: Record<string, string>
  constructor(fields: Record<string, string>) {
    super("Check the highlighted fields.")
    this.fields = fields
  }
}

// Bound headers AND response body. Never automatically replay a mutation.
export async function request(
  url: string,
  options: RequestInit = {},
  timeoutMs = 30_000,
): Promise<Response> {
  const controller = new AbortController()
  let timer: ReturnType<typeof setTimeout> | undefined
  const abort = () => controller.abort(options.signal?.reason)
  options.signal?.addEventListener("abort", abort, { once: true })
  if (options.signal?.aborted) abort()
  try {
    return await Promise.race([
      (async () => {
        const response = await fetch(url, { ...options, signal: controller.signal })
        const body = await response.arrayBuffer()
        reportReachable()
        return new Response(response.status === 204 || response.status === 205 || response.status === 304 ? null : body, {
          status: response.status, statusText: response.statusText, headers: response.headers,
        })
      })(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          reportUnreachable()
          reject(new RequestTimeoutError(options.method && options.method !== "GET"
            ? "This request took too long. It may have completed. Check the current state before trying again."
            : "This request took too long. Please try again."))
          controller.abort()
        }, timeoutMs)
      }),
    ])
  } catch (error) {
    if (error instanceof TypeError || isNativeTransportError(error)) {
      reportUnreachable()
      throw new Error("Couldn't connect to ShelfPick. Check your connection and try again.", { cause: error })
    }
    throw error
  } finally {
    clearTimeout(timer)
    options.signal?.removeEventListener("abort", abort)
  }
}

export async function responseError(response: Response, fallback: string): Promise<Error> {
  try {
    const data = await response.json()
    if (Array.isArray(data.detail)) {
      const fields: Record<string, string> = {}
      for (const issue of data.detail) {
        const field = issue.loc?.at(-1)
        if (["email", "display_name", "password"].includes(field) && typeof issue.msg === "string") {
          fields[field] = issue.msg
        }
      }
      if (Object.keys(fields).length) return new FieldValidationError(fields)
    }
    if (typeof data.detail === "string") return new Error(data.detail)
  } catch { /* Keep the safe fallback. */ }
  return new Error(fallback)
}
