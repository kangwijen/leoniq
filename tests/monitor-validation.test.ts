import {
  validateHttpUrl,
  validateMonitorTiming,
  validateTcpTarget,
} from "../lib/monitor/validation"

describe("validateHttpUrl", () => {
  it("accepts public https url", () => {
    const result = validateHttpUrl("https://example.com/health")
    expect(result).toEqual({ ok: true })
  })

  it("blocks private localhost", () => {
    const result = validateHttpUrl("http://127.0.0.1:3000")
    expect(result).toEqual({
      ok: false,
      error: "Private network targets are blocked",
    })
  })

  it("rejects non-http protocols", () => {
    const result = validateHttpUrl("ftp://example.com")
    expect(result).toEqual({
      ok: false,
      error: "Only HTTP and HTTPS are supported",
    })
  })
})

describe("validateTcpTarget", () => {
  it("blocks invalid port", () => {
    const result = validateTcpTarget("example.com", 70000)
    expect(result).toEqual({
      ok: false,
      error: "Port must be between 1 and 65535",
    })
  })

  it("requires host", () => {
    const result = validateTcpTarget("", 443)
    expect(result).toEqual({
      ok: false,
      error: "Host is required",
    })
  })
})

describe("validateMonitorTiming", () => {
  it("enforces bounds", () => {
    expect(validateMonitorTiming(20, 1000)).toEqual({
      ok: false,
      error: "Interval must be between 30 and 3600 seconds",
    })
    expect(validateMonitorTiming(60, 400)).toEqual({
      ok: false,
      error: "Timeout must be between 500 and 30000 ms",
    })
    expect(validateMonitorTiming(60, 5000)).toEqual({ ok: true })
  })
})
