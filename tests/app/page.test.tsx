import { render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import HomePage from "@/app/page"
import { getServerSession } from "@/lib/session"
import { redirect } from "next/navigation"

jest.mock("next/navigation", () => ({
  redirect: jest.fn(),
}))

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

jest.mock("@/lib/session", () => ({
  getServerSession: jest.fn(),
}))

const mockGetServerSession = getServerSession as jest.MockedFunction<typeof getServerSession>

describe("HomePage", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("redirects to dashboard when session exists", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: "u1" } } as Awaited<
      ReturnType<typeof getServerSession>
    >)

    await HomePage()

    expect(redirect).toHaveBeenCalledWith("/dashboard")
  })

  it("renders marketing UI when unauthenticated", async () => {
    mockGetServerSession.mockResolvedValue(null)

    const element = await HomePage()
    render(element)

    expect(redirect).not.toHaveBeenCalled()
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Monitor websites and socket services with live status graphs."
    )
    expect(screen.getByRole("link", { name: "Create account" })).toHaveAttribute(
      "href",
      "/auth/register"
    )
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/auth/login")
  })
})
