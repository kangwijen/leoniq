/** @jest-environment node */

describe("getWsUrl in node runtime", () => {
  it("falls back to localhost websocket when window is unavailable", async () => {
    const { getWsUrl } = await import("@/components/dashboard/realtime-refresh")
    delete process.env.NEXT_PUBLIC_WS_URL
    expect(getWsUrl()).toBe("ws://localhost:4001")
  })

  it("builds secure websocket URL from https window location", async () => {
    const { getWsUrl } = await import("@/components/dashboard/realtime-refresh")
    delete process.env.NEXT_PUBLIC_WS_URL
    const globalWithWindow = globalThis as unknown as {
      window?: { location: { protocol: string; hostname: string } }
    }
    globalWithWindow.window = {
      location: {
        protocol: "https:",
        hostname: "app.example.com",
      },
    }

    expect(getWsUrl()).toBe("wss://app.example.com:4001")
    delete globalWithWindow.window
  })
})
