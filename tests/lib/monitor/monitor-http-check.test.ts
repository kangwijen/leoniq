import { runHttpCheck } from "@/lib/monitor/http-check"

const makeResponse = (status: number, headers?: Record<string, string>, bodyBytes?: number) =>
  ({
    status,
    ok: status >= 200 && status <= 299,
    headers: {
      get: (name: string) => headers?.[name.toLowerCase()] ?? null,
    },
    clone: () => ({
      arrayBuffer: async () => new ArrayBuffer(bodyBytes ?? 0),
    }),
  }) as Response

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
    global.fetch = jest.fn().mockResolvedValue(
      makeResponse(204, {
        "content-length": "1234",
        server: "nginx",
        "cache-control": "max-age=60",
      })
    )

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
    expect(result.meta).toMatchObject({
      protocol: "http",
      method: "GET",
      responseBytes: 1234,
      serverHeader: "nginx",
      cacheHeader: "max-age=60",
      ok: true,
    })

    global.fetch = originalFetch
  })

  it("returns down when status is outside expected range", async () => {
    const originalFetch = global.fetch
    global.fetch = jest.fn().mockResolvedValue(makeResponse(503))

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
    expect(result.meta).toMatchObject({
      protocol: "http",
      method: "GET",
      responseBytes: null,
      ok: false,
    })

    global.fetch = originalFetch
  })

  it("falls back to measured body bytes when content-length is missing", async () => {
    const originalFetch = global.fetch
    global.fetch = jest.fn().mockResolvedValue(makeResponse(200, undefined, 256))

    const result = await runHttpCheck({
      url: "https://example.com/health",
      method: "GET",
      timeoutMs: 1000,
      expectedStatusMin: 200,
      expectedStatusMax: 299,
    })

    expect(result.status).toBe("up")
    expect(result.meta).toMatchObject({
      protocol: "http",
      method: "GET",
      responseBytes: 256,
      ok: true,
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
    expect(result.meta).toMatchObject({
      protocol: "http",
      method: "GET",
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
    expect(result.meta).toMatchObject({
      protocol: "http",
      method: "GET",
    })

    global.fetch = originalFetch
  })
})
