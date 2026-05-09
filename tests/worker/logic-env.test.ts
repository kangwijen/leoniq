/** @jest-environment node */

describe("worker/logic env-driven constants", () => {
  const saved = { ...process.env }

  afterEach(() => {
    process.env = { ...saved }
    jest.resetModules()
  })

  it("reads WORKER_POLL_INTERVAL_MS and MONITOR_RETENTION_DAYS from env when set", async () => {
    process.env.WORKER_POLL_INTERVAL_MS = "25000"
    process.env.MONITOR_RETENTION_DAYS = "14"
    jest.resetModules()
    const mod = await import("../../worker/logic")
    expect(mod.WORKER_POLL_INTERVAL_MS).toBe(25000)
    expect(mod.MAX_RETENTION_DAYS).toBe(14)
  })

  it("uses built-in defaults when worker env vars are unset", async () => {
    delete process.env.WORKER_POLL_INTERVAL_MS
    delete process.env.MONITOR_RETENTION_DAYS
    jest.resetModules()
    const mod = await import("../../worker/logic")
    expect(mod.WORKER_POLL_INTERVAL_MS).toBe(10000)
    expect(mod.MAX_RETENTION_DAYS).toBe(30)
  })
})
