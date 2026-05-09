jest.mock("better-auth/next-js", () => ({
  toNextJsHandler: jest.fn(() => ({
    GET: jest.fn(),
    POST: jest.fn(),
  })),
}))

jest.mock("@/lib/auth", () => ({
  auth: { mockAuth: true },
}))

import { GET, POST } from "@/app/api/auth/[...all]/route"
import { toNextJsHandler } from "better-auth/next-js"

describe("app/api/auth/[...all]/route", () => {
  it("delegates to better-auth Next.js handler with auth instance", () => {
    const returned = (toNextJsHandler as jest.Mock).mock.results[0]?.value as {
      GET: unknown
      POST: unknown
    }
    expect(toNextJsHandler).toHaveBeenCalledTimes(1)
    expect(toNextJsHandler).toHaveBeenCalledWith({ mockAuth: true })
    expect(GET).toBe(returned.GET)
    expect(POST).toBe(returned.POST)
  })
})
