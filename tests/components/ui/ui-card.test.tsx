import { render, screen } from "@testing-library/react"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

describe("ui Card", () => {
  it("renders all card slots", () => {
    render(
      <Card size="sm" className="custom-card">
        <CardHeader className="custom-header">
          <CardTitle>Title</CardTitle>
          <CardDescription>Description</CardDescription>
          <CardAction>Action</CardAction>
        </CardHeader>
        <CardContent>Body</CardContent>
        <CardFooter>Footer</CardFooter>
      </Card>
    )

    const card = screen.getByText("Title").closest("[data-slot='card']")
    expect(card).toHaveAttribute("data-size", "sm")
    expect(card).toHaveClass("custom-card")
    expect(screen.getByText("Description")).toBeInTheDocument()
    expect(screen.getByText("Action").closest("[data-slot='card-action']")).toHaveClass(
      "col-start-2"
    )
    expect(screen.getByText("Body").closest("[data-slot='card-content']")).toHaveClass("px-4")
    expect(screen.getByText("Footer").closest("[data-slot='card-footer']")).toHaveClass("border-t")
    expect(screen.getByText("Title").closest("[data-slot='card-title']")).toHaveClass("font-heading")
    expect(screen.getByText("Description").closest("[data-slot='card-description']")).toHaveClass(
      "text-muted-foreground"
    )
  })
})
