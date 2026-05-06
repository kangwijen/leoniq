import { fireEvent, render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import DashboardError from "@/app/dashboard/error"

jest.mock("next/link", () => {
  return {
    __esModule: true,
    default: ({ href, children }: { href: string; children: ReactNode }) => (
      <a href={href}>{children}</a>
    ),
  }
})

describe("DashboardError", () => {
  it("calls reset when retry is clicked", () => {
    const reset = jest.fn()

    render(<DashboardError error={new Error("boom")} reset={reset} />)

    fireEvent.click(screen.getByRole("button", { name: "Retry" }))

    expect(reset).toHaveBeenCalledTimes(1)
  })

  it("renders a link back to dashboard", () => {
    const reset = jest.fn()

    render(<DashboardError error={new Error("boom")} reset={reset} />)

    expect(screen.getByRole("link", { name: "Back to Dashboard" })).toHaveAttribute(
      "href",
      "/dashboard"
    )
  })
})
