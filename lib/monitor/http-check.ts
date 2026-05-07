import { validateHttpUrl } from "./validation"

export type HttpCheckInput = {
  url: string
  method: string
  timeoutMs: number
  expectedStatusMin: number
  expectedStatusMax: number
}

export type CheckResult = {
  status: "up" | "down"
  latencyMs: number
  statusCode?: number
  errorMessage?: string
  meta?: Record<string, unknown>
}

export const runHttpCheck = async (input: HttpCheckInput): Promise<CheckResult> => {
  const validation = validateHttpUrl(input.url)

  if (!validation.ok) {
    return {
      status: "down",
      latencyMs: 0,
      errorMessage: validation.error,
    }
  }

  const startedAt = Date.now()

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), input.timeoutMs)

    const response = await fetch(input.url, {
      method: input.method,
      signal: controller.signal,
      cache: "no-store",
    })

    clearTimeout(timeout)
    const latencyMs = Date.now() - startedAt
    const contentLengthHeader = response.headers.get("content-length")
    const responseBytes = contentLengthHeader ? Number(contentLengthHeader) : null
    const serverHeader = response.headers.get("server")
    const cacheHeader = response.headers.get("cache-control")
    const isUp =
      response.status >= input.expectedStatusMin &&
      response.status <= input.expectedStatusMax

    return {
      status: isUp ? "up" : "down",
      latencyMs,
      statusCode: response.status,
      errorMessage: isUp ? undefined : `Unexpected status ${response.status}`,
      meta: {
        protocol: "http",
        method: input.method,
        responseBytes: Number.isFinite(responseBytes) ? responseBytes : null,
        serverHeader,
        cacheHeader,
        ok: response.ok,
      },
    }
  } catch (error) {
    const latencyMs = Date.now() - startedAt
    const message = error instanceof Error ? error.message : "Request failed"

    return {
      status: "down",
      latencyMs,
      errorMessage: message,
      meta: {
        protocol: "http",
        method: input.method,
      },
    }
  }
}
