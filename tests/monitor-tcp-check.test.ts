import { EventEmitter } from "node:events"
import net from "node:net"
import { runTcpCheck } from "../lib/monitor/tcp-check"

class MockSocket extends EventEmitter {
  destroy = jest.fn()
  setTimeout = jest.fn()
  connect = jest.fn()
}

const socketFactory = net as unknown as { Socket: jest.Mock }

jest.mock("node:net", () => ({
  __esModule: true,
  default: {
    Socket: jest.fn(),
  },
}))

describe("runTcpCheck", () => {
  it("returns validation error for invalid port", async () => {
    const result = await runTcpCheck({
      host: "example.com",
      port: 65536,
      timeoutMs: 1000,
    })

    expect(result).toEqual({
      status: "down",
      latencyMs: 0,
      errorMessage: "Port must be between 1 and 65535",
    })
  })

  it("returns validation error for blocked private host", async () => {
    const result = await runTcpCheck({
      host: "192.168.1.10",
      port: 443,
      timeoutMs: 1000,
    })

    expect(result).toEqual({
      status: "down",
      latencyMs: 0,
      errorMessage: "Private network targets are blocked",
    })
  })

  it("returns up when socket connects", async () => {
    const socket = new MockSocket()
    socket.connect.mockImplementation(() => {
      setTimeout(() => socket.emit("connect"), 0)
    })
    socketFactory.Socket.mockImplementation(() => socket)

    const result = await runTcpCheck({
      host: "example.com",
      port: 443,
      timeoutMs: 500,
    })

    expect(result.status).toBe("up")
    expect(result.errorMessage).toBeUndefined()
    expect(socket.connect).toHaveBeenCalledWith(443, "example.com")
    expect(socket.destroy).toHaveBeenCalledTimes(1)
  })

  it("returns down when socket errors", async () => {
    const socket = new MockSocket()
    socket.connect.mockImplementation(() => {
      setTimeout(() => socket.emit("error", new Error("Connection refused")), 0)
    })
    socketFactory.Socket.mockImplementation(() => socket)

    const result = await runTcpCheck({
      host: "example.com",
      port: 443,
      timeoutMs: 500,
    })

    expect(result).toMatchObject({
      status: "down",
      errorMessage: "Connection refused",
    })
    expect(socket.destroy).toHaveBeenCalledTimes(1)
  })

  it("returns down when socket times out", async () => {
    const socket = new MockSocket()
    socket.connect.mockImplementation(() => {
      setTimeout(() => socket.emit("timeout"), 0)
    })
    socketFactory.Socket.mockImplementation(() => socket)

    const result = await runTcpCheck({
      host: "example.com",
      port: 443,
      timeoutMs: 500,
    })

    expect(result).toMatchObject({
      status: "down",
      errorMessage: "Socket timeout",
    })
    expect(socket.destroy).toHaveBeenCalledTimes(1)
  })

  it("ignores later events after first resolution", async () => {
    const socket = new MockSocket()
    socket.connect.mockImplementation(() => {
      setTimeout(() => {
        socket.emit("connect")
        socket.emit("error", new Error("should be ignored"))
      }, 0)
    })
    socketFactory.Socket.mockImplementation(() => socket)

    const result = await runTcpCheck({
      host: "example.com",
      port: 443,
      timeoutMs: 500,
    })

    expect(result.status).toBe("up")
    expect(socket.destroy).toHaveBeenCalledTimes(1)
  })
})
