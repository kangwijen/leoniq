import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import type { ReactNode } from "react"
import { AuthForm } from "@/components/auth/auth-form"
import { toast } from "sonner"
import { authClient } from "@/lib/auth-client"

const pushMock = jest.fn()
const refreshMock = jest.fn()

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ href, children }: { href: string; children: ReactNode }) => <a href={href}>{children}</a>,
}))

jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
    refresh: refreshMock,
  }),
}))

jest.mock("sonner", () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}))

jest.mock("@/lib/auth-client", () => ({
  authClient: {
    signIn: {
      email: jest.fn(),
    },
    signUp: {
      email: jest.fn(),
    },
  },
}))

describe("AuthForm", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("submits login and navigates on success", async () => {
    const signInEmailMock = authClient.signIn.email as jest.Mock
    signInEmailMock.mockResolvedValue({ error: null })

    render(<AuthForm mode="login" />)

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "dev@example.com" },
    })
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "supersecurepass" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }))

    await waitFor(() => {
      expect(signInEmailMock).toHaveBeenCalledWith({
        email: "dev@example.com",
        password: "supersecurepass",
      })
      expect(toast.success).toHaveBeenCalledWith("Welcome back")
      expect(pushMock).toHaveBeenCalledWith("/dashboard")
      expect(refreshMock).toHaveBeenCalledTimes(1)
    })
  })

  it("shows login error when credentials are invalid", async () => {
    const signInEmailMock = authClient.signIn.email as jest.Mock
    signInEmailMock.mockResolvedValue({ error: { message: "bad login" } })

    render(<AuthForm mode="login" />)

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "dev@example.com" },
    })
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "supersecurepass" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }))

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Invalid email or password")
    })
    expect(pushMock).not.toHaveBeenCalled()
  })

  it("submits register and navigates on success", async () => {
    const signUpEmailMock = authClient.signUp.email as jest.Mock
    signUpEmailMock.mockResolvedValue({ error: null })

    render(<AuthForm mode="register" />)

    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "Ops Engineer" },
    })
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "ops@example.com" },
    })
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "supersecurepass" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Create account" }))

    await waitFor(() => {
      expect(signUpEmailMock).toHaveBeenCalledWith({
        name: "Ops Engineer",
        email: "ops@example.com",
        password: "supersecurepass",
      })
      expect(toast.success).toHaveBeenCalledWith("Account created")
      expect(pushMock).toHaveBeenCalledWith("/dashboard")
      expect(refreshMock).toHaveBeenCalledTimes(1)
    })
  })

  it("shows register api error", async () => {
    const signUpEmailMock = authClient.signUp.email as jest.Mock
    signUpEmailMock.mockResolvedValue({ error: { message: "email taken" } })

    render(<AuthForm mode="register" />)

    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "Ops Engineer" },
    })
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "ops@example.com" },
    })
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "supersecurepass" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Create account" }))

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("email taken")
    })
    expect(pushMock).not.toHaveBeenCalled()
  })

  it("uses fallback register error when server message is empty", async () => {
    const signUpEmailMock = authClient.signUp.email as jest.Mock
    signUpEmailMock.mockResolvedValue({ error: { message: "" } })

    render(<AuthForm mode="register" />)

    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "Ops Engineer" },
    })
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "ops@example.com" },
    })
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "supersecurepass" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Create account" }))

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Unable to register")
    })
  })

  it("shows network error when auth request throws", async () => {
    const signInEmailMock = authClient.signIn.email as jest.Mock
    signInEmailMock.mockRejectedValue(new Error("network down"))

    render(<AuthForm mode="login" />)

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "dev@example.com" },
    })
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "supersecurepass" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }))

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Network error while submitting authentication request")
    })
  })
})
