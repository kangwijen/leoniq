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
  NeonOperationsWall: ({ samples }: { samples: unknown[] }) => (
    <div data-testid="operations-wall" data-count={samples.length} />
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
})
