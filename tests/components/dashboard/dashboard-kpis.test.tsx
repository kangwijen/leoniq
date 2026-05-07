import { render, screen, within } from "@testing-library/react"
import { DashboardKpis } from "@/components/dashboard/dashboard-kpis"

describe("DashboardKpis", () => {
  it("renders zeroed KPI values for an empty monitor list", () => {
    render(<DashboardKpis monitors={[]} />)

    const totalCard = screen.getByText("Total monitors").closest("article")
    const activeCard = screen.getByText("Active monitors").closest("article")
    const issuesCard = screen.getByText("Monitors down").closest("article")
    const uptimeCard = screen.getByText("Fleet uptime").closest("article")

    expect(totalCard).not.toBeNull()
    expect(activeCard).not.toBeNull()
    expect(issuesCard).not.toBeNull()
    expect(uptimeCard).not.toBeNull()

    expect(within(totalCard as HTMLElement).getByText("0")).toBeInTheDocument()
    expect(within(activeCard as HTMLElement).getByText("0")).toBeInTheDocument()
    expect(within(issuesCard as HTMLElement).getByText("0")).toBeInTheDocument()
    expect(within(uptimeCard as HTMLElement).getByText("0%")).toBeInTheDocument()
  })

  it("calculates and renders KPIs for mixed active and status states", () => {
    render(
      <DashboardKpis
        monitors={[
          { active: true, lastStatus: "up" },
          { active: true, lastStatus: "down" },
          { active: true, lastStatus: "up" },
          { active: false, lastStatus: "down" },
          { active: false, lastStatus: null },
        ]}
      />
    )

    const totalCard = screen.getByText("Total monitors").closest("article")
    const activeCard = screen.getByText("Active monitors").closest("article")
    const issuesCard = screen.getByText("Monitors down").closest("article")
    const uptimeCard = screen.getByText("Fleet uptime").closest("article")

    expect(totalCard).not.toBeNull()
    expect(activeCard).not.toBeNull()
    expect(issuesCard).not.toBeNull()
    expect(uptimeCard).not.toBeNull()

    expect(within(totalCard as HTMLElement).getByText("5")).toBeInTheDocument()
    expect(within(activeCard as HTMLElement).getByText("3")).toBeInTheDocument()
    expect(within(issuesCard as HTMLElement).getByText("1")).toBeInTheDocument()
    expect(within(uptimeCard as HTMLElement).getByText("66.67%")).toBeInTheDocument()
  })
})
