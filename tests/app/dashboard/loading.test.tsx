import { render } from "@testing-library/react"
import DashboardLoading from "@/app/dashboard/loading"

describe("DashboardLoading", () => {
  it("renders skeleton placeholders", () => {
    const { container } = render(<DashboardLoading />)
    const skeletons = container.querySelectorAll(".animate-pulse")

    expect(skeletons).toHaveLength(6)
  })
})
