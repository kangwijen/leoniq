/** @jest-environment node */
jest.mock("next/headers", () => ({
  headers: jest.fn(),
}))

jest.mock("next/navigation", () => ({
  redirect: jest.fn(),
}))

jest.mock("@/lib/auth", () => ({
  auth: {
    api: {
      getSession: jest.fn(),
    },
  },
}))

import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { getServerSession, requireSession } from "@/lib/session"

const mockedHeaders = headers as jest.MockedFunction<typeof headers>
const mockedRedirect = redirect as jest.MockedFunction<typeof redirect>
const mockedGetSession = auth.api.getSession as jest.MockedFunction<typeof auth.api.getSession>

describe("lib/session", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockedHeaders.mockResolvedValue(new Headers({ cookie: "session=1" }) as never)
    mockedRedirect.mockImplementation(() => {
      throw new Error("redirect")
    })
  })

  it("getServerSession forwards headers to auth.api.getSession", async () => {
    mockedGetSession.mockResolvedValue(null)
    await getServerSession()
    expect(mockedHeaders).toHaveBeenCalledTimes(1)
    expect(mockedGetSession).toHaveBeenCalledWith({
      headers: expect.any(Headers),
    })
  })

  it("requireSession returns session when present", async () => {
    const session = {
      user: { id: "u1", email: "u@example.com", emailVerified: true, createdAt: new Date(), updatedAt: new Date() },
      session: { id: "s1", userId: "u1", expiresAt: new Date(), token: "t" },
    }
    mockedGetSession.mockResolvedValue(session as never)
    await expect(requireSession()).resolves.toEqual(session)
    expect(mockedRedirect).not.toHaveBeenCalled()
  })

  it("requireSession redirects when session missing", async () => {
    mockedGetSession.mockResolvedValue(null)
    await expect(requireSession()).rejects.toThrow("redirect")
    expect(mockedRedirect).toHaveBeenCalledWith("/auth/login")
  })
})
