import net from "node:net"
import { validateTcpTarget } from "./validation"
import type { CheckResult } from "./http-check"

type TcpCheckInput = {
  host: string
  port: number
  timeoutMs: number
}

export const runTcpCheck = (input: TcpCheckInput) =>
  new Promise<CheckResult>(resolve => {
    const validation = validateTcpTarget(input.host, input.port)

    if (!validation.ok) {
      resolve({
        status: "down",
        latencyMs: 0,
        errorMessage: validation.error,
      })
      return
    }

    const startedAt = Date.now()
    const socket = new net.Socket()
    let resolved = false

    const done = (result: CheckResult) => {
      if (resolved) return
      resolved = true
      socket.destroy()
      resolve(result)
    }

    socket.setTimeout(input.timeoutMs)

    socket.once("connect", () => {
      done({
        status: "up",
        latencyMs: Date.now() - startedAt,
      })
    })

    socket.once("timeout", () => {
      done({
        status: "down",
        latencyMs: Date.now() - startedAt,
        errorMessage: "Socket timeout",
      })
    })

    socket.once("error", error => {
      done({
        status: "down",
        latencyMs: Date.now() - startedAt,
        errorMessage: error.message,
      })
    })

    socket.connect(input.port, input.host)
  })
