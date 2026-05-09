/** @jest-environment node */
jest.mock("@/lib/db/client", () => ({
  db: {
    insert: jest.fn(),
    update: jest.fn(),
  },
}))

jest.mock("@/lib/monitor/http-check", () => ({
  runHttpCheck: jest.fn(),
}))

jest.mock("@/lib/monitor/tcp-check", () => ({
  runTcpCheck: jest.fn(),
}))

import { db } from "@/lib/db/client"
import { executeAndPersistMonitorCheck } from "@/lib/monitor/executor"
import { runHttpCheck } from "@/lib/monitor/http-check"
import { runTcpCheck } from "@/lib/monitor/tcp-check"

const mockedDb = db as unknown as {
  insert: jest.Mock
  update: jest.Mock
}

const mockedHttp = runHttpCheck as jest.MockedFunction<typeof runHttpCheck>
const mockedTcp = runTcpCheck as jest.MockedFunction<typeof runTcpCheck>

const baseMonitor = {
  id: "m1",
  userId: "u1",
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
  retries: 2,
  active: true,
  tags: [] as string[],
  createdAt: new Date(),
  updatedAt: new Date(),
  lastCheckedAt: null as Date | null,
  lastStatus: null as "up" | "down" | null,
  lastLatencyMs: null as number | null,
}

describe("executeAndPersistMonitorCheck", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockedDb.insert.mockReturnValue({
      values: jest.fn().mockResolvedValue(undefined),
    })
    mockedDb.update.mockReturnValue({
      set: jest.fn().mockReturnValue({
        where: jest.fn().mockResolvedValue(undefined),
      }),
    })
    jest.spyOn(console, "log").mockImplementation(() => {})
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it("runs http check and persists row", async () => {
    mockedHttp.mockResolvedValue({
      status: "up",
      latencyMs: 25,
      statusCode: 200,
    })

    const result = await executeAndPersistMonitorCheck(baseMonitor as never, "api")

    expect(result.status).toBe("up")
    expect(mockedHttp).toHaveBeenCalled()
    expect(mockedDb.insert).toHaveBeenCalledTimes(1)
    expect(mockedDb.update).toHaveBeenCalledTimes(1)
  })

  it("runs tcp check when monitor is tcp", async () => {
    const tcpMonitor = {
      ...baseMonitor,
      type: "tcp" as const,
      url: null,
      host: "example.com",
      port: 443,
    }
    mockedTcp.mockResolvedValue({
      status: "down",
      latencyMs: 10,
      errorMessage: "timeout",
    })

    await executeAndPersistMonitorCheck(tcpMonitor as never, "worker")

    expect(mockedTcp).toHaveBeenCalled()
    expect(mockedHttp).not.toHaveBeenCalled()
  })

  it("records invalid configuration as down", async () => {
    const badMonitor = {
      ...baseMonitor,
      type: "http" as const,
      url: null,
    }

    await executeAndPersistMonitorCheck(badMonitor as never, "api")

    const insertCall = mockedDb.insert.mock.results[0].value.values
    expect(insertCall).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "down",
        errorMessage: "Invalid monitor configuration",
      })
    )
  })

  it("retries until success when retries allow", async () => {
    mockedHttp
      .mockResolvedValueOnce({
        status: "down",
        latencyMs: 5,
        errorMessage: "fail",
      })
      .mockResolvedValueOnce({
        status: "up",
        latencyMs: 6,
        statusCode: 200,
      })

    const monitor = { ...baseMonitor, retries: 2 }
    const result = await executeAndPersistMonitorCheck(monitor as never, "api")

    expect(result.status).toBe("up")
    expect(mockedHttp).toHaveBeenCalledTimes(2)
  })
})
