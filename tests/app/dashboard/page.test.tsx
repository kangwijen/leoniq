import { render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import DashboardPage from "@/app/dashboard/page"
import { requireSession } from "@/lib/session"
import { checkResultsRepository, monitorRepository } from "@/lib/monitor/repository"
import { userRepository } from "@/lib/user/repository"

jest.mock("next/link", () => {
  return {
    __esModule: true,
    default: ({ href, children }: { href: string; children: ReactNode }) => (
      <a href={href}>{children}</a>
    ),
  }
})

jest.mock("@/components/ui/button", () => ({
  Button: ({ children }: { children: ReactNode }) => <>{children}</>,
}))

jest.mock("@/components/dashboard/realtime-refresh", () => ({
  RealtimeRefresh: () => <div data-testid="realtime-refresh" />,
}))

jest.mock("@/components/dashboard/dashboard-kpis", () => ({
  DashboardKpis: () => <div data-testid="dashboard-kpis" />,
}))

jest.mock("@/components/dashboard/webhook-settings", () => ({
  WebhookSettings: () => <div data-testid="webhook-settings" />,
}))

jest.mock("@/components/dashboard/dashboard-live-sections", () => ({
  DashboardLiveSections: ({
    samples,
    monitors,
  }: {
    samples: unknown[]
    monitors: Array<{ lastStatus: "up" | "down" | null; uptimeSeries: number[] }>
  }) => (
    <div
      data-testid="dashboard-live-sections"
      data-samples={samples.length}
      data-monitors={monitors.length}
      data-null-status={String(monitors.some(item => item.lastStatus === null))}
      data-empty-series={String(monitors.some(item => item.uptimeSeries.length === 0))}
    />
  ),
}))

jest.mock("@/lib/session", () => ({
  requireSession: jest.fn(),
}))

jest.mock("@/lib/user/repository", () => ({
  userRepository: {
    getById: jest.fn(),
  },
}))

jest.mock("@/lib/monitor/repository", () => ({
  monitorRepository: {
    list: jest.fn(),
  },
  checkResultsRepository: {
    listByUserSince: jest.fn(),
    listByMonitor: jest.fn(),
  },
}))

const mockRequireSession = requireSession as jest.MockedFunction<typeof requireSession>
const mockUserGetById = userRepository.getById as jest.MockedFunction<typeof userRepository.getById>
const mockMonitorList = monitorRepository.list as jest.MockedFunction<typeof monitorRepository.list>
const mockListByUserSince = checkResultsRepository.listByUserSince as jest.MockedFunction<
  typeof checkResultsRepository.listByUserSince
>
const mockListByMonitor = checkResultsRepository.listByMonitor as jest.MockedFunction<
  typeof checkResultsRepository.listByMonitor
>

describe("DashboardPage orchestration", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("requests session and monitor data, requests 7-day samples, and renders empty state", async () => {
    const now = new Date("2026-05-07T12:00:00.000Z").getTime()
    const nowSpy = jest.spyOn(Date, "now").mockReturnValue(now)

    mockRequireSession.mockResolvedValue({
      user: {
        id: "user-1",
        name: "Alice",
      },
    } as Awaited<ReturnType<typeof requireSession>>)
    mockUserGetById.mockResolvedValue({
      id: "user-1",
      webhookUrl: null,
    } as Awaited<ReturnType<typeof userRepository.getById>>)
    mockMonitorList.mockResolvedValue([])
    mockListByUserSince.mockResolvedValue([])

    render(await DashboardPage())

    expect(mockRequireSession).toHaveBeenCalledTimes(1)
    expect(mockUserGetById).toHaveBeenCalledWith("user-1")
    expect(mockMonitorList).toHaveBeenCalledWith({ userId: "user-1" })
    expect(mockListByUserSince).toHaveBeenCalledWith(
      "user-1",
      new Date(now - 7 * 24 * 60 * 60 * 1000)
    )
    expect(mockListByMonitor).not.toHaveBeenCalled()
    expect(screen.getByTestId("dashboard-live-sections")).toHaveAttribute("data-samples", "0")
    expect(screen.getByTestId("dashboard-live-sections")).toHaveAttribute("data-monitors", "0")

    nowSpy.mockRestore()
  })

  it("renders monitor table when monitors exist", async () => {
    mockRequireSession.mockResolvedValue({
      user: {
        id: "user-1",
        name: "Alice",
      },
    } as Awaited<ReturnType<typeof requireSession>>)
    mockUserGetById.mockResolvedValue({
      id: "user-1",
      webhookUrl: "https://hooks.example.com",
    } as Awaited<ReturnType<typeof userRepository.getById>>)
    mockMonitorList.mockResolvedValue([
      {
        id: "monitor-1",
        userId: "user-1",
        name: "API health",
        type: "http",
        url: "https://api.example.com/health",
        host: null,
        port: null,
        method: "GET",
        expectedStatusMin: 200,
        expectedStatusMax: 399,
        intervalSeconds: 60,
        timeoutMs: 5000,
        retries: 1,
        active: true,
        createdAt: new Date("2026-05-01T00:00:00.000Z"),
        updatedAt: new Date("2026-05-02T00:00:00.000Z"),
        lastStatus: "up",
        lastLatencyMs: 120,
        lastCheckedAt: new Date("2026-05-07T11:59:00.000Z"),
      },
      {
        id: "monitor-2",
        userId: "user-1",
        name: "Socket health",
        type: "tcp",
        url: null,
        host: "socket.example.com",
        port: 443,
        method: "GET",
        expectedStatusMin: 200,
        expectedStatusMax: 399,
        intervalSeconds: 60,
        timeoutMs: 5000,
        retries: 1,
        active: true,
        createdAt: new Date("2026-05-01T00:00:00.000Z"),
        updatedAt: new Date("2026-05-02T00:00:00.000Z"),
        lastStatus: null,
        lastLatencyMs: 0,
        lastCheckedAt: null,
      },
    ])
    mockListByUserSince.mockResolvedValue([
      {
        monitorId: "monitor-1",
        monitorName: "API health",
        monitorType: "http",
        checkedAt: new Date("2026-05-07T11:59:00.000Z"),
        status: "up",
        latencyMs: 120,
        statusCode: 200,
        errorMessage: null,
        meta: { responseBytes: 1024 },
      },
    ] as Awaited<ReturnType<typeof checkResultsRepository.listByUserSince>>)
    mockListByMonitor.mockImplementation(async monitorId => {
      if (monitorId === "monitor-1") {
        return [
          {
            id: "check-1",
            monitorId: "monitor-1",
            status: "up",
            latencyMs: 120,
            checkedAt: new Date("2026-05-07T11:59:00.000Z"),
            errorMessage: null,
          },
          {
            id: "check-2",
            monitorId: "monitor-1",
            status: "down",
            latencyMs: 300,
            checkedAt: new Date("2026-05-07T12:00:00.000Z"),
            errorMessage: "timeout",
          },
        ] as Awaited<ReturnType<typeof checkResultsRepository.listByMonitor>>
      }

      return [] as Awaited<ReturnType<typeof checkResultsRepository.listByMonitor>>
    })

    render(await DashboardPage())

    expect(mockRequireSession).toHaveBeenCalledTimes(1)
    expect(mockMonitorList).toHaveBeenCalledWith({ userId: "user-1" })
    expect(mockListByUserSince).toHaveBeenCalledTimes(1)
    expect(mockListByMonitor).toHaveBeenNthCalledWith(1, "monitor-1", undefined, 20)
    expect(mockListByMonitor).toHaveBeenNthCalledWith(2, "monitor-2", undefined, 20)
    expect(screen.getByTestId("dashboard-live-sections")).toHaveAttribute("data-samples", "1")
    expect(screen.getByTestId("dashboard-live-sections")).toHaveAttribute("data-monitors", "2")
    expect(screen.getByTestId("dashboard-live-sections")).toHaveAttribute("data-null-status", "true")
    expect(screen.getByTestId("dashboard-live-sections")).toHaveAttribute("data-empty-series", "true")
  })
})
