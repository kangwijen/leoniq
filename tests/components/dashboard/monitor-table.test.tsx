import { render, screen } from "@testing-library/react"

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ href, children }: {
    href: string
    children: React.ReactNode
  }) => (
    <a href={href}>{children}</a>
  ),
}))

jest.mock("@/components/dashboard/monitor-actions", () => ({
  MonitorActions: ({
    monitorId,
    active,
    compact,
  }: {
    monitorId: string
    active: boolean
    compact?: boolean
  }) => (
    <div data-testid={`monitor-actions-${monitorId}`}>
      {active ? "active" : "inactive"}-{compact ? "compact" : "full"}
    </div>
  ),
}))

jest.mock("@/components/dashboard/uptime-sparkline", () => ({
  UptimeSparkline: ({ values }: { values: number[] }) => <div>points:{values.length}</div>,
}))

jest.mock("@/components/dashboard/latency-sparkline", () => ({
  LatencySparkline: ({ values }: { values: number[] }) => <div>latency-points:{values.length}</div>,
}))

const { MonitorTable } = require("@/components/dashboard/monitor-table")

describe("MonitorTable", () => {
  it("renders monitor rows with status and action components", () => {
    render(
      <MonitorTable
        monitors={[
          {
            id: "1",
            name: "Public API",
            type: "http",
            active: true,
            lastStatus: "up",
            intervalSeconds: 60,
            lastCheckedAt: null,
            uptimeSeries: [1, 1, 0],
            latencySeries: [120, 110, 180],
          },
          {
            id: "2",
            name: "Socket",
            type: "tcp",
            active: false,
            lastStatus: null,
            intervalSeconds: 120,
            lastCheckedAt: "2025-01-01T00:00:00.000Z",
            uptimeSeries: [1],
            latencySeries: [90],
          },
        ]}
      />
    )

    expect(screen.getAllByRole("link", { name: "Public API" }).length).toBeGreaterThan(0)
    expect(screen.getAllByText("up").length).toBeGreaterThan(0)
    expect(screen.getAllByText("paused").length).toBeGreaterThan(0)
    expect(screen.getAllByText("No checks yet").length).toBeGreaterThan(0)
    expect(screen.getAllByTestId("monitor-actions-1").length).toBeGreaterThan(0)
    expect(screen.getAllByTestId("monitor-actions-2").length).toBeGreaterThan(0)
    expect(screen.getAllByText("latency-points:3").length).toBeGreaterThan(0)
  })

  it("slices uptime sparkline values based on selected range", () => {
    const longSeries = Array.from({ length: 120 }, () => 1)

    render(
      <MonitorTable
        range="1h"
        monitors={[
          {
            id: "1",
            name: "Public API",
            type: "http",
            active: true,
            lastStatus: "up",
            intervalSeconds: 120,
            lastCheckedAt: null,
            uptimeSeries: longSeries,
            latencySeries: longSeries.map((_, index) => index + 1),
          },
        ]}
      />
    )

    expect(screen.getAllByText("points:30").length).toBeGreaterThan(0)
    expect(screen.getAllByText("latency-points:30").length).toBeGreaterThan(0)
  })

  it("renders tag badges in mobile and table layouts", () => {
    render(
      <MonitorTable
        monitors={[
          {
            id: "1",
            name: "Tagged monitor",
            type: "http",
            active: true,
            lastStatus: "up",
            intervalSeconds: 60,
            lastCheckedAt: null,
            uptimeSeries: [1, 1, 1],
            latencySeries: [100, 110, 120],
            tags: ["prod", "api", "priority", "external", "overflow"],
          },
        ]}
      />
    )

    expect(screen.getAllByText("prod").length).toBe(2)
    expect(screen.getAllByText("api").length).toBe(2)
    expect(screen.getAllByText("priority").length).toBe(2)
    expect(screen.getAllByText("external").length).toBe(1)
    expect(screen.queryByText("overflow")).toBeNull()
  })

  it("renders monitors without tags cleanly", () => {
    render(
      <MonitorTable
        monitors={[
          {
            id: "3",
            name: "No tags monitor",
            type: "tcp",
            active: true,
            lastStatus: "up",
            intervalSeconds: 45,
            lastCheckedAt: null,
            uptimeSeries: [1, 0, 1],
            latencySeries: [],
          },
        ]}
      />
    )

    expect(screen.getAllByRole("link", { name: "No tags monitor" }).length).toBeGreaterThan(0)
    expect(screen.queryByText("prod")).toBeNull()
    expect(screen.getAllByText("latency-points:0").length).toBeGreaterThan(0)
  })
})
