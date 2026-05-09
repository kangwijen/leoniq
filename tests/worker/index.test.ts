/** @jest-environment node */
jest.mock("dotenv/config", () => ({}))

jest.mock("ws", () => ({
  WebSocketServer: jest.fn().mockImplementation(() => ({
    clients: new Set(),
  })),
}))

jest.mock("../../lib/monitor/executor", () => ({
  executeAndPersistMonitorCheck: jest.fn().mockResolvedValue({
    status: "up",
    latencyMs: 1,
  }),
}))

const mockSelect = jest.fn()
const mockDelete = jest.fn()

jest.mock("../../lib/db/client", () => ({
  db: {
    select: mockSelect,
    delete: mockDelete,
    insert: jest.fn(),
  },
}))

describe("worker/index", () => {
  const originalEnv = process.env

  beforeEach(() => {
    jest.resetModules()
    jest.clearAllMocks()
    mockSelect.mockImplementation(() => ({
      from: jest.fn(() => ({
        where: jest.fn(() => Promise.resolve([])),
      })),
    }))
    mockDelete.mockImplementation(() => ({
      where: jest.fn(() => Promise.resolve()),
    }))
    process.env = {
      ...originalEnv,
      WORKER_POLL_INTERVAL_MS: "1",
      WEBHOOK_SUMMARY_INTERVAL_MS: "9999999999999999",
      WS_PORT: "4012",
    }
  })

  afterEach(() => {
    jest.useRealTimers()
    process.env = originalEnv
    jest.clearAllTimers()
  })

  it(
    "runs polling cycles with mocked database and timers",
    async () => {
      jest.useFakeTimers()

      await import("../../worker/index")

      for (let i = 0; i < 8; i += 1) {
        await Promise.resolve()
        await jest.advanceTimersByTimeAsync(5)
      }

      expect(mockSelect).toHaveBeenCalled()
      expect(mockDelete).toHaveBeenCalled()
    },
    15000
  )
})
