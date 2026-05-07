import { render } from "@testing-library/react"
import { RealtimeRefresh, getWsUrl } from "@/components/dashboard/realtime-refresh"

const refreshMock = jest.fn()
const sockets: MockSocket[] = []

class MockSocket {
  static OPEN = 1
  url: string
  onmessage: null | (() => void) = null
  onclose: null | (() => void) = null

  constructor(url: string) {
    this.url = url
    sockets.push(this)
  }

  close() {
    if (this.onclose) {
      this.onclose()
    }
  }
}

jest.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: refreshMock,
  }),
}))

describe("RealtimeRefresh", () => {
  beforeEach(() => {
    jest.useFakeTimers()
    jest.clearAllMocks()
    sockets.length = 0
    Object.defineProperty(global, "WebSocket", {
      writable: true,
      value: MockSocket,
    })
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it("debounces refresh calls from websocket messages", () => {
    render(<RealtimeRefresh />)

    expect(sockets).toHaveLength(1)
    expect(sockets[0].url).toBe("ws://localhost:4001")

    sockets[0].onmessage?.()
    sockets[0].onmessage?.()
    jest.advanceTimersByTime(249)
    expect(refreshMock).not.toHaveBeenCalled()

    jest.advanceTimersByTime(1)
    expect(refreshMock).toHaveBeenCalledTimes(1)
  })

  it("reconnects when websocket closes", () => {
    render(<RealtimeRefresh />)

    sockets[0].onclose?.()
    expect(sockets).toHaveLength(1)

    jest.advanceTimersByTime(1500)
    expect(sockets).toHaveLength(2)
  })

  it("uses NEXT_PUBLIC_WS_URL when configured", () => {
    process.env.NEXT_PUBLIC_WS_URL = "wss://events.example.com/socket"
    render(<RealtimeRefresh />)
    expect(sockets[0].url).toBe("wss://events.example.com/socket")
    delete process.env.NEXT_PUBLIC_WS_URL
  })

  it("returns explicit env websocket URL helper value", () => {
    process.env.NEXT_PUBLIC_WS_URL = "wss://events.example.com/socket"
    expect(getWsUrl()).toBe("wss://events.example.com/socket")
    delete process.env.NEXT_PUBLIC_WS_URL
  })
})
