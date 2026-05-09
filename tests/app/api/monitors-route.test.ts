/** @jest-environment node */
jest.mock("@/lib/session", () => ({
  requireSession: jest.fn(),
}))

jest.mock("@/lib/monitor/repository", () => ({
  monitorRepository: {
    list: jest.fn(),
    create: jest.fn(),
  },
}))

jest.mock("@/lib/monitor/executor", () => ({
  executeAndPersistMonitorCheck: jest.fn(),
}))

import { NextResponse } from "next/server"
import { GET, POST } from "@/app/api/monitors/route"
import { executeAndPersistMonitorCheck } from "@/lib/monitor/executor"
import { monitorRepository } from "@/lib/monitor/repository"
import { requireSession } from "@/lib/session"

const mockedRequireSession = requireSession as jest.MockedFunction<typeof requireSession>
const mockedList = monitorRepository.list as jest.MockedFunction<typeof monitorRepository.list>
const mockedCreate = monitorRepository.create as jest.MockedFunction<typeof monitorRepository.create>
const mockedExecute = executeAndPersistMonitorCheck as jest.MockedFunction<
  typeof executeAndPersistMonitorCheck
>

describe("app/api/monitors/route", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockedRequireSession.mockResolvedValue({
      user: {
        id: "user-1",
        name: "User",
        email: "u@example.com",
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      session: {
        id: "s1",
        userId: "user-1",
        expiresAt: new Date(),
        token: "t",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    })
  })

  it("GET returns monitors for session user", async () => {
    const monitors = [{ id: "m1", name: "API" }]
    mockedList.mockResolvedValue(monitors as never)
    const res = await GET()
    const body = await res.json()
    expect(res).toBeInstanceOf(NextResponse)
    expect(mockedList).toHaveBeenCalledWith({ userId: "user-1" })
    expect(body).toEqual({ data: monitors })
  })

  it("POST rejects invalid JSON body", async () => {
    const req = new Request("http://localhost/api/monitors", {
      method: "POST",
      body: "not-json",
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: "Invalid payload" })
  })

  it("POST rejects non-object body", async () => {
    const req = new Request("http://localhost/api/monitors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(null),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it("POST rejects missing name or type", async () => {
    const req = new Request("http://localhost/api/monitors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "", type: null }),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: "name and type are required" })
  })

  it("POST rejects invalid timing", async () => {
    const req = new Request("http://localhost/api/monitors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Edge",
        type: "http",
        url: "https://example.com",
        intervalSeconds: 10,
        timeoutMs: 5000,
      }),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ error: expect.stringContaining("Interval") })
  })

  it("POST rejects invalid http url", async () => {
    const req = new Request("http://localhost/api/monitors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Edge",
        type: "http",
        url: "http://127.0.0.1",
        intervalSeconds: 60,
        timeoutMs: 5000,
      }),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it("POST rejects invalid tcp target", async () => {
    const req = new Request("http://localhost/api/monitors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Socket",
        type: "tcp",
        host: "",
        port: 443,
        intervalSeconds: 60,
        timeoutMs: 5000,
      }),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it("POST forwards string method to create", async () => {
    const created = {
      id: "mon-head",
      name: "API",
      type: "http" as const,
      url: "https://example.com",
      host: null,
      port: null,
      method: "HEAD",
      expectedStatusMin: 200,
      expectedStatusMax: 399,
      intervalSeconds: 60,
      timeoutMs: 5000,
      retries: 1,
      tags: [],
    }
    mockedCreate.mockResolvedValue(created as never)
    mockedExecute.mockResolvedValue({ status: "up", latencyMs: 1 } as never)

    const req = new Request("http://localhost/api/monitors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "API",
        type: "http",
        url: "https://example.com",
        intervalSeconds: 60,
        timeoutMs: 5000,
        method: "HEAD",
      }),
    })

    const res = await POST(req)
    expect(res.status).toBe(201)
    expect(mockedCreate).toHaveBeenCalledWith(expect.objectContaining({ method: "HEAD" }))
  })

  it("POST creates http monitor, parses tags, and tolerates initial check failure", async () => {
    const created = {
      id: "mon-new",
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
      tags: ["edge"],
    }
    mockedCreate.mockResolvedValue(created as never)
    mockedExecute.mockRejectedValue(new Error("network"))

    const spy = jest.spyOn(console, "error").mockImplementation(() => {})

    const req = new Request("http://localhost/api/monitors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "API",
        type: "http",
        url: "https://example.com",
        intervalSeconds: 60,
        timeoutMs: 5000,
        retries: 2,
        tags: [" Edge ", "edge", "TCP"],
      }),
    })

    const res = await POST(req)
    spy.mockRestore()

    expect(res.status).toBe(201)
    expect(mockedCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        type: "http",
        tags: ["edge", "tcp"],
        retries: 2,
      })
    )
    expect(mockedExecute).toHaveBeenCalledWith(created, "api")
  })

  it("POST applies defaults for non-string method and non-integer retries", async () => {
    const created = {
      id: "mon-d",
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
      tags: [],
    }
    mockedCreate.mockResolvedValue(created as never)
    mockedExecute.mockResolvedValue({ status: "up", latencyMs: 1 } as never)

    const req = new Request("http://localhost/api/monitors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "API",
        type: "http",
        url: "https://example.com",
        intervalSeconds: 60,
        timeoutMs: 5000,
        method: 123,
        retries: 1.7,
      }),
    })

    const res = await POST(req)
    expect(res.status).toBe(201)
    expect(mockedCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "GET",
        retries: 1,
      })
    )
  })

  it("POST treats non-string name as empty", async () => {
    const req = new Request("http://localhost/api/monitors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: 99,
        type: "http",
        url: "https://example.com",
        intervalSeconds: 60,
        timeoutMs: 5000,
      }),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: "name and type are required" })
  })

  it("POST creates tcp monitor", async () => {
    const created = {
      id: "mon-tcp",
      name: "DB",
      type: "tcp" as const,
      url: null,
      host: "example.com",
      port: 5432,
      method: "GET",
      expectedStatusMin: 200,
      expectedStatusMax: 399,
      intervalSeconds: 120,
      timeoutMs: 8000,
      retries: 1,
      tags: [],
    }
    mockedCreate.mockResolvedValue(created as never)
    mockedExecute.mockResolvedValue({ status: "up", latencyMs: 1 } as never)

    const req = new Request("http://localhost/api/monitors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "DB",
        type: "tcp",
        host: "example.com",
        port: 5432,
        intervalSeconds: 120,
        timeoutMs: 8000,
      }),
    })

    const res = await POST(req)
    expect(res.status).toBe(201)
    expect(mockedCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "tcp",
        host: "example.com",
        port: 5432,
        url: null,
      })
    )
  })
})
