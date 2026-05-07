import net from "node:net"
import dns from "node:dns/promises"
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
    let dnsLookupMs: number | null = null
    const connectStartedAt = Date.now()

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
        meta: {
          protocol: "tcp",
          dnsLookupMs,
          connectMs: Date.now() - connectStartedAt,
        },
      })
    })

    socket.once("timeout", () => {
      done({
        status: "down",
        latencyMs: Date.now() - startedAt,
        errorMessage: "Socket timeout",
        meta: {
          protocol: "tcp",
          dnsLookupMs,
          connectMs: Date.now() - connectStartedAt,
        },
      })
    })

    socket.once("error", error => {
      done({
        status: "down",
        latencyMs: Date.now() - startedAt,
        errorMessage: error.message,
        meta: {
          protocol: "tcp",
          dnsLookupMs,
          connectMs: Date.now() - connectStartedAt,
        },
      })
    })

    void (async () => {
      const dnsStart = Date.now()
      try {
        await dns.lookup(input.host)
        dnsLookupMs = Date.now() - dnsStart
      } catch {
        dnsLookupMs = Date.now() - dnsStart
      }
      socket.connect(input.port, input.host)
    })()
  })
