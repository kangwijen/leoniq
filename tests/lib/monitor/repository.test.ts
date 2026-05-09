/** @jest-environment node */
jest.mock("@/lib/db/client", () => ({
  db: {
    select: jest.fn(),
    insert: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
}))

import { db } from "@/lib/db/client"
import {
  checkResultsRepository,
  monitorRepository,
} from "@/lib/monitor/repository"

const mockedDb = db as unknown as {
  select: jest.Mock
  insert: jest.Mock
  update: jest.Mock
  delete: jest.Mock
}

const monitorRow = {
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
  retries: 1,
  active: true,
  tags: [] as string[],
  createdAt: new Date(),
  updatedAt: new Date(),
  lastCheckedAt: null as Date | null,
  lastStatus: null as "up" | "down" | null,
  lastLatencyMs: null as number | null,
}

describe("monitorRepository", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("lists monitors ordered by createdAt desc", async () => {
    mockedDb.select.mockReturnValue({
      from: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnValue({
          orderBy: jest.fn().mockResolvedValue([monitorRow]),
        }),
      }),
    })

    const rows = await monitorRepository.list({ userId: "u1" })
    expect(rows).toEqual([monitorRow])
    expect(mockedDb.select).toHaveBeenCalledTimes(1)
  })

  it("returns monitor by id", async () => {
    mockedDb.select.mockReturnValue({
      from: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue([monitorRow]),
        }),
      }),
    })

    const row = await monitorRepository.getById("m1", "u1")
    expect(row).toEqual(monitorRow)
  })

  it("returns null when monitor missing", async () => {
    mockedDb.select.mockReturnValue({
      from: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue([]),
        }),
      }),
    })

    const row = await monitorRepository.getById("missing", "u1")
    expect(row).toBeNull()
  })

  it("creates monitor", async () => {
    mockedDb.insert.mockReturnValue({
      values: jest.fn().mockReturnValue({
        returning: jest.fn().mockResolvedValue([monitorRow]),
      }),
    })

    const created = await monitorRepository.create({
      userId: "u1",
      name: "API",
      type: "http",
      url: "https://example.com",
    })
    expect(created).toEqual(monitorRow)
  })

  it("create coalesces omitted url and host to null", async () => {
    const values = jest.fn().mockReturnValue({
      returning: jest.fn().mockResolvedValue([monitorRow]),
    })
    mockedDb.insert.mockReturnValue({ values })

    await monitorRepository.create({
      userId: "u1",
      name: "Sock",
      type: "tcp",
      port: 443,
    })

    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({
        url: null,
        host: null,
      })
    )
  })

  it("updates monitor", async () => {
    mockedDb.update.mockReturnValue({
      set: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnValue({
          returning: jest.fn().mockResolvedValue([monitorRow]),
        }),
      }),
    })

    const updated = await monitorRepository.update("m1", "u1", { name: "Renamed" })
    expect(updated).toEqual(monitorRow)
  })

  it("returns null when update affects no row", async () => {
    mockedDb.update.mockReturnValue({
      set: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnValue({
          returning: jest.fn().mockResolvedValue([]),
        }),
      }),
    })

    const updated = await monitorRepository.update("m1", "u1", { name: "Renamed" })
    expect(updated).toBeNull()
  })

  it("deletes monitor", async () => {
    mockedDb.delete.mockReturnValue({
      where: jest.fn().mockReturnValue({
        returning: jest.fn().mockResolvedValue([monitorRow]),
      }),
    })

    const removed = await monitorRepository.delete("m1", "u1")
    expect(removed).toEqual(monitorRow)
  })

  it("returns null when delete affects no row", async () => {
    mockedDb.delete.mockReturnValue({
      where: jest.fn().mockReturnValue({
        returning: jest.fn().mockResolvedValue([]),
      }),
    })

    const removed = await monitorRepository.delete("m1", "u1")
    expect(removed).toBeNull()
  })
})

describe("checkResultsRepository", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("creates check result", async () => {
    const values = jest.fn().mockResolvedValue(undefined)
    mockedDb.insert.mockReturnValue({ values })

    await checkResultsRepository.create({
      monitorId: "m1",
      status: "up",
      latencyMs: 12,
      statusCode: 200,
    })

    expect(mockedDb.insert).toHaveBeenCalledTimes(1)
    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({
        monitorId: "m1",
        status: "up",
        latencyMs: 12,
        statusCode: 200,
      })
    )
  })

  it("create stores null statusCode when omitted", async () => {
    const values = jest.fn().mockResolvedValue(undefined)
    mockedDb.insert.mockReturnValue({ values })

    await checkResultsRepository.create({
      monitorId: "m1",
      status: "down",
      latencyMs: 0,
    })

    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: null,
      })
    )
  })

  it("lists checks without optional from filter", async () => {
    mockedDb.select.mockReturnValue({
      from: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnValue({
          orderBy: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([{ id: "c1" }]),
          }),
        }),
      }),
    })

    const rows = await checkResultsRepository.listByMonitor("m1", undefined, 10)
    expect(rows).toEqual([{ id: "c1" }])
  })

  it("lists checks with from timestamp", async () => {
    mockedDb.select.mockReturnValue({
      from: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnValue({
          orderBy: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([{ id: "c2" }]),
          }),
        }),
      }),
    })

    const from = new Date("2024-01-01T00:00:00Z")
    const rows = await checkResultsRepository.listByMonitor("m1", from, 10)
    expect(rows).toEqual([{ id: "c2" }])
  })

  it("lists recent checks reversed chronologically", async () => {
    const rowNew = { checkedAt: new Date("2024-01-02T00:00:00Z") }
    const rowOld = { checkedAt: new Date("2024-01-01T00:00:00Z") }
    mockedDb.select.mockReturnValue({
      from: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnValue({
          orderBy: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([rowNew, rowOld]),
          }),
        }),
      }),
    })

    const rows = await checkResultsRepository.listByMonitorRecentSince(
      "m1",
      new Date("2023-12-01T00:00:00Z"),
      50
    )
    expect(rows).toEqual([rowOld, rowNew])
  })

  it("lists checks by user since timestamp", async () => {
    mockedDb.select.mockReturnValue({
      from: jest.fn().mockReturnValue({
        innerJoin: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            orderBy: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue([{ monitorId: "m1" }]),
            }),
          }),
        }),
      }),
    })

    const rows = await checkResultsRepository.listByUserSince(
      "u1",
      new Date("2024-01-01T00:00:00Z"),
      100
    )
    expect(rows).toEqual([{ monitorId: "m1" }])
  })

  it("aggregates stats by monitor", async () => {
    mockedDb.select.mockReturnValue({
      from: jest.fn().mockReturnValue({
        where: jest.fn().mockResolvedValue([
          {
            totalChecks: 5,
            upChecks: 4,
            avgLatency: 30,
          },
        ]),
      }),
    })

    const stats = await checkResultsRepository.statsByMonitor("m1")
    expect(stats).toEqual({
      totalChecks: 5,
      upChecks: 4,
      avgLatency: 30,
    })
  })
})
