import { render, screen } from "@testing-library/react"
import { Badge } from "@/components/ui/badge"

describe("ui Badge", () => {
  it("renders default variant", () => {
    render(<Badge>Stable</Badge>)

    const badge = screen.getByText("Stable")
    expect(badge).toHaveAttribute("data-slot", "badge")
    expect(badge).toHaveAttribute("data-variant", "default")
  })

  it("renders as child with custom variant", () => {
    render(
      <Badge asChild variant="ghost">
        <a href="/status">Ghost badge</a>
      </Badge>
    )

    const badgeLink = screen.getByRole("link", { name: "Ghost badge" })
    expect(badgeLink).toHaveAttribute("data-slot", "badge")
    expect(badgeLink).toHaveAttribute("data-variant", "ghost")
  })
})
