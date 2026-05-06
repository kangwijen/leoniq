import { render, screen } from "@testing-library/react"
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

describe("ui Table", () => {
  it("renders all table slots and classes", () => {
    render(
      <Table className="custom-table">
        <TableCaption>Monitors</TableCaption>
        <TableHeader className="custom-header">
          <TableRow className="custom-row">
            <TableHead className="custom-head">Name</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell className="custom-cell">API</TableCell>
          </TableRow>
        </TableBody>
        <TableFooter className="custom-footer">
          <TableRow>
            <TableCell>Total</TableCell>
          </TableRow>
        </TableFooter>
      </Table>
    )

    expect(screen.getByText("Monitors").closest("[data-slot='table-caption']")).toHaveClass(
      "text-muted-foreground"
    )
    expect(screen.getByText("Name").closest("[data-slot='table-head']")).toHaveClass("custom-head")
    expect(screen.getByText("API").closest("[data-slot='table-cell']")).toHaveClass("custom-cell")
    expect(screen.getByText("Total").closest("[data-slot='table-footer']")).toHaveClass("custom-footer")
    expect(screen.getByRole("table")).toHaveClass("custom-table")
    expect(screen.getByRole("table").closest("[data-slot='table-container']")).toBeInTheDocument()
  })
})
