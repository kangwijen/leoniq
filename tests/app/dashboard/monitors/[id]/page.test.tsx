import { render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import MonitorDetailPage from "@/app/dashboard/monitors/[id]/page"
import { requireSession } from "@/lib/session"
import { checkResultsRepository, monitorRepository } from "@/lib/monitor/repository"
import { notFound } from "next/navigation"

jest.mock("next/link", () => {
  return {
    __esModule: true,
    default: ({ href, children }: { href: string; children: ReactNode }) => (
      <a href={href}>{children}</a>
    ),
  }
})

jest.mock("next/navigation", () => ({
  notFound: jest.fn(() => {
    throw new Error("not-found")
  }),
}))

jest.mock("@/components/ui/button", () => ({
  Button: ({ children }: { children: ReactNode; asChild?: boolean }) => <>{children}</>,
}))

jest.mock("@/components/dashboard/realtime-refresh", () => ({
  RealtimeRefresh: () => <div data-testid="realtime-refresh" />,
}))

jest.mock("@/components/dashboard/monitor-actions", () => ({
  MonitorActions: ({ monitorId }: { monitorId: string }) => (
    <div data-testid="monitor-actions" data-monitor-id={monitorId} />
  ),
}))

jest.mock("@/components/dashboard/monitor-detail-analytics", () => ({
  MonitorDetailAnalytics: ({
    monitorId,
    points,
  }: {
    monitorId: string
    points: unknown[]
  }) => (
    <div data-testid="monitor-detail-analytics" data-monitor-id={monitorId} data-points={points.length} />
  ),
}))

jest.mock("@/lib/session", () => ({
  requireSession: jest.fn(),
}))

jest.mock("@/lib/monitor/repository", () => ({
  monitorRepository: {
    getById: jest.fn(),
  },
  checkResultsRepository: {
    listByMonitorRecentSince: jest.fn(),
  },
}))

const mockRequireSession = requireSession as jest.MockedFunction<typeof requireSession>
const mockGetById = monitorRepository.getById as jest.MockedFunction<typeof monitorRepository.getById>
const mockListRecent = checkResultsRepository.listByMonitorRecentSince as jest.MockedFunction<
  typeof checkResultsRepository.listByMonitorRecentSince
>

const baseMonitor = {
  id: "mon-1",
  userId: "user-1",
  name: "API",
  type: "http" as const,
  url: "https://api.example.com",
  host: null,
  port: null,
  method: "GET",
  expectedStatusMin: 200,
  expectedStatusMax: 399,
  intervalSeconds: 60,
  timeoutMs: 5000,
  retries: 1,
  tags: [] as string[],
  active: true,
  createdAt: new Date("2026-05-01T00:00:00.000Z"),
  updatedAt: new Date("2026-05-02T00:00:00.000Z"),
  lastLatencyMs: 50,
  lastCheckedAt: new Date("2026-05-07T12:00:00.000Z"),
}

describe("MonitorDetailPage", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers()
    jest.setSystemTime(new Date("2026-05-07T12:00:00.000Z"))
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it("calls notFound when monitor is missing", async () => {
    mockRequireSession.mockResolvedValue({
      user: { id: "user-1" },
    } as Awaited<ReturnType<typeof requireSession>>)
    const getByIdMock = mockGetById as jest.Mock
    getByIdMock.mockResolvedValue(null)

    await expect(
      MonitorDetailPage({ params: Promise.resolve({ id: "missing" }) })
    ).rejects.toThrow("not-found")

    expect(notFound).toHaveBeenCalledTimes(1)
    expect(mockListRecent).not.toHaveBeenCalled()
  })

  it("loads checks and renders up badge", async () => {
    mockRequireSession.mockResolvedValue({
      user: { id: "user-1" },
    } as Awaited<ReturnType<typeof requireSession>>)
    mockGetById.mockResolvedValue({
      ...baseMonitor,
      lastStatus: "up",
    })
    mockListRecent.mockResolvedValue([
      {
        id: "c1",
        monitorId: "mon-1",
        status: "up",
        latencyMs: 40,
        checkedAt: new Date("2026-05-07T11:00:00.000Z"),
        statusCode: 200,
        errorMessage: null,
        meta: null,
      },
    ])

    render(await MonitorDetailPage({ params: Promise.resolve({ id: "mon-1" }) }))

    expect(mockListRecent).toHaveBeenCalledWith(
      "mon-1",
      new Date("2026-04-30T12:00:00.000Z"),
      6000
    )
    expect(screen.getByText("up")).toBeInTheDocument()
    expect(screen.getByTestId("monitor-detail-analytics")).toHaveAttribute("data-points", "1")
  })

  it("renders down badge", async () => {
    mockRequireSession.mockResolvedValue({
      user: { id: "user-1" },
    } as Awaited<ReturnType<typeof requireSession>>)
    mockGetById.mockResolvedValue({
      ...baseMonitor,
      lastStatus: "down",
    })
    mockListRecent.mockResolvedValue([])

    render(await MonitorDetailPage({ params: Promise.resolve({ id: "mon-1" }) }))

    expect(screen.getByText("down")).toBeInTheDocument()
  })

  it("renders unknown badge when lastStatus is null", async () => {
    mockRequireSession.mockResolvedValue({
      user: { id: "user-1" },
    } as Awaited<ReturnType<typeof requireSession>>)
    mockGetById.mockResolvedValue({
      ...baseMonitor,
      lastStatus: null,
    })
    mockListRecent.mockResolvedValue([])

    render(await MonitorDetailPage({ params: Promise.resolve({ id: "mon-1" }) }))

    expect(screen.getByText("unknown")).toBeInTheDocument()
  })
})
