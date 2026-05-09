import { render, screen } from "@testing-library/react"
import { LatencySparkline } from "@/components/dashboard/latency-sparkline"

describe("LatencySparkline", () => {
  it("renders empty state when latency series is empty", () => {
    render(<LatencySparkline values={[]} />)
    expect(screen.getByText("No latency data")).toBeInTheDocument()
  })

  it("renders svg trend with accessible label", () => {
    render(<LatencySparkline values={[120, 200, 140]} />)
    expect(screen.getByRole("img", { name: "Latency past 24 hours, latest 140 milliseconds" })).toBeInTheDocument()
  })

  it("handles flat latency series without divide by zero", () => {
    render(<LatencySparkline values={[100, 100, 100]} />)
    expect(screen.getByRole("img", { name: "Latency past 24 hours, latest 100 milliseconds" })).toBeInTheDocument()
  })
})
