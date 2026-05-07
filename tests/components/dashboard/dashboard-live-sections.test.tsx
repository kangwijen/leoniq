import { fireEvent, render, screen } from "@testing-library/react"
import { DashboardLiveSections } from "@/components/dashboard/dashboard-live-sections"

const mockReplace = jest.fn()
let mockSearchValue = "type=http&tag=prod"

jest.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: mockReplace,
  }),
  usePathname: () => "/dashboard",
  useSearchParams: () => new URLSearchParams(mockSearchValue),
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
    <select value={value} onChange={event => onValueChange(event.target.value)}>
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

jest.mock("@/components/dashboard/neon-operations-wall", () => ({
  NeonOperationsWall: ({
    samples,
    filterPanel,
  }: {
    samples: unknown[]
    filterPanel?: React.ReactNode
  }) => (
    <div data-testid="operations-wall" data-count={samples.length}>
      {filterPanel}
    </div>
  ),
}))

jest.mock("@/components/dashboard/monitor-table", () => ({
  MonitorTable: ({ monitors }: { monitors: unknown[] }) => (
    <div data-testid="monitor-table" data-count={monitors.length} />
  ),
}))

describe("DashboardLiveSections query persistence", () => {
  beforeEach(() => {
    mockReplace.mockClear()
    mockReplace.mockImplementation((url: string) => {
      const parts = url.split("?")
      mockSearchValue = parts[1] ?? ""
    })
    mockSearchValue = "type=http&tag=prod"
  })

  it("hydrates filters from query and updates query when changed", () => {
    render(
      <DashboardLiveSections
        samples={[
          {
            monitorId: "m1",
            monitorName: "API",
            monitorType: "http",
            checkedAt: new Date().toISOString(),
            status: "up",
            latencyMs: 120,
            statusCode: 200,
            errorMessage: null,
            meta: null,
          },
        ]}
        monitors={[
          {
            id: "m1",
            name: "API",
            type: "http",
            active: true,
            lastStatus: "up",
            intervalSeconds: 60,
            lastCheckedAt: new Date().toISOString(),
            uptimeSeries: [1, 1],
            latencySeries: [100, 110],
            tags: ["prod"],
          },
        ]}
      />
    )

    const selects = screen.getAllByRole("combobox")
    expect(selects[0]).toHaveValue("http")
    expect(selects[1]).toHaveValue("prod")

    fireEvent.change(selects[0], { target: { value: "all" } })
    fireEvent.change(selects[1], { target: { value: "all" } })

    expect(mockReplace).toHaveBeenCalled()
    expect(mockReplace).toHaveBeenLastCalledWith("/dashboard", { scroll: false })
  })

  it("normalizes invalid tag query and shows empty filter state", () => {
    mockSearchValue = "type=tcp&tag=ghost"

    render(
      <DashboardLiveSections
        samples={[]}
        monitors={[
          {
            id: "m1",
            name: "API",
            type: "http",
            active: true,
            lastStatus: "up",
            intervalSeconds: 60,
            lastCheckedAt: new Date().toISOString(),
            uptimeSeries: [1, 1],
            latencySeries: [100, 110],
            tags: ["prod"],
          },
        ]}
      />
    )

    expect(screen.getByText("Showing 0 of 1 monitors")).toBeInTheDocument()
    expect(mockReplace).not.toHaveBeenCalled()
  })

  it("resets filters when reset button is pressed", () => {
    render(
      <DashboardLiveSections
        samples={[]}
        monitors={[
          {
            id: "m1",
            name: "API",
            type: "http",
            active: true,
            lastStatus: "up",
            intervalSeconds: 60,
            lastCheckedAt: new Date().toISOString(),
            uptimeSeries: [1, 1],
            latencySeries: [100, 110],
            tags: ["prod"],
          },
        ]}
      />
    )

    fireEvent.click(screen.getByRole("button", { name: "Reset filters" }))
    expect(mockReplace).toHaveBeenLastCalledWith("/dashboard", { scroll: false })
  })

  it("defaults filters when query params are missing", () => {
    mockSearchValue = ""

    render(
      <DashboardLiveSections
        samples={[]}
        monitors={[
          {
            id: "m2",
            name: "Socket",
            type: "tcp",
            active: true,
            lastStatus: "up",
            intervalSeconds: 60,
            lastCheckedAt: null,
            uptimeSeries: [1],
            latencySeries: [90],
          },
        ]}
      />
    )

    const selects = screen.getAllByRole("combobox")
    expect(selects[0]).toHaveValue("all")
    expect(selects[1]).toHaveValue("all")
    expect(screen.getByText("Showing 1 of 1 monitors")).toBeInTheDocument()
  })

  it("handles tag filtering when monitor has no tags array", () => {
    mockSearchValue = "type=http&tag=prod"

    render(
      <DashboardLiveSections
        samples={[]}
        monitors={[
          {
            id: "m3",
            name: "HTTP monitor",
            type: "http",
            active: true,
            lastStatus: "up",
            intervalSeconds: 60,
            lastCheckedAt: null,
            uptimeSeries: [1, 1],
            latencySeries: [120, 130],
          },
        ]}
      />
    )

    expect(screen.getByTestId("monitor-table")).toHaveAttribute("data-count", "1")
    expect(mockReplace).not.toHaveBeenCalled()
  })

  it("evaluates tag matching when some monitors omit tags", () => {
    mockSearchValue = "tag=prod"

    render(
      <DashboardLiveSections
        samples={[]}
        monitors={[
          {
            id: "m9",
            name: "Tagged",
            type: "http",
            active: true,
            lastStatus: "up",
            intervalSeconds: 60,
            lastCheckedAt: null,
            uptimeSeries: [1],
            latencySeries: [80],
            tags: ["prod"],
          },
          {
            id: "m10",
            name: "Untagged",
            type: "http",
            active: true,
            lastStatus: "up",
            intervalSeconds: 60,
            lastCheckedAt: null,
            uptimeSeries: [1],
            latencySeries: [80],
          },
        ]}
      />
    )

    expect(screen.getByText("Showing 1 of 2 monitors")).toBeInTheDocument()
    expect(screen.getByTestId("monitor-table")).toHaveAttribute("data-count", "1")
  })

  it("writes type query when selecting a concrete type", () => {
    mockSearchValue = ""

    render(
      <DashboardLiveSections
        samples={[]}
        monitors={[
          {
            id: "m4",
            name: "HTTP monitor",
            type: "http",
            active: true,
            lastStatus: "up",
            intervalSeconds: 60,
            lastCheckedAt: null,
            uptimeSeries: [1],
            latencySeries: [80],
            tags: ["prod"],
          },
        ]}
      />
    )

    const selects = screen.getAllByRole("combobox")
    fireEvent.change(selects[0], { target: { value: "http" } })
    expect(mockReplace).toHaveBeenCalledWith("/dashboard?type=http", { scroll: false })
  })

  it("does not rewrite url when selecting same filter values", () => {
    mockSearchValue = "type=http&tag=prod"

    render(
      <DashboardLiveSections
        samples={[]}
        monitors={[
          {
            id: "m5",
            name: "HTTP monitor",
            type: "http",
            active: true,
            lastStatus: "up",
            intervalSeconds: 60,
            lastCheckedAt: null,
            uptimeSeries: [1],
            latencySeries: [70],
            tags: ["prod"],
          },
        ]}
      />
    )

    const callsBefore = mockReplace.mock.calls.length
    const selects = screen.getAllByRole("combobox")
    fireEvent.change(selects[0], { target: { value: "http" } })
    fireEvent.change(selects[1], { target: { value: "prod" } })
    expect(mockReplace.mock.calls.length).toBe(callsBefore)
  })

  it("filters out monitors when selected tag does not match specific monitor", () => {
    mockSearchValue = "tag=backend"

    render(
      <DashboardLiveSections
        samples={[]}
        monitors={[
          {
            id: "m6",
            name: "Backend API",
            type: "http",
            active: true,
            lastStatus: "up",
            intervalSeconds: 60,
            lastCheckedAt: null,
            uptimeSeries: [1],
            latencySeries: [70],
            tags: ["backend"],
          },
          {
            id: "m7",
            name: "Frontend API",
            type: "http",
            active: true,
            lastStatus: "up",
            intervalSeconds: 60,
            lastCheckedAt: null,
            uptimeSeries: [1],
            latencySeries: [75],
            tags: ["frontend"],
          },
        ]}
      />
    )

    expect(screen.getByText("Showing 1 of 2 monitors")).toBeInTheDocument()
    expect(screen.getByTestId("monitor-table")).toHaveAttribute("data-count", "1")
  })

  it("filters out monitors when selected type does not match", () => {
    mockSearchValue = "type=tcp"

    render(
      <DashboardLiveSections
        samples={[]}
        monitors={[
          {
            id: "m8",
            name: "HTTP only",
            type: "http",
            active: true,
            lastStatus: "up",
            intervalSeconds: 60,
            lastCheckedAt: null,
            uptimeSeries: [1],
            latencySeries: [88],
            tags: ["backend"],
          },
        ]}
      />
    )

    expect(screen.getByText("Showing 0 of 1 monitors")).toBeInTheDocument()
    expect(screen.getByText("No monitors match the current filters. Try another type or tag.")).toBeInTheDocument()
  })
})
