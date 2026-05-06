import { runHttpCheck } from "../lib/monitor/http-check"

describe("runHttpCheck", () => {
  it("returns validation error for blocked private target", async () => {
    const result = await runHttpCheck({
      url: "http://localhost:3000/health",
      method: "GET",
      timeoutMs: 1000,
      expectedStatusMin: 200,
      expectedStatusMax: 299,
    })

    expect(result).toEqual({
      status: "down",
      latencyMs: 0,
      errorMessage: "Private network targets are blocked",
    })
  })

  it("returns validation error for invalid URL", async () => {
    const result = await runHttpCheck({
      url: "not-a-url",
      method: "GET",
      timeoutMs: 1000,
      expectedStatusMin: 200,
      expectedStatusMax: 299,
    })

    expect(result).toEqual({
      status: "down",
      latencyMs: 0,
      errorMessage: "Invalid URL",
    })
  })

  it("returns up when fetch status is in expected range", async () => {
    const originalFetch = global.fetch
    global.fetch = jest.fn().mockResolvedValue({
      status: 204,
    } as Response)

    const result = await runHttpCheck({
      url: "https://example.com/health",
      method: "GET",
      timeoutMs: 1000,
      expectedStatusMin: 200,
      expectedStatusMax: 299,
    })

    expect(result.status).toBe("up")
    expect(result.statusCode).toBe(204)
    expect(result.errorMessage).toBeUndefined()
    expect(result.latencyMs).toBeGreaterThanOrEqual(0)

    global.fetch = originalFetch
  })

  it("returns down when status is outside expected range", async () => {
    const originalFetch = global.fetch
    global.fetch = jest.fn().mockResolvedValue({
      status: 503,
    } as Response)

    const result = await runHttpCheck({
      url: "https://example.com/health",
      method: "GET",
      timeoutMs: 1000,
      expectedStatusMin: 200,
      expectedStatusMax: 299,
    })

    expect(result).toMatchObject({
      status: "down",
      statusCode: 503,
      errorMessage: "Unexpected status 503",
    })

    global.fetch = originalFetch
  })

  it("returns down with thrown fetch error message", async () => {
    const originalFetch = global.fetch
    global.fetch = jest.fn().mockRejectedValue(new Error("Network down"))

    const result = await runHttpCheck({
      url: "https://example.com/health",
      method: "GET",
      timeoutMs: 1000,
      expectedStatusMin: 200,
      expectedStatusMax: 299,
    })

    expect(result).toMatchObject({
      status: "down",
      errorMessage: "Network down",
    })

    global.fetch = originalFetch
  })

  it("returns generic error when fetch throws non Error value", async () => {
    const originalFetch = global.fetch
    global.fetch = jest.fn().mockRejectedValue("unexpected")

    const result = await runHttpCheck({
      url: "https://example.com/health",
      method: "GET",
      timeoutMs: 1000,
      expectedStatusMin: 200,
      expectedStatusMax: 299,
    })

    expect(result).toMatchObject({
      status: "down",
      errorMessage: "Request failed",
    })

    global.fetch = originalFetch
  })
})
