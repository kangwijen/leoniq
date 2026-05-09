/** @jest-environment node */
jest.mock("@/lib/session", () => ({
  requireSession: jest.fn(),
}))

jest.mock("@/lib/monitor/repository", () => ({
  monitorRepository: {
    getById: jest.fn(),
  },
  checkResultsRepository: {
    listByMonitor: jest.fn(),
    statsByMonitor: jest.fn(),
  },
}))

import { GET } from "@/app/api/monitors/[id]/results/route"
import { checkResultsRepository, monitorRepository } from "@/lib/monitor/repository"
import { requireSession } from "@/lib/session"

const mockedRequireSession = requireSession as jest.MockedFunction<typeof requireSession>
const mockedGetById = monitorRepository.getById as jest.MockedFunction<typeof monitorRepository.getById>
const mockedListByMonitor = checkResultsRepository.listByMonitor as jest.MockedFunction<
  typeof checkResultsRepository.listByMonitor
>
const mockedStats = checkResultsRepository.statsByMonitor as jest.MockedFunction<
  typeof checkResultsRepository.statsByMonitor
>

const monitorRow = {
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

describe("app/api/monitors/[id]/results/route", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockedRequireSession.mockResolvedValue({
      user: { id: "user-1", email: "u@example.com", emailVerified: true, createdAt: new Date(), updatedAt: new Date() },
      session: { id: "s1", userId: "user-1", expiresAt: new Date(), token: "t" },
    } as never)
    mockedGetById.mockResolvedValue(monitorRow as never)
    mockedListByMonitor.mockResolvedValue([])
    mockedStats.mockResolvedValue({
      totalChecks: 10,
      upChecks: 9,
      avgLatency: 42,
    } as never)
  })

  const segment = { params: Promise.resolve({ id: "m1" }) }

  it("returns 404 when monitor missing", async () => {
    const getByIdMock = mockedGetById as jest.Mock
    getByIdMock.mockResolvedValue(null)
    const res = await GET(new Request("http://localhost/api/monitors/m1/results"), segment)
    expect(res.status).toBe(404)
  })

  it("clamps hours query to minimum 1", async () => {
    await GET(new Request("http://localhost/api/monitors/m1/results?hours=0"), segment)
    expect(mockedListByMonitor).toHaveBeenCalled()
    const fromArg = mockedListByMonitor.mock.calls[0][1] as Date
    const deltaHours = (Date.now() - fromArg.getTime()) / (60 * 60 * 1000)
    expect(deltaHours).toBeGreaterThanOrEqual(0.99)
    expect(deltaHours).toBeLessThanOrEqual(1.02)
  })

  it("clamps hours query to maximum 168", async () => {
    await GET(new Request("http://localhost/api/monitors/m1/results?hours=99999"), segment)
    const fromArg = mockedListByMonitor.mock.calls[0][1] as Date
    const deltaHours = (Date.now() - fromArg.getTime()) / (60 * 60 * 1000)
    expect(deltaHours).toBeGreaterThan(167)
    expect(deltaHours).toBeLessThanOrEqual(169)
  })

  it("computes uptime percent when checks exist", async () => {
    mockedStats.mockResolvedValue({
      totalChecks: 4,
      upChecks: 3,
      avgLatency: 10,
    } as never)

    const res = await GET(new Request("http://localhost/api/monitors/m1/results"), segment)
    const body = await res.json()
    expect(body.stats.uptimePercent).toBe(75)
    expect(body.stats.totalChecks).toBe(4)
    expect(body.stats.avgLatency).toBe(10)
  })

  it("sets uptime percent to 0 when no checks", async () => {
    mockedStats.mockResolvedValue({
      totalChecks: 0,
      upChecks: 0,
      avgLatency: 0,
    } as never)

    const res = await GET(new Request("http://localhost/api/monitors/m1/results"), segment)
    const body = await res.json()
    expect(body.stats.uptimePercent).toBe(0)
  })

  it("defaults stats when stats row missing", async () => {
    mockedStats.mockResolvedValue(undefined as never)
    const res = await GET(new Request("http://localhost/api/monitors/m1/results"), segment)
    const body = await res.json()
    expect(body.stats.totalChecks).toBe(0)
    expect(body.stats.uptimePercent).toBe(0)
  })

  it("treats missing upChecks in stats as zero in uptime ratio", async () => {
    mockedStats.mockResolvedValue({
      totalChecks: 10,
      avgLatency: 5,
    } as never)

    const res = await GET(new Request("http://localhost/api/monitors/m1/results"), segment)
    const body = await res.json()
    expect(body.stats.uptimePercent).toBe(0)
  })

  it("treats null upChecks as zero while computing uptime percent", async () => {
    mockedStats.mockResolvedValue({
      totalChecks: 8,
      upChecks: null,
      avgLatency: 1,
    } as never)

    const res = await GET(new Request("http://localhost/api/monitors/m1/results"), segment)
    const body = await res.json()
    expect(body.stats.uptimePercent).toBe(0)
  })
})
