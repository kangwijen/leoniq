/** @jest-environment node */
const drizzleFn = jest.fn(() => ({ drizzleDb: true }))
const postgresFn = jest.fn(() => ({ pgClient: true }))

jest.mock("postgres", () => ({
  __esModule: true,
  default: postgresFn,
}))

jest.mock("drizzle-orm/postgres-js", () => ({
  drizzle: drizzleFn,
}))

describe("lib/db/client", () => {
  const originalEnv = process.env

  beforeEach(() => {
    jest.resetModules()
    postgresFn.mockClear()
    drizzleFn.mockClear()
    process.env = { ...originalEnv }
  })

  afterAll(() => {
    process.env = originalEnv
  })

  it("builds drizzle client with postgres driver", async () => {
    process.env.DATABASE_URL = "postgres://user:pass@localhost:5432/app"
    const { db } = await import("@/lib/db/client")
    expect(postgresFn).toHaveBeenCalledWith(
      "postgres://user:pass@localhost:5432/app",
      expect.objectContaining({
        max: 10,
      })
    )
    expect(drizzleFn).toHaveBeenCalledTimes(1)
    expect((drizzleFn.mock.calls[0] as unknown as [unknown])[0]).toEqual({ pgClient: true })
    expect(db).toEqual({ drizzleDb: true })
  })

  it("uses default database URL when env var is missing", async () => {
    const merged = { ...process.env }
    delete merged.DATABASE_URL
    process.env = merged
    jest.resetModules()
    await import("@/lib/db/client")
    expect(postgresFn).toHaveBeenCalledWith(
      "postgres://postgres:postgres@localhost:5432/leoniq",
      expect.any(Object)
    )
  })
})
