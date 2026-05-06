type ValidateResult =
  | { ok: true }
  | {
      ok: false
      error: string
    }

export const isPrivateHost = (host: string) => {
  const normalized = host.toLowerCase()

  return (
    normalized === "localhost" ||
    normalized.startsWith("127.") ||
    normalized.startsWith("10.") ||
    normalized.startsWith("192.168.") ||
    normalized.startsWith("169.254.") ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(normalized)
  )
}

export const validateHttpUrl = (raw: string): ValidateResult => {
  try {
    const url = new URL(raw)

    if (!["http:", "https:"].includes(url.protocol)) {
      return { ok: false, error: "Only HTTP and HTTPS are supported" }
    }

    if (isPrivateHost(url.hostname)) {
      return { ok: false, error: "Private network targets are blocked" }
    }

    return { ok: true }
  } catch {
    return { ok: false, error: "Invalid URL" }
  }
}

export const validateTcpTarget = (host: string, port: number): ValidateResult => {
  if (!host || host.length < 1) {
    return { ok: false, error: "Host is required" }
  }

  if (isPrivateHost(host)) {
    return { ok: false, error: "Private network targets are blocked" }
  }

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    return { ok: false, error: "Port must be between 1 and 65535" }
  }

  return { ok: true }
}

export const validateMonitorTiming = (
  intervalSeconds: number,
  timeoutMs: number
): ValidateResult => {
  if (!Number.isInteger(intervalSeconds) || intervalSeconds < 30 || intervalSeconds > 3600) {
    return { ok: false, error: "Interval must be between 30 and 3600 seconds" }
  }

  if (!Number.isInteger(timeoutMs) || timeoutMs < 500 || timeoutMs > 30000) {
    return { ok: false, error: "Timeout must be between 500 and 30000 ms" }
  }

  return { ok: true }
}
