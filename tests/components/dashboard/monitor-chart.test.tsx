import { render, screen } from "@testing-library/react"
import { MonitorChart } from "@/components/dashboard/monitor-chart"

jest.mock("recharts", () => {
  const areaChartMock = jest.fn(
    ({ children }: { children?: React.ReactNode }) => <div data-testid="area-chart">{children}</div>
  )
  const areaMock = jest.fn(() => <div data-testid="area" />)
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
      formatter(1, "series")
      formatter(0, "series")
      formatter(250, "series")
    }
    if (typeof labelFormatter === "function") {
      labelFormatter("2026-05-07T00:00:00.000Z")
    }
    if (typeof tickFormatter === "function") {
      tickFormatter(1)
      tickFormatter(0)
    }
    return <div />
  }

  return {
    ResponsiveContainer: passthrough,
    AreaChart: areaChartMock,
    CartesianGrid: leaf,
    XAxis: leaf,
    YAxis: leaf,
    Tooltip: leaf,
    Area: areaMock,
    __areaChartMock: areaChartMock,
    __areaMock: areaMock,
  }
})

const rechartsMock = jest.requireMock("recharts") as {
  __areaChartMock: jest.Mock
  __areaMock: jest.Mock
}

describe("MonitorChart", () => {
  beforeEach(() => {
    rechartsMock.__areaChartMock.mockClear()
    rechartsMock.__areaMock.mockClear()
  })

  it("renders default latency mode and maps latency values", () => {
    const latencyData = [
      { checkedAt: "2026-05-07T00:00:00.000Z", latencyMs: 120, status: "up" as const },
      { checkedAt: "2026-05-07T00:01:00.000Z", latencyMs: 340, status: "down" as const },
    ]

    render(<MonitorChart title="Latency Trend" data={latencyData} />)

    expect(screen.getByText("Latency Trend")).toBeInTheDocument()

    const areaChartProps = rechartsMock.__areaChartMock.mock.calls[0]?.[0] as {
      data: Array<{ latencyMs: number | null }>
    }
    expect(areaChartProps.data).toEqual(latencyData)
    expect(areaChartProps.data.map(point => point.latencyMs)).toEqual([120, 340])

    const areaProps = rechartsMock.__areaMock.mock.calls[0]?.[0] as { dataKey: string; type: string }
    expect(areaProps.dataKey).toBe("latencyMs")
    expect(areaProps.type).toBe("monotone")
  })

  it("maps uptime mode to uptimeValue and renders safely", () => {
    const uptimeData = [
      { checkedAt: "2026-05-07T00:00:00.000Z", latencyMs: null, status: "up" as const },
      { checkedAt: "2026-05-07T00:01:00.000Z", latencyMs: null, status: "down" as const },
      { checkedAt: "2026-05-07T00:02:00.000Z", latencyMs: 90, status: "up" as const },
    ]

    expect(() =>
      render(<MonitorChart title="Uptime Timeline" data={uptimeData} mode="uptime" />)
    ).not.toThrow()
    expect(screen.getByText("Uptime Timeline")).toBeInTheDocument()

    const areaChartProps = rechartsMock.__areaChartMock.mock.calls[0]?.[0] as {
      data: Array<{ status: "up" | "down"; uptimeValue?: number }>
    }
    expect(areaChartProps.data.map(point => point.uptimeValue)).toEqual([1, 0, 1])

    const areaProps = rechartsMock.__areaMock.mock.calls[0]?.[0] as { dataKey: string; type: string }
    expect(areaProps.dataKey).toBe("uptimeValue")
    expect(areaProps.type).toBe("stepAfter")
  })
})
