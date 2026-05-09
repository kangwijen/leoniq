jest.mock("better-auth/react", () => ({
  createAuthClient: jest.fn(() => ({
    signIn: jest.fn(),
    signOut: jest.fn(),
  })),
}))

import { createAuthClient } from "better-auth/react"
import { authClient } from "@/lib/auth-client"

describe("lib/auth-client", () => {
  it("creates auth client via better-auth/react", () => {
    expect(createAuthClient).toHaveBeenCalledTimes(1)
    expect(createAuthClient).toHaveBeenCalledWith()
    expect(authClient).toEqual({
      signIn: expect.any(Function),
      signOut: expect.any(Function),
    })
  })
})
