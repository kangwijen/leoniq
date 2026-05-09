/** @jest-environment node */
jest.mock("@/lib/session", () => ({
  requireSession: jest.fn(),
}))

jest.mock("@/lib/monitor/repository", () => ({
  monitorRepository: {
    getById: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
}))

import { NextResponse } from "next/server"
import { DELETE, GET, PATCH } from "@/app/api/monitors/[id]/route"
import { monitorRepository } from "@/lib/monitor/repository"
import { requireSession } from "@/lib/session"

const mockedRequireSession = requireSession as jest.MockedFunction<typeof requireSession>
const mockedGetById = monitorRepository.getById as jest.MockedFunction<typeof monitorRepository.getById>
const mockedUpdate = monitorRepository.update as jest.MockedFunction<typeof monitorRepository.update>
const mockedDelete = monitorRepository.delete as jest.MockedFunction<typeof monitorRepository.delete>

const sessionPayload = {
  user: { id: "user-1", email: "u@example.com", emailVerified: true, createdAt: new Date(), updatedAt: new Date() },
  session: { id: "s1", userId: "user-1", expiresAt: new Date(), token: "t" },
}

const baseMonitor = {
  id: "m1",
  userId: "user-1",
  name: "API",
  type: "http" as const,
  url: "https://example.com",
  host: null,
  port: null,
  method: "GET",
  expectedStatusMin: 200,
  expectedStatusMax: 399,
  intervalSeconds: 60,
  timeoutMs: 5000,
  retries: 1,
  active: true,
  tags: [] as string[],
  createdAt: new Date(),
  updatedAt: new Date(),
  lastCheckedAt: null as Date | null,
  lastStatus: null as "up" | "down" | null,
  lastLatencyMs: null as number | null,
}

describe("app/api/monitors/[id]/route", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockedRequireSession.mockResolvedValue(sessionPayload as never)
  })

  const segment = { params: Promise.resolve({ id: "m1" }) }

  it("GET returns 404 when monitor missing", async () => {
    const getByIdMock = mockedGetById as jest.Mock
    getByIdMock.mockResolvedValue(null)
    const res = await GET(new Request("http://localhost/api/monitors/m1"), segment)
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: "Not found" })
  })

  it("GET returns monitor", async () => {
    mockedGetById.mockResolvedValue(baseMonitor as never)
    const res = await GET(new Request("http://localhost/api/monitors/m1"), segment)
    expect(res).toBeInstanceOf(NextResponse)
    expect(await res.json()).toEqual(JSON.parse(JSON.stringify({ data: baseMonitor })))
  })

  it("PATCH returns 404 when monitor missing", async () => {
    const getByIdMock = mockedGetById as jest.Mock
    getByIdMock.mockResolvedValue(null)
    const req = new Request("http://localhost/api/monitors/m1", {
      method: "PATCH",
      body: JSON.stringify({ name: "x" }),
    })
    const res = await PATCH(req, segment)
    expect(res.status).toBe(404)
  })

  it("PATCH rejects invalid timing", async () => {
    mockedGetById.mockResolvedValue(baseMonitor as never)
    const req = new Request("http://localhost/api/monitors/m1", {
      method: "PATCH",
      body: JSON.stringify({
        intervalSeconds: 10,
        timeoutMs: 5000,
      }),
    })
    const res = await PATCH(req, segment)
    expect(res.status).toBe(400)
  })

  it("PATCH rejects invalid http url after switching type", async () => {
    mockedGetById.mockResolvedValue({
      ...baseMonitor,
      type: "tcp",
      host: "example.com",
      port: 443,
      url: null,
    } as never)
    const req = new Request("http://localhost/api/monitors/m1", {
      method: "PATCH",
      body: JSON.stringify({
        type: "http",
        url: "http://127.0.0.1",
      }),
    })
    const res = await PATCH(req, segment)
    expect(res.status).toBe(400)
  })

  it("PATCH rejects tcp validation when type tcp", async () => {
    mockedGetById.mockResolvedValue({
      ...baseMonitor,
      type: "tcp",
      url: null,
      host: "example.com",
      port: 443,
    } as never)
    const req = new Request("http://localhost/api/monitors/m1", {
      method: "PATCH",
      body: JSON.stringify({
        host: "",
        port: 443,
      }),
    })
    const res = await PATCH(req, segment)
    expect(res.status).toBe(400)
  })

  it("PATCH passes undefined tags when tags not an array", async () => {
    mockedGetById.mockResolvedValue(baseMonitor as never)
    mockedUpdate.mockResolvedValue({ ...baseMonitor, tags: undefined } as never)
    const req = new Request("http://localhost/api/monitors/m1", {
      method: "PATCH",
      body: JSON.stringify({
        tags: "not-array",
      }),
    })
    const res = await PATCH(req, segment)
    expect(res.status).toBe(200)
    expect(mockedUpdate).toHaveBeenCalledWith(
      "m1",
      "user-1",
      expect.objectContaining({
        tags: undefined,
      })
    )
  })

  it("PATCH parses tags array", async () => {
    mockedGetById.mockResolvedValue(baseMonitor as never)
    mockedUpdate.mockResolvedValue({ ...baseMonitor, tags: ["a"] } as never)
    const req = new Request("http://localhost/api/monitors/m1", {
      method: "PATCH",
      body: JSON.stringify({
        tags: [" A ", "a"],
      }),
    })
    const res = await PATCH(req, segment)
    expect(res.status).toBe(200)
    expect(mockedUpdate).toHaveBeenCalledWith(
      "m1",
      "user-1",
      expect.objectContaining({
        tags: ["a"],
      })
    )
  })

  it("PATCH coerces port from string and keeps monitor defaults", async () => {
    mockedGetById.mockResolvedValue({
      ...baseMonitor,
      type: "tcp",
      url: null,
      host: "example.com",
      port: 443,
    } as never)
    mockedUpdate.mockResolvedValue({
      ...baseMonitor,
      port: 8443,
    } as never)

    const req = new Request("http://localhost/api/monitors/m1", {
      method: "PATCH",
      body: JSON.stringify({
        port: "8443",
      }),
    })
    const res = await PATCH(req, segment)
    expect(res.status).toBe(200)
    expect(mockedUpdate).toHaveBeenCalledWith(
      "m1",
      "user-1",
      expect.objectContaining({
        port: 8443,
      })
    )
  })

  it("PATCH applies string method, boolean active, and numeric retries", async () => {
    mockedGetById.mockResolvedValue(baseMonitor as never)
    mockedUpdate.mockResolvedValue({
      ...baseMonitor,
      method: "POST",
      active: false,
      retries: 2,
    } as never)
    const req = new Request("http://localhost/api/monitors/m1", {
      method: "PATCH",
      body: JSON.stringify({
        method: "POST",
        active: false,
        retries: 2,
      }),
    })
    const res = await PATCH(req, segment)
    expect(res.status).toBe(200)
    expect(mockedUpdate).toHaveBeenCalledWith(
      "m1",
      "user-1",
      expect.objectContaining({
        method: "POST",
        active: false,
        retries: 2,
      })
    )
  })

  it("PATCH applies numeric expected status bounds from body", async () => {
    mockedGetById.mockResolvedValue(baseMonitor as never)
    mockedUpdate.mockResolvedValue({
      ...baseMonitor,
      expectedStatusMin: 201,
      expectedStatusMax: 404,
    } as never)
    const req = new Request("http://localhost/api/monitors/m1", {
      method: "PATCH",
      body: JSON.stringify({
        expectedStatusMin: 201,
        expectedStatusMax: 404,
      }),
    })
    const res = await PATCH(req, segment)
    expect(res.status).toBe(200)
    expect(mockedUpdate).toHaveBeenCalledWith(
      "m1",
      "user-1",
      expect.objectContaining({
        expectedStatusMin: 201,
        expectedStatusMax: 404,
      })
    )
  })

  it("PATCH uses numeric overrides for interval and timeout", async () => {
    mockedGetById.mockResolvedValue(baseMonitor as never)
    mockedUpdate.mockResolvedValue(baseMonitor as never)
    const req = new Request("http://localhost/api/monitors/m1", {
      method: "PATCH",
      body: JSON.stringify({
        intervalSeconds: 120,
        timeoutMs: 6000,
      }),
    })
    const res = await PATCH(req, segment)
    expect(res.status).toBe(200)
    expect(mockedUpdate).toHaveBeenCalledWith(
      "m1",
      "user-1",
      expect.objectContaining({
        intervalSeconds: 120,
        timeoutMs: 6000,
      })
    )
  })

  it("PATCH returns 404 when update yields no row", async () => {
    mockedGetById.mockResolvedValue(baseMonitor as never)
    const updateMock = mockedUpdate as jest.Mock
    updateMock.mockResolvedValue(null)
    const req = new Request("http://localhost/api/monitors/m1", {
      method: "PATCH",
      body: JSON.stringify({ name: "Renamed" }),
    })
    const res = await PATCH(req, segment)
    expect(res.status).toBe(404)
  })

  it("DELETE returns 404 when monitor missing", async () => {
    const deleteMock = mockedDelete as jest.Mock
    deleteMock.mockResolvedValue(null)
    const res = await DELETE(new Request("http://localhost/api/monitors/m1"), segment)
    expect(res.status).toBe(404)
  })

  it("DELETE removes monitor", async () => {
    mockedDelete.mockResolvedValue(baseMonitor as never)
    const res = await DELETE(new Request("http://localhost/api/monitors/m1"), segment)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual(JSON.parse(JSON.stringify({ data: baseMonitor })))
  })
})
