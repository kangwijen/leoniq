/** @jest-environment node */
const betterAuthMock = jest.fn(() => ({ handler: "mock-auth" }))
const drizzleAdapterMock = jest.fn(() => ({ adapter: "mock-adapter" }))

jest.mock("better-auth", () => ({
  betterAuth: betterAuthMock,
}))

jest.mock("better-auth/adapters/drizzle", () => ({
  drizzleAdapter: drizzleAdapterMock,
}))

jest.mock("@/lib/db/client", () => ({
  db: { mocked: true },
}))

type BetterAuthCallOptions = {
  trustedOrigins?: string[]
  advanced: { defaultCookieAttributes: { secure: boolean } }
}

const firstBetterAuthCallOptions = (): BetterAuthCallOptions =>
  (betterAuthMock.mock.calls[0] as unknown as [BetterAuthCallOptions])[0]

describe("lib/auth", () => {
  const originalEnv = process.env
  const withEnv = (patch: Record<string, string | undefined>) => ({
    ...(originalEnv as Record<string, string | undefined>),
    ...patch,
  })

  beforeEach(() => {
    jest.resetModules()
    betterAuthMock.mockClear()
    drizzleAdapterMock.mockClear()
    process.env = withEnv({
      BETTER_AUTH_SECRET: "secret-secret-secret-secret-secret",
    }) as NodeJS.ProcessEnv
  })

  afterAll(() => {
    process.env = originalEnv
  })

  it("passes trustedOrigins when BETTER_AUTH_URL is set and disables secure cookies outside production", async () => {
    process.env = withEnv({
      BETTER_AUTH_SECRET: "secret-secret-secret-secret-secret",
      BETTER_AUTH_URL: "https://auth.example.com",
      NODE_ENV: "development",
    }) as NodeJS.ProcessEnv
    await import("@/lib/auth")
    expect(betterAuthMock).toHaveBeenCalled()
    const options = firstBetterAuthCallOptions()
    expect(options.trustedOrigins).toEqual(["https://auth.example.com"])
    expect(options.advanced.defaultCookieAttributes.secure).toBe(false)
  })

  it("omits trustedOrigins when BETTER_AUTH_URL is unset", async () => {
    const next = withEnv({
      BETTER_AUTH_SECRET: "secret-secret-secret-secret-secret",
      NODE_ENV: "development",
    })
    delete next.BETTER_AUTH_URL
    process.env = next as NodeJS.ProcessEnv
    await import("@/lib/auth")
    const options = firstBetterAuthCallOptions()
    expect(options.trustedOrigins).toBeUndefined()
  })

  it("marks cookies secure in production", async () => {
    process.env = withEnv({
      BETTER_AUTH_SECRET: "secret-secret-secret-secret-secret",
      BETTER_AUTH_URL: "https://auth.example.com",
      NODE_ENV: "production",
    }) as NodeJS.ProcessEnv
    await import("@/lib/auth")
    const options = firstBetterAuthCallOptions()
    expect(options.advanced.defaultCookieAttributes.secure).toBe(true)
  })

  it("wires drizzle adapter with pg provider", async () => {
    const next = withEnv({
      BETTER_AUTH_SECRET: "secret-secret-secret-secret-secret",
      NODE_ENV: "test",
    })
    delete next.BETTER_AUTH_URL
    process.env = next as NodeJS.ProcessEnv
    await import("@/lib/auth")
    expect(drizzleAdapterMock).toHaveBeenCalledWith({ mocked: true }, { provider: "pg" })
  })
})
