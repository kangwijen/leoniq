/** @jest-environment node */
import { NextRequest } from "next/server"
import { proxy } from "@/proxy"
import { auth } from "@/lib/auth"

jest.mock("@/lib/auth", () => ({
  auth: {
    api: {
      getSession: jest.fn(),
    },
  },
}))

const mockGetSession = auth.api.getSession as jest.MockedFunction<typeof auth.api.getSession>

describe("proxy middleware", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("redirects to login when a protected route has no session", async () => {
    mockGetSession.mockResolvedValue(null)
    const request = new NextRequest(new URL("http://localhost:3000/dashboard"))

    const response = await proxy(request)

    expect(mockGetSession).toHaveBeenCalledWith({ headers: request.headers })
    expect(response.headers.get("location")).toBe(new URL("/auth/login", request.url).toString())
  })

  it("redirects to login for api monitors routes without session", async () => {
    mockGetSession.mockResolvedValue(null)
    const request = new NextRequest(new URL("http://localhost:3000/api/monitors"))

    const response = await proxy(request)

    expect(response.headers.get("location")).toBe(new URL("/auth/login", request.url).toString())
  })

  it("redirects auth pages to dashboard when session exists", async () => {
    mockGetSession.mockResolvedValue({ user: { id: "u1" } } as Awaited<
      ReturnType<typeof mockGetSession>
    >)
    const loginRequest = new NextRequest(new URL("http://localhost:3000/auth/login"))
    const loginResponse = await proxy(loginRequest)
    expect(loginResponse.headers.get("location")).toBe(new URL("/dashboard", loginRequest.url).toString())

    const registerRequest = new NextRequest(new URL("http://localhost:3000/auth/register"))
    const registerResponse = await proxy(registerRequest)
    expect(registerResponse.headers.get("location")).toBe(
      new URL("/dashboard", registerRequest.url).toString()
    )
  })

  it("calls NextResponse.next for public routes without session", async () => {
    mockGetSession.mockResolvedValue(null)
    const request = new NextRequest(new URL("http://localhost:3000/"))

    const response = await proxy(request)

    expect(response.headers.get("location")).toBeNull()
    expect(response.status).toBe(200)
  })

  it("calls NextResponse.next when protected route has session", async () => {
    mockGetSession.mockResolvedValue({ user: { id: "u1" } } as Awaited<
      ReturnType<typeof mockGetSession>
    >)
    const request = new NextRequest(new URL("http://localhost:3000/dashboard/monitors/abc"))

    const response = await proxy(request)

    expect(response.headers.get("location")).toBeNull()
    expect(response.status).toBe(200)
  })

  it("calls NextResponse.next on auth pages without session", async () => {
    mockGetSession.mockResolvedValue(null)
    const request = new NextRequest(new URL("http://localhost:3000/auth/login"))

    const response = await proxy(request)

    expect(response.headers.get("location")).toBeNull()
    expect(response.status).toBe(200)
  })
})
