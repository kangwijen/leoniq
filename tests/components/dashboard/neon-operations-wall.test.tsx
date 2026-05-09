import { fireEvent, render, screen, within } from "@testing-library/react"
import { detectDashboardAnomalies } from "@/lib/monitor/anomaly-detection"
import { NeonOperationsWall } from "@/components/dashboard/neon-operations-wall"

jest.mock("@/components/ui/select", () => ({
  Select: ({
    value,
    onValueChange,
    children,
  }: {
    value: string
    onValueChange: (value: string) => void
    children: React.ReactNode
  }) => (
    <select aria-label="Time range" value={value} onChange={event => onValueChange(event.target.value)}>
      {children}
    </select>
  ),
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectValue: () => null,
  SelectContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectItem: ({
    value,
    children,
  }: {
    value: string
    children: React.ReactNode
  }) => <option value={value}>{children}</option>,
}))

jest.mock("@/lib/monitor/anomaly-detection", () => {
  const actual = jest.requireActual("@/lib/monitor/anomaly-detection") as typeof import("@/lib/monitor/anomaly-detection")
  return {
    ...actual,
    detectDashboardAnomalies: jest.fn((...args: Parameters<typeof actual.detectDashboardAnomalies>) =>
      actual.detectDashboardAnomalies(...args)
    ),
  }
})

jest.mock("recharts", () => {
  const passthrough = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>
  const leaf = ({
    formatter,
    labelFormatter,
    tickFormatter,
  }: {
    formatter?: (...args: unknown[]) => unknown
    labelFormatter?: (...args: unknown[]) => unknown
    tickFormatter?: (...args: unknown[]) => unknown
  }) => {
    if (typeof formatter === "function") {
      formatter(123, "series")
    }
    if (typeof labelFormatter === "function") {
      labelFormatter("2026-05-07T00:00:00.000Z")
    }
    if (typeof tickFormatter === "function") {
      tickFormatter("2026-05-07T00:00:00.000Z")
    }
    return <div />
  }

  return {
    ResponsiveContainer: passthrough,
    LineChart: passthrough,
    AreaChart: passthrough,
    BarChart: passthrough,
    CartesianGrid: leaf,
    XAxis: leaf,
    YAxis: leaf,
    Tooltip: leaf,
    Line: leaf,
    Area: leaf,
    Bar: leaf,
  }
})

type Sample = React.ComponentProps<typeof NeonOperationsWall>["samples"][number]

const mockDetectDashboardAnomalies = detectDashboardAnomalies as jest.MockedFunction<
  typeof detectDashboardAnomalies
>

const makeSample = (
  checkedAt: string,
  status: "up" | "down",
  latencyMs: number,
  monitorType: "http" | "tcp" = "http"
): Sample => ({
  monitorId: `${checkedAt}-${monitorType}`,
  monitorName: `${monitorType.toUpperCase()} monitor`,
  monitorType,
  checkedAt,
  status,
  latencyMs,
  statusCode: status === "up" ? 200 : 503,
  errorMessage: status === "down" ? "timeout" : null,
  meta: {
    responseBytes: 512,
  },
})

describe("NeonOperationsWall", () => {
  beforeEach(() => {
    const actual = jest.requireActual("@/lib/monitor/anomaly-detection") as typeof import("@/lib/monitor/anomaly-detection")
    mockDetectDashboardAnomalies.mockImplementation((...args) => actual.detectDashboardAnomalies(...args))
  })

  it("uses 24h as default range selection", () => {
    const now = Date.now()
    const samples = [
      makeSample(new Date(now - 2 * 60 * 60 * 1000).toISOString(), "up", 110),
      makeSample(new Date(now - 10 * 60 * 60 * 1000).toISOString(), "up", 120),
      makeSample(new Date(now - 30 * 60 * 60 * 1000).toISOString(), "up", 130),
    ]

    render(<NeonOperationsWall samples={samples} />)

    expect(screen.getByLabelText("Time range")).toHaveValue("24h")
    expect(screen.getByText("Checks in range")).toBeInTheDocument()
    expect(screen.getByText("2")).toBeInTheDocument()
  })

  it("switches range between 1h, 6h, and 7d from Select", () => {
    const now = Date.now()
    const samples = [
      makeSample(new Date(now - 2 * 60 * 60 * 1000).toISOString(), "up", 100),
      makeSample(new Date(now - 5 * 60 * 60 * 1000).toISOString(), "down", 220),
      makeSample(new Date(now - 20 * 60 * 60 * 1000).toISOString(), "up", 90),
      makeSample(new Date(now - 3 * 24 * 60 * 60 * 1000).toISOString(), "up", 140),
    ]

    render(<NeonOperationsWall samples={samples} />)

    const rangeSelect = screen.getByLabelText("Time range")
    expect(screen.getByText("3")).toBeInTheDocument()

    fireEvent.change(rangeSelect, { target: { value: "6h" } })
    expect(rangeSelect).toHaveValue("6h")
    expect(screen.getByText("2")).toBeInTheDocument()

    fireEvent.change(rangeSelect, { target: { value: "1h" } })
    expect(rangeSelect).toHaveValue("1h")
    const rangeChecksCard = screen.getByText("Checks in range").closest("article")
    expect(rangeChecksCard).not.toBeNull()
    expect(within(rangeChecksCard as HTMLElement).getByText("1")).toBeInTheDocument()

    fireEvent.change(rangeSelect, { target: { value: "7d" } })
    expect(rangeSelect).toHaveValue("7d")
    expect(screen.getByText("4")).toBeInTheDocument()
  })

  it("renders all new chart section titles", () => {
    render(<NeonOperationsWall samples={[]} />)

    expect(screen.getByText("Latency Percentiles")).toBeInTheDocument()
    expect(screen.getByText("Uptime Timeline")).toBeInTheDocument()
    expect(screen.getByText("Recent incidents")).toBeInTheDocument()
    expect(screen.getByText("Anomaly signals")).toBeInTheDocument()
    expect(screen.getByText("Showing incidents in selected range.")).toBeInTheDocument()
    expect(screen.getByText("Status Code Distribution")).toBeInTheDocument()
    expect(screen.getByText("Response Size Trend")).toBeInTheDocument()
    expect(screen.getByText("P95 by Protocol")).toBeInTheDocument()
    expect(screen.getByText("Top Failure Reasons")).toBeInTheDocument()
  })

  it("handles empty sample arrays without crashing", () => {
    expect(() => render(<NeonOperationsWall samples={[]} />)).not.toThrow()
    const rangeChecksCard = screen.getByText("Checks in range").closest("article")
    expect(rangeChecksCard).not.toBeNull()
    expect(within(rangeChecksCard as HTMLElement).getByText("0")).toBeInTheDocument()
    expect(screen.getByText("No latency samples yet")).toBeInTheDocument()
    expect(screen.getByText("No uptime samples yet")).toBeInTheDocument()
    expect(screen.getByText("No status code samples yet")).toBeInTheDocument()
    expect(screen.getByText("No response size samples yet")).toBeInTheDocument()
    expect(screen.getByText("No protocol latency samples yet")).toBeInTheDocument()
    expect(screen.getByText("No incidents in the loaded history.")).toBeInTheDocument()
    expect(screen.getByText("No failure reasons yet")).toBeInTheDocument()
  })

  it("uses selected range for latency and uptime charts", () => {
    const now = Date.now()
    const samples = [
      makeSample(new Date(now - 90 * 60 * 1000).toISOString(), "up", 155),
      makeSample(new Date(now).toISOString(), "up", 95),
    ]
    render(<NeonOperationsWall samples={samples} range="1h" />)
    const rangeChecksCard = screen.getByText("Checks in range").closest("article")
    expect(within(rangeChecksCard as HTMLElement).getByText("1")).toBeInTheDocument()
    expect(screen.queryByText("No latency samples yet")).toBeNull()
    expect(screen.queryByText("No uptime samples yet")).toBeNull()
  })

  it("handles nullable status and latency branches", () => {
    const now = Date.now()
    const samples: Sample[] = [
      {
        monitorId: "http-1",
        monitorName: "HTTP monitor",
        monitorType: "http",
        checkedAt: new Date(now - 60 * 60 * 1000).toISOString(),
        status: "up",
        latencyMs: null,
        statusCode: null,
        errorMessage: null,
        meta: {
          responseBytes: null,
        },
      },
      {
        monitorId: "tcp-1",
        monitorName: "TCP monitor",
        monitorType: "tcp",
        checkedAt: new Date(now - 20 * 60 * 1000).toISOString(),
        status: "down",
        latencyMs: 240,
        statusCode: 503,
        errorMessage:
          "very long timeout reason that should be truncated in top failure reasons panel display",
        meta: {
          responseBytes: 800,
        },
      },
    ]

    render(<NeonOperationsWall samples={samples} />)
    expect(screen.getByText("Failed checks")).toBeInTheDocument()
    expect(screen.getByText("Top Failure Reasons")).toBeInTheDocument()
  })

  it("shows empty state when response bytes are unavailable", () => {
    const now = Date.now()
    const samples: Sample[] = [
      {
        monitorId: "http-no-bytes",
        monitorName: "HTTP monitor",
        monitorType: "http",
        checkedAt: new Date(now - 10 * 60 * 1000).toISOString(),
        status: "up",
        latencyMs: 120,
        statusCode: 200,
        errorMessage: null,
        meta: {
          responseBytes: null,
        },
      },
    ]

    render(<NeonOperationsWall samples={samples} />)
    expect(screen.getByText("No response size samples yet")).toBeInTheDocument()
  })

  it("drops non numeric response byte strings from trend data", () => {
    const now = Date.now()
    const samples: Sample[] = [
      {
        monitorId: "http-string-bytes",
        monitorName: "HTTP monitor",
        monitorType: "http",
        checkedAt: new Date(now - 10 * 60 * 1000).toISOString(),
        status: "up",
        latencyMs: 100,
        statusCode: 200,
        errorMessage: null,
        meta: {
          responseBytes: "not-a-number",
        },
      },
    ]

    render(<NeonOperationsWall samples={samples} />)
    expect(screen.getByText("No response size samples yet")).toBeInTheDocument()
  })

  it("accepts numeric response byte strings", () => {
    const now = Date.now()
    const samples: Sample[] = [
      {
        monitorId: "http-string-number",
        monitorName: "HTTP monitor",
        monitorType: "http",
        checkedAt: new Date(now - 10 * 60 * 1000).toISOString(),
        status: "up",
        latencyMs: 100,
        statusCode: 200,
        errorMessage: null,
        meta: {
          responseBytes: "512",
        },
      },
    ]

    render(<NeonOperationsWall samples={samples} />)
    expect(screen.queryByText("No response size samples yet")).toBeNull()
  })

  it("uses controlled range and emits onRangeChange", () => {
    const onRangeChange = jest.fn()
    render(<NeonOperationsWall samples={[]} range="6h" onRangeChange={onRangeChange} />)
    const rangeSelect = screen.getByLabelText("Time range")
    expect(rangeSelect).toHaveValue("6h")
    fireEvent.change(rangeSelect, { target: { value: "1h" } })
    expect(onRangeChange).toHaveBeenCalledWith("1h")
  })

  it("renders injected filter panel content", () => {
    render(
      <NeonOperationsWall
        samples={[]}
        filterPanel={<div data-testid="injected-filter-panel">Custom filter panel</div>}
      />
    )

    expect(screen.getByTestId("injected-filter-panel")).toBeInTheDocument()
    expect(screen.getByText("Custom filter panel")).toBeInTheDocument()
  })

  it("renders recent incidents table rows when provided", () => {
    const openedAt = new Date("2026-05-04T14:00:00.000Z").toISOString()
    const closedAt = new Date("2026-05-04T14:30:00.000Z").toISOString()
    render(
      <NeonOperationsWall
        samples={[]}
        recentIncidents={[
          {
            monitorId: "mid",
            monitorName: "Payments API",
            openedAt,
            closedAt,
            durationMinutes: 30,
            reason: "502",
          },
        ]}
      />
    )

    expect(screen.getByRole("link", { name: "Payments API" })).toHaveAttribute(
      "href",
      "/dashboard/monitors/mid"
    )
    expect(screen.getByText("30 min")).toBeInTheDocument()
    expect(screen.queryByText("No incidents in the loaded history.")).toBeNull()
  })

  it("shows Open when an incident has no closed time", () => {
    render(
      <NeonOperationsWall
        samples={[]}
        recentIncidents={[
          {
            monitorId: "m-open",
            monitorName: "Edge",
            openedAt: new Date("2026-05-05T09:00:00.000Z").toISOString(),
            closedAt: null,
            durationMinutes: 5,
            reason: null,
          },
        ]}
      />
    )

    expect(screen.getByText("Open")).toBeInTheDocument()
  })

  it("renders normal latency badges when latency is stable but uptime signals anomaly", () => {
    mockDetectDashboardAnomalies.mockReturnValue({
      latency: {
        status: "normal",
        baselineP95: 100,
        observedP95: 105,
        deltaPercent: 5,
        modifiedZ: 0.5,
        reason: "Latency within expected variation for recent buckets",
      },
      uptime: {
        status: "anomaly",
        minRecentUptime: 70,
        recentBucketsChecked: 3,
        trailingDownStreak: 0,
        shortWindowBurnRate: 12,
        longWindowBurnRate: 3,
        sloAvailability: 0.99,
        reason: "Error budget burn is high on recent checks (~12x) and elevated over the full window (~3x) vs 99% availability",
      },
    })

    render(<NeonOperationsWall samples={[]} />)

    expect(screen.getByText("Latency within expected variation for recent buckets")).toBeInTheDocument()
    expect(
      screen.getByText(
        "Error budget burn is high on recent checks (~12x) and elevated over the full window (~3x) vs 99% availability"
      )
    ).toBeInTheDocument()

    const latencyRow = screen.getByText("Latency p95").closest("div")
    expect(latencyRow).not.toBeNull()
    expect(within(latencyRow as HTMLElement).getByText("Normal")).toBeInTheDocument()

    const uptimeRow = screen.getByText("Uptime").closest("div")
    expect(uptimeRow).not.toBeNull()
    expect(within(uptimeRow as HTMLElement).getByText("Anomaly")).toBeInTheDocument()
  })

  it("renders anomaly reasons returned by the detector", () => {
    mockDetectDashboardAnomalies.mockReturnValue({
      latency: {
        status: "anomaly",
        baselineP95: 100,
        observedP95: 300,
        deltaPercent: 200,
        modifiedZ: 4,
        reason: "Latest bucket p95 300 ms vs baseline median 100 ms",
      },
      uptime: {
        status: "normal",
        minRecentUptime: 99,
        recentBucketsChecked: 3,
        trailingDownStreak: 0,
        shortWindowBurnRate: 0.5,
        longWindowBurnRate: 0.4,
        sloAvailability: 0.99,
        reason: "Uptime within expected range for error budget and trailing checks",
      },
    })

    render(<NeonOperationsWall samples={[]} />)

    expect(screen.getByText("Latest bucket p95 300 ms vs baseline median 100 ms")).toBeInTheDocument()
    expect(screen.getByText("Uptime within expected range for error budget and trailing checks")).toBeInTheDocument()
    expect(screen.getAllByText("Anomaly").length).toBeGreaterThanOrEqual(1)
  })

  it("recomputes anomalies when the time range changes", () => {
    const now = Date.now()
    const samples = [
      makeSample(new Date(now - 15 * 60 * 1000).toISOString(), "up", 100),
      makeSample(new Date(now - 45 * 60 * 1000).toISOString(), "up", 110),
      makeSample(new Date(now - 12 * 60 * 60 * 1000).toISOString(), "up", 105),
      makeSample(new Date(now - 36 * 60 * 60 * 1000).toISOString(), "up", 108),
    ]

    render(<NeonOperationsWall samples={samples} />)

    const firstBucketLen = mockDetectDashboardAnomalies.mock.calls[0][0].length

    fireEvent.change(screen.getByLabelText("Time range"), { target: { value: "1h" } })

    const lastBucketLen = mockDetectDashboardAnomalies.mock.calls[mockDetectDashboardAnomalies.mock.calls.length - 1][0]
      .length

    expect(lastBucketLen).not.toBe(firstBucketLen)
  })

  it("shows not enough data when samples cannot bucket anomalies", () => {
    render(<NeonOperationsWall samples={[]} />)
    expect(screen.getAllByText("Not enough data").length).toBe(2)
  })

  it("filters recent incidents by selected time range", () => {
    const now = Date.now()
    const samples = [makeSample(new Date(now).toISOString(), "up", 120)]
    const recentOpenedAt = new Date(now - 10 * 60 * 1000).toISOString()
    const oldOpenedAt = new Date(now - 2 * 60 * 60 * 1000).toISOString()

    render(
      <NeonOperationsWall
        samples={samples}
        recentIncidents={[
          {
            monitorId: "m-recent",
            monitorName: "Recent monitor",
            openedAt: recentOpenedAt,
            closedAt: null,
            durationMinutes: 10,
            reason: null,
          },
          {
            monitorId: "m-old",
            monitorName: "Old monitor",
            openedAt: oldOpenedAt,
            closedAt: null,
            durationMinutes: 120,
            reason: null,
          },
        ]}
      />
    )

    fireEvent.change(screen.getByLabelText("Time range"), { target: { value: "1h" } })
    expect(screen.getByRole("link", { name: "Recent monitor" })).toBeInTheDocument()
    expect(screen.queryByRole("link", { name: "Old monitor" })).toBeNull()
  })
})
