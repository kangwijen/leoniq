import { render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import RootLayout from "@/app/layout"

jest.mock("next/font/google", () => ({
  Geist: () => ({
    variable: "--font-geist-sans-mock",
  }),
  Geist_Mono: () => ({
    variable: "--font-geist-mono-mock",
  }),
}))

jest.mock("next-themes", () => ({
  ThemeProvider: ({ children }: { children: ReactNode }) => (
    <div data-testid="theme-provider">{children}</div>
  ),
}))

jest.mock("@/components/ui/sonner", () => ({
  Toaster: () => <div data-testid="toaster" />,
}))

describe("RootLayout", () => {
  it("wraps children with ThemeProvider and renders Toaster", () => {
    render(
      <RootLayout>
        <span data-testid="child">content</span>
      </RootLayout>
    )

    expect(screen.getByTestId("theme-provider")).toContainElement(screen.getByTestId("child"))
    expect(screen.getByTestId("toaster")).toBeInTheDocument()
  })
})
