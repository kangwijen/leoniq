/** @jest-environment node */
import type { WebSocketServer } from "ws"

const executeMock = jest.fn().mockResolvedValue({ status: "up" as const, latencyMs: 1 })

jest.mock("../../lib/monitor/executor", () => ({
  executeAndPersistMonitorCheck: (...args: unknown[]) => executeMock(...args),
}))

jest.mock("../../lib/db/client", () => ({
  db: {
    select: jest.fn(),
    delete: jest.fn(),
    insert: jest.fn(),
  },
}))

import { db } from "../../lib/db/client"
import { dedupKeyForAlert, severityFromDownStreak } from "../../lib/alerts/notification-policy"
import { user } from "../../lib/db/schema"
import {
  broadcast,
  cleanupOldResults,
  getDownStreakAndError,
  isDiscordWebhookUrl,
  runChecks,
  runForever,
  runOneWorkerCycle,
  runSingleMonitor,
  sendWebhookSummaries,
} from "../../worker/logic"

const mockedDb = db as unknown as {
  select: jest.Mock
  delete: jest.Mock
  insert: jest.Mock
}
const mockSelect = mockedDb.select
const mockDelete = mockedDb.delete
const mockInsert = mockedDb.insert

const OPEN = 1

function mockWss(clients: Array<{ readyState: number; OPEN: number; send: jest.Mock }>) {
  return { clients: new Set(clients) } as unknown as WebSocketServer
}

describe("worker/logic", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockSelect.mockReset()
    mockInsert.mockReset()
    mockDelete.mockReset()
    mockDelete.mockReturnValue({
      where: jest.fn().mockResolvedValue(undefined),
    })
  })

  it("broadcast sends only to open clients", () => {
    const sendOpen = jest.fn()
    const sendClosed = jest.fn()
    const wss = mockWss([
      { readyState: OPEN, OPEN, send: sendOpen },
      { readyState: 0, OPEN, send: sendClosed },
    ])
    broadcast(wss, { type: "ping" })
    expect(sendOpen).toHaveBeenCalledWith(JSON.stringify({ type: "ping" }))
    expect(sendClosed).not.toHaveBeenCalled()
  })

  it("isDiscordWebhookUrl detects discord webhook URLs", () => {
    expect(isDiscordWebhookUrl("https://discord.com/api/webhooks/123/abc")).toBe(true)
    expect(isDiscordWebhookUrl("https://discordapp.com/api/webhooks/123/abc")).toBe(true)
    expect(isDiscordWebhookUrl("https://example.com/api/webhooks/x")).toBe(false)
    expect(isDiscordWebhookUrl("not-a-url")).toBe(false)
  })

  it("runSingleMonitor executes check and broadcasts", async () => {
    const send = jest.fn()
    const wss = mockWss([{ readyState: OPEN, OPEN, send }])
    const monitor = {
      id: "m1",
      name: "API",
      type: "http" as const,
      active: true,
      intervalSeconds: 60,
    } as never

    await runSingleMonitor(wss, monitor)
    expect(executeMock).toHaveBeenCalledWith(monitor, "worker")
    expect(send).toHaveBeenCalled()
    const payload = JSON.parse(send.mock.calls[0][0] as string)
    expect(payload.type).toBe("monitor.update")
    expect(payload.monitorId).toBe("m1")
  })

  it("runChecks runs monitors that are due or never checked", async () => {
    const send = jest.fn()
    const wss = mockWss([{ readyState: OPEN, OPEN, send }])
    const now = Date.now()
    const due = {
      id: "due",
      intervalSeconds: 60,
      lastCheckedAt: new Date(now - 120_000),
      active: true,
    }
    const fresh = {
      id: "fresh",
      intervalSeconds: 60,
      lastCheckedAt: new Date(now - 1000),
      active: true,
    }
    const never = {
      id: "never",
      intervalSeconds: 60,
      lastCheckedAt: null,
      active: true,
    }

    mockSelect.mockReturnValue({
      from: jest.fn().mockReturnValue({
        where: jest.fn().mockResolvedValue([due, fresh, never]),
      }),
    })

    await runChecks(wss)
    expect(executeMock).toHaveBeenCalledTimes(2)
    expect(executeMock.mock.calls.map(c => c[0].id).sort()).toEqual(["due", "never"])
  })

  it("cleanupOldResults deletes old check rows", async () => {
    await cleanupOldResults()
    expect(mockDelete).toHaveBeenCalled()
  })

  it("getDownStreakAndError aggregates consecutive down checks", async () => {
    mockSelect.mockReturnValue({
      from: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnValue({
          orderBy: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([
              { status: "down", errorMessage: "a" },
              { status: "down", errorMessage: "b" },
              { status: "up" },
            ]),
          }),
        }),
      }),
    })
    const out = await getDownStreakAndError("m1")
    expect(out.downStreak).toBe(2)
    expect(out.errorMessage).toBe("a")
  })

  it("sendWebhookSummaries skips users without webhook or without down monitors", async () => {
    mockSelect
      .mockReturnValueOnce({
        from: jest.fn().mockResolvedValue([{ id: "u1", webhookUrl: null }] as never),
      })
      .mockReturnValueOnce({
        from: jest.fn().mockResolvedValue([]),
      })

    await sendWebhookSummaries()
    expect(mockInsert).not.toHaveBeenCalled()
  })

  it("sendWebhookSummaries continues when user has webhook but no down monitors", async () => {
    mockSelect
      .mockReturnValueOnce({
        from: jest.fn().mockResolvedValue([{ id: "u1", webhookUrl: "https://hooks.example.com/x" }]),
      })
      .mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([
            { id: "m1", lastStatus: "up", userId: "u1", name: "A", type: "http", active: true },
          ]),
        }),
      })

    await sendWebhookSummaries()
    expect(mockInsert).not.toHaveBeenCalled()
  })

  it("sendWebhookSummaries skips fetch when cooldown suppresses matching dedup", async () => {
    const fetchMock = jest.fn()
    global.fetch = fetchMock as unknown as typeof fetch
    const fixedNow = new Date("2026-05-09T12:00:00.000Z")
    jest.useFakeTimers({ now: fixedNow.getTime() })

    const userRow = { id: "u1", webhookUrl: "https://hooks.example.com/x" }
    const downMon = {
      id: "m1",
      userId: "u1",
      name: "Svc",
      type: "http" as const,
      lastStatus: "down" as const,
      lastCheckedAt: null as Date | null,
      active: true,
    }

    const sev = severityFromDownStreak(1)
    const dk = dedupKeyForAlert({
      monitorId: "m1",
      errorMessage: "e",
      downStreak: 1,
      severity: sev,
    })
    const attemptTime = fixedNow

    try {
      mockSelect
        .mockReturnValueOnce({ from: jest.fn().mockResolvedValue([userRow]) })
        .mockReturnValueOnce({
          from: jest.fn().mockReturnValue({
            where: jest.fn().mockResolvedValue([downMon]),
          }),
        })
        .mockReturnValueOnce({
          from: jest.fn().mockReturnValue({
            where: jest.fn().mockReturnValue({
              orderBy: jest.fn().mockReturnValue({
                limit: jest.fn().mockResolvedValue([
                  {
                    createdAt: attemptTime,
                    payload: { alerts: [{ dedupKey: dk }] },
                  },
                  {
                    createdAt: attemptTime,
                    payload: { alerts: [{ dedupKey: "k1" }] },
                  },
                  { createdAt: attemptTime, payload: "not-object" },
                  { createdAt: attemptTime, payload: { alerts: [{ dedupKey: 99 }] } },
                  { createdAt: attemptTime, payload: {} },
                ]),
              }),
            }),
          }),
        })
        .mockReturnValueOnce({
          from: jest.fn().mockReturnValue({
            where: jest.fn().mockReturnValue({
              orderBy: jest.fn().mockReturnValue({
                limit: jest.fn().mockResolvedValue([{ status: "down", errorMessage: "e" }]),
              }),
            }),
          }),
        })

      await sendWebhookSummaries()
      expect(fetchMock).not.toHaveBeenCalled()
    } finally {
      jest.useRealTimers()
    }
  })

  it("runOneWorkerCycle runs webhook summaries after interval", async () => {
    jest.useFakeTimers({ now: 0 })
    const wss = mockWss([])
    const emptyChain = {
      from: jest.fn((table: unknown) => {
        if (table === user) {
          return Promise.resolve([])
        }
        return {
          where: jest.fn().mockResolvedValue([]),
        }
      }),
    }
    mockSelect.mockReturnValue(emptyChain)
    mockDelete.mockReturnValue({
      where: jest.fn().mockResolvedValue(undefined),
    })

    const state = { lastAt: 0 }
    await runOneWorkerCycle(wss, state)
    const afterFirst = mockSelect.mock.calls.length
    jest.setSystemTime(400_000)
    await runOneWorkerCycle(wss, state)
    expect(mockSelect.mock.calls.length).toBeGreaterThan(afterFirst)
    jest.useRealTimers()
  })

  it("sendWebhookSummaries posts JSON and logs attempt", async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
    })
    global.fetch = fetchMock as unknown as typeof fetch

    const userRow = {
      id: "u1",
      webhookUrl: "https://hooks.example.com/x",
    }
    const downMon = {
      id: "m1",
      userId: "u1",
      name: "Svc",
      type: "http" as const,
      lastStatus: "down" as const,
      lastCheckedAt: new Date(),
      active: true,
    }

    mockSelect
      .mockReturnValueOnce({
        from: jest.fn().mockResolvedValue([userRow]),
      })
      .mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([downMon]),
        }),
      })
      .mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            orderBy: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue([]),
            }),
          }),
        }),
      })
      .mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            orderBy: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue([{ status: "down", errorMessage: "boom" }]),
            }),
          }),
        }),
      })

    const values = jest.fn().mockResolvedValue(undefined)
    mockInsert.mockReturnValue({ values })

    await sendWebhookSummaries()

    expect(fetchMock).toHaveBeenCalledWith(
      "https://hooks.example.com/x",
      expect.objectContaining({ method: "POST" })
    )
    expect(values).toHaveBeenCalled()
  })

  it("sendWebhookSummaries uses discord payload shape for discord hosts", async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true, status: 204 })
    global.fetch = fetchMock as unknown as typeof fetch

    const userRow = { id: "u1", webhookUrl: "https://discord.com/api/webhooks/1/token" }
    const downMon = {
      id: "m1",
      userId: "u1",
      name: "Svc",
      type: "http" as const,
      lastStatus: "down" as const,
      lastCheckedAt: new Date(),
      active: true,
    }

    mockSelect
      .mockReturnValueOnce({ from: jest.fn().mockResolvedValue([userRow]) })
      .mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([downMon]),
        }),
      })
      .mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            orderBy: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue([]),
            }),
          }),
        }),
      })
      .mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            orderBy: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue([{ status: "down", errorMessage: "e" }]),
            }),
          }),
        }),
      })

    mockInsert.mockReturnValue({ values: jest.fn().mockResolvedValue(undefined) })

    await sendWebhookSummaries()

    const body = (fetchMock.mock.calls[0][1] as { body: string }).body
    expect(JSON.parse(body).content).toContain("Monitor alert")
  })

  it("sendWebhookSummaries records failed fetch with response text", async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => "oops",
    })
    global.fetch = fetchMock as unknown as typeof fetch

    const userRow = { id: "u1", webhookUrl: "https://hooks.example.com/x" }
    const downMon = {
      id: "m1",
      userId: "u1",
      name: "Svc",
      type: "http" as const,
      lastStatus: "down" as const,
      lastCheckedAt: new Date(),
      active: true,
    }

    mockSelect
      .mockReturnValueOnce({ from: jest.fn().mockResolvedValue([userRow]) })
      .mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([downMon]),
        }),
      })
      .mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            orderBy: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue([]),
            }),
          }),
        }),
      })
      .mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            orderBy: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue([{ status: "down", errorMessage: null }]),
            }),
          }),
        }),
      })

    const values = jest.fn().mockResolvedValue(undefined)
    mockInsert.mockReturnValue({ values })

    await sendWebhookSummaries()

    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        statusCode: 500,
        errorMessage: expect.stringContaining("500"),
      })
    )
  })

  it("sendWebhookSummaries records empty error body on non-ok response", async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: false,
      status: 502,
      text: async () => "   ",
    })
    global.fetch = fetchMock as unknown as typeof fetch

    const userRow = { id: "u1", webhookUrl: "https://hooks.example.com/x" }
    const downMon = {
      id: "m1",
      userId: "u1",
      name: "Svc",
      type: "http" as const,
      lastStatus: "down" as const,
      lastCheckedAt: new Date(),
      active: true,
    }

    mockSelect
      .mockReturnValueOnce({ from: jest.fn().mockResolvedValue([userRow]) })
      .mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([downMon]),
        }),
      })
      .mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            orderBy: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue([]),
            }),
          }),
        }),
      })
      .mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            orderBy: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue([{ status: "down", errorMessage: null }]),
            }),
          }),
        }),
      })

    const values = jest.fn().mockResolvedValue(undefined)
    mockInsert.mockReturnValue({ values })

    await sendWebhookSummaries()

    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({
        errorMessage: "Webhook returned status 502",
      })
    )
  })

  it("sendWebhookSummaries maps services with unknown status and null lastCheckedAt", async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true, status: 200 })
    global.fetch = fetchMock as unknown as typeof fetch

    const userRow = { id: "u1", webhookUrl: "https://hooks.example.com/x" }
    const downMon = {
      id: "m1",
      userId: "u1",
      name: "Svc",
      type: "http" as const,
      lastStatus: "down" as const,
      lastCheckedAt: null as Date | null,
      active: true,
    }
    const sideMon = {
      id: "m2",
      userId: "u1",
      name: "Side",
      type: "http" as const,
      lastStatus: null,
      lastCheckedAt: null,
      active: true,
    }

    mockSelect
      .mockReturnValueOnce({ from: jest.fn().mockResolvedValue([userRow]) })
      .mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([downMon, sideMon]),
        }),
      })
      .mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            orderBy: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue([]),
            }),
          }),
        }),
      })
      .mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            orderBy: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue([{ status: "down", errorMessage: "e" }]),
            }),
          }),
        }),
      })

    mockInsert.mockReturnValue({ values: jest.fn().mockResolvedValue(undefined) })

    await sendWebhookSummaries()

    const body = JSON.parse((fetchMock.mock.calls[0][1] as { body: string }).body) as {
      alerts: Array<{ id: string }>
    }
    expect(body.alerts.some(a => a.id === "m1")).toBe(true)
  })

  it("sendWebhookSummaries uses Error message when fetch rejects with Error", async () => {
    const fetchMock = jest.fn().mockRejectedValue(new Error("aborted"))
    global.fetch = fetchMock as unknown as typeof fetch

    const userRow = { id: "u1", webhookUrl: "https://hooks.example.com/x" }
    const downMon = {
      id: "m1",
      userId: "u1",
      name: "Svc",
      type: "http" as const,
      lastStatus: "down" as const,
      lastCheckedAt: new Date(),
      active: true,
    }

    mockSelect
      .mockReturnValueOnce({ from: jest.fn().mockResolvedValue([userRow]) })
      .mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([downMon]),
        }),
      })
      .mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            orderBy: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue([]),
            }),
          }),
        }),
      })
      .mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            orderBy: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue([{ status: "down", errorMessage: null }]),
            }),
          }),
        }),
      })

    const values = jest.fn().mockResolvedValue(undefined)
    mockInsert.mockReturnValue({ values })
    const errSpy = jest.spyOn(console, "error").mockImplementation(() => {})

    await sendWebhookSummaries()
    errSpy.mockRestore()

    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({
        errorMessage: "aborted",
      })
    )
  })

  it("sendWebhookSummaries maps fetch rejection objects to generic message", async () => {
    const fetchMock = jest.fn().mockRejectedValue({ notAnError: true })
    global.fetch = fetchMock as unknown as typeof fetch

    const userRow = { id: "u1", webhookUrl: "https://hooks.example.com/x" }
    const downMon = {
      id: "m1",
      userId: "u1",
      name: "Svc",
      type: "http" as const,
      lastStatus: "down" as const,
      lastCheckedAt: new Date(),
      active: true,
    }

    mockSelect
      .mockReturnValueOnce({ from: jest.fn().mockResolvedValue([userRow]) })
      .mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([downMon]),
        }),
      })
      .mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            orderBy: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue([]),
            }),
          }),
        }),
      })
      .mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            orderBy: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue([{ status: "down", errorMessage: null }]),
            }),
          }),
        }),
      })

    const values = jest.fn().mockResolvedValue(undefined)
    mockInsert.mockReturnValue({ values })
    const errSpy = jest.spyOn(console, "error").mockImplementation(() => {})

    await sendWebhookSummaries()
    errSpy.mockRestore()

    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({
        errorMessage: "Webhook request failed",
      })
    )
  })

  it("sendWebhookSummaries records non-Error fetch failures", async () => {
    const fetchMock = jest.fn().mockRejectedValue("boom")
    global.fetch = fetchMock as unknown as typeof fetch

    const userRow = { id: "u1", webhookUrl: "https://hooks.example.com/x" }
    const downMon = {
      id: "m1",
      userId: "u1",
      name: "Svc",
      type: "http" as const,
      lastStatus: "down" as const,
      lastCheckedAt: new Date(),
      active: true,
    }

    mockSelect
      .mockReturnValueOnce({ from: jest.fn().mockResolvedValue([userRow]) })
      .mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([downMon]),
        }),
      })
      .mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            orderBy: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue([]),
            }),
          }),
        }),
      })
      .mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            orderBy: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue([{ status: "down", errorMessage: null }]),
            }),
          }),
        }),
      })

    const values = jest.fn().mockResolvedValue(undefined)
    mockInsert.mockReturnValue({ values })
    const errSpy = jest.spyOn(console, "error").mockImplementation(() => {})

    await sendWebhookSummaries()
    errSpy.mockRestore()

    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        errorMessage: "Webhook request failed",
      })
    )
  })

  it("runForever logs cycle failures then continues", async () => {
    jest.useFakeTimers()
    let calls = 0
    mockSelect.mockImplementation(() => {
      calls += 1
      if (calls === 1) {
        throw new Error("db")
      }
      return {
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([]),
        }),
      }
    })

    const errSpy = jest.spyOn(console, "error").mockImplementation(() => {})
    const logSpy = jest.spyOn(console, "log").mockImplementation(() => {})

    const wss = mockWss([])
    const p = runForever(wss)

    await Promise.resolve()
    await jest.advanceTimersByTimeAsync(1)
    await Promise.resolve()
    await jest.advanceTimersByTimeAsync(5)

    expect(errSpy).toHaveBeenCalledWith("[worker] cycle failed", expect.any(Error))

    errSpy.mockRestore()
    logSpy.mockRestore()
    jest.useRealTimers()
    void p
  })
})
