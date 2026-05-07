import { fireEvent, render, screen, within } from "@testing-library/react"
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
    expect(within(rangeChecksCard as HTMLElement).getByText("0")).toBeInTheDocument()

    fireEvent.change(rangeSelect, { target: { value: "7d" } })
    expect(rangeSelect).toHaveValue("7d")
    expect(screen.getByText("4")).toBeInTheDocument()
  })

  it("renders all new chart section titles", () => {
    render(<NeonOperationsWall samples={[]} />)

    expect(screen.getByText("Latency Percentiles")).toBeInTheDocument()
    expect(screen.getByText("Uptime Timeline")).toBeInTheDocument()
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
})
