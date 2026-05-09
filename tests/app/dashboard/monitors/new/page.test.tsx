import { render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import NewMonitorPage from "@/app/dashboard/monitors/new/page"
import { requireSession } from "@/lib/session"

jest.mock("next/link", () => {
  return {
    __esModule: true,
    default: ({ href, children }: { href: string; children: ReactNode }) => (
      <a href={href}>{children}</a>
    ),
  }
})

jest.mock("@/components/ui/button", () => ({
  Button: ({ children }: { children: ReactNode; asChild?: boolean }) => <>{children}</>,
}))

jest.mock("@/components/dashboard/monitor-form", () => ({
  MonitorForm: () => <div data-testid="monitor-form" />,
}))

jest.mock("@/lib/session", () => ({
  requireSession: jest.fn(),
}))

const mockRequireSession = requireSession as jest.MockedFunction<typeof requireSession>

describe("NewMonitorPage", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("requires session and renders add monitor flow", async () => {
    mockRequireSession.mockResolvedValue({
      user: { id: "user-1" },
    } as Awaited<ReturnType<typeof requireSession>>)

    render(await NewMonitorPage())

    expect(mockRequireSession).toHaveBeenCalledTimes(1)
    expect(screen.getByRole("heading", { name: "Add Monitor" })).toBeInTheDocument()
    expect(screen.getByTestId("monitor-form")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Back to dashboard" })).toHaveAttribute("href", "/dashboard")
  })
})
