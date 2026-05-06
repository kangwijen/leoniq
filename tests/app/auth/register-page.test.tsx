import { render, screen } from "@testing-library/react"
import RegisterPage from "@/app/auth/register/page"
import { getServerSession } from "@/lib/session"
import { redirect } from "next/navigation"

jest.mock("next/navigation", () => ({
  redirect: jest.fn(),
}))

jest.mock("@/lib/session", () => ({
  getServerSession: jest.fn(),
}))

jest.mock("@/components/auth/auth-form", () => ({
  AuthForm: ({ mode }: { mode: string }) => <div data-testid="auth-form">{mode}</div>,
}))

describe("RegisterPage", () => {
  it("redirects to dashboard when session exists", async () => {
    const mockedGetServerSession = getServerSession as jest.Mock
    mockedGetServerSession.mockResolvedValue({ user: { id: "u1" } })

    await RegisterPage()

    expect(redirect).toHaveBeenCalledWith("/dashboard")
  })

  it("renders register form when unauthenticated", async () => {
    const mockedGetServerSession = getServerSession as jest.Mock
    mockedGetServerSession.mockResolvedValue(null)
    const page = await RegisterPage()

    render(page)

    expect(screen.getByTestId("auth-form")).toHaveTextContent("register")
  })
})
