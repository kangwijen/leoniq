import { render, screen } from "@testing-library/react"
import { UptimeSparkline } from "@/components/dashboard/uptime-sparkline"

describe("UptimeSparkline", () => {
  it("renders empty state when values are empty", () => {
    render(<UptimeSparkline values={[]} />)
    expect(screen.getByText("No data")).toBeInTheDocument()
  })

  it("renders svg with green styling when latest value is up", () => {
    render(<UptimeSparkline values={[1, 1, 0, 1]} />)
    const img = screen.getByRole("img", {
      name: "Uptime past 24 hours, latest state up",
    })
    expect(img).toBeInTheDocument()
  })

  it("renders svg with red styling when latest value is down", () => {
    render(<UptimeSparkline values={[1, 0]} />)
    expect(
      screen.getByRole("img", {
        name: "Uptime past 24 hours, latest state down",
      })
    ).toBeInTheDocument()
  })

  it("handles single-sample series without divide issues", () => {
    render(<UptimeSparkline values={[1]} />)
    expect(screen.getByRole("img")).toBeInTheDocument()
  })
})
