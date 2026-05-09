import { fireEvent, render, screen } from "@testing-library/react"
import { MonitorDetailAnalytics } from "@/components/dashboard/monitor-detail-analytics"

jest.mock("@/components/dashboard/monitor-chart", () => ({
  MonitorChart: ({
    title,
    data,
  }: {
    title: string
    data: unknown[]
  }) => (
    <div data-testid={`chart-${title}`} data-chart-length={data.length}>
      {title}
    </div>
  ),
}))

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
    <select
      aria-label="Time range"
      value={value}
      onChange={event => onValueChange(event.target.value)}
    >
      {children}
    </select>
  ),
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectValue: () => null,
  SelectContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectItem: ({ value, children }: { value: string; children: React.ReactNode }) => (
    <option value={value}>{children}</option>
  ),
}))

describe("MonitorDetailAnalytics", () => {
  const servedAtMs = new Date("2026-05-07T12:00:00.000Z").getTime()

  beforeEach(() => {
    jest.useFakeTimers()
    jest.setSystemTime(new Date("2026-05-07T12:00:00.000Z"))
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it("shows empty analytics copy when no points fall in range", () => {
    render(
      <MonitorDetailAnalytics monitorId="m1" monitorName="Svc" servedAtMs={servedAtMs} points={[]} />
    )

    expect(screen.getByText(/Uptime 0\.00%/)).toBeInTheDocument()
    expect(screen.getByText(/Average latency 0 ms/)).toBeInTheDocument()
    expect(screen.getByText("No incidents recorded in this data window.")).toBeInTheDocument()
    expect(screen.getByTestId("chart-Latency Over Time")).toHaveAttribute("data-chart-length", "0")
    expect(screen.getByTestId("chart-Uptime Timeline")).toHaveAttribute("data-chart-length", "0")
  })

  it("changes summary text when range changes", () => {
    render(
      <MonitorDetailAnalytics
        monitorId="m1"
        monitorName="Svc"
        servedAtMs={servedAtMs}
        points={[
          {
            checkedAt: "2026-05-07T11:30:00.000Z",
            latencyMs: 10,
            status: "up",
            errorMessage: null,
          },
        ]}
      />
    )

    expect(screen.getByText(/in the last 24 hours/)).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText("Time range"), { target: { value: "1h" } })

    expect(screen.getByText(/in the last hour/)).toBeInTheDocument()
  })

  it("passes filtered points to charts when data exists", () => {
    const points = [
      {
        checkedAt: "2026-05-07T11:00:00.000Z",
        latencyMs: 100,
        status: "up" as const,
        errorMessage: null,
      },
      {
        checkedAt: "2026-05-07T11:30:00.000Z",
        latencyMs: 200,
        status: "down" as const,
        errorMessage: "timeout",
      },
    ]

    render(
      <MonitorDetailAnalytics monitorId="m1" monitorName="Svc" servedAtMs={servedAtMs} points={points} />
    )

    expect(screen.getByTestId("chart-Latency Over Time")).toHaveAttribute("data-chart-length", "2")
    expect(screen.getByTestId("chart-Uptime Timeline")).toHaveAttribute("data-chart-length", "2")
    expect(screen.getByText(/Uptime 50\.00%/)).toBeInTheDocument()
  })

  it("uses latest point time when points are not chronological", () => {
    render(
      <MonitorDetailAnalytics
        monitorId="m1"
        monitorName="Svc"
        servedAtMs={servedAtMs}
        points={[
          {
            checkedAt: "2026-05-07T11:30:00.000Z",
            latencyMs: 10,
            status: "up",
            errorMessage: null,
          },
          {
            checkedAt: "2026-05-07T11:00:00.000Z",
            latencyMs: 20,
            status: "up",
            errorMessage: null,
          },
        ]}
      />
    )

    expect(screen.getByTestId("chart-Latency Over Time")).toHaveAttribute("data-chart-length", "2")
  })

  it("renders recovered incident when outage closes within range", () => {
    render(
      <MonitorDetailAnalytics
        monitorId="m1"
        monitorName="Svc"
        servedAtMs={servedAtMs}
        points={[
          {
            checkedAt: "2026-05-07T11:00:00.000Z",
            latencyMs: 50,
            status: "down",
            errorMessage: "timeout",
          },
          {
            checkedAt: "2026-05-07T11:05:00.000Z",
            latencyMs: 40,
            status: "up",
            errorMessage: null,
          },
        ]}
      />
    )

    expect(screen.getByText(/Recovered/)).toBeInTheDocument()
    expect(screen.getByText(/timeout/)).toBeInTheDocument()
  })

  it("omits reason line when incident has no error message", () => {
    render(
      <MonitorDetailAnalytics
        monitorId="m1"
        monitorName="Svc"
        servedAtMs={servedAtMs}
        points={[
          {
            checkedAt: "2026-05-07T11:00:00.000Z",
            latencyMs: 50,
            status: "down",
            errorMessage: null,
          },
          {
            checkedAt: "2026-05-07T11:02:00.000Z",
            latencyMs: 40,
            status: "up",
            errorMessage: null,
          },
        ]}
      />
    )

    expect(screen.getByText(/Recovered/)).toBeInTheDocument()
    expect(screen.queryByText(/timeout/)).not.toBeInTheDocument()
  })
})
