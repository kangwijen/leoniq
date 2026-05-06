import "dotenv/config"
import { eq, lte } from "drizzle-orm"
import { WebSocketServer } from "ws"
import { db } from "../lib/db/client"
import { checkResults, monitors } from "../lib/db/schema"
import { runHttpCheck } from "../lib/monitor/http-check"
import type { CheckResult } from "../lib/monitor/http-check"
import { runTcpCheck } from "../lib/monitor/tcp-check"

const WORKER_POLL_INTERVAL_MS = Number(process.env.WORKER_POLL_INTERVAL_MS ?? 10000)
const MAX_RETENTION_DAYS = Number(process.env.MONITOR_RETENTION_DAYS ?? 30)
const WS_PORT = Number(process.env.WS_PORT ?? 4001)

const wss = new WebSocketServer({ port: WS_PORT })

const broadcast = (payload: Record<string, unknown>) => {
  const message = JSON.stringify(payload)

  for (const client of wss.clients) {
    if (client.readyState === client.OPEN) {
      client.send(message)
    }
  }
}

const withRetries = async <T>(
  retries: number,
  fn: () => Promise<T>,
  isSuccess: (value: T) => boolean
) => {
  let lastValue = await fn()

  for (let attempt = 1; attempt <= retries; attempt += 1) {
    if (isSuccess(lastValue)) {
      return lastValue
    }
    lastValue = await fn()
  }

  return lastValue
}

const runSingleMonitor = async (monitor: typeof monitors.$inferSelect) => {
  const execute = async (): Promise<CheckResult> =>
    monitor.type === "http" && monitor.url
      ? runHttpCheck({
          url: monitor.url,
          method: monitor.method,
          timeoutMs: monitor.timeoutMs,
          expectedStatusMin: monitor.expectedStatusMin,
          expectedStatusMax: monitor.expectedStatusMax,
        })
      : monitor.type === "tcp" && monitor.host && monitor.port
      ? runTcpCheck({
          host: monitor.host,
          port: monitor.port,
          timeoutMs: monitor.timeoutMs,
        })
      : Promise.resolve({
          status: "down" as const,
          latencyMs: 0,
          errorMessage: "Invalid monitor configuration",
        })

  const result = await withRetries(
    Math.max(0, monitor.retries),
    execute,
    value => value.status === "up"
  )

  await db.insert(checkResults).values({
    monitorId: monitor.id,
    status: result.status,
    latencyMs: result.latencyMs,
    statusCode: result.statusCode ?? null,
    errorMessage: result.errorMessage ?? null,
    meta: null,
  })

  await db
    .update(monitors)
    .set({
      lastCheckedAt: new Date(),
      lastStatus: result.status,
      lastLatencyMs: result.latencyMs,
      updatedAt: new Date(),
    })
    .where(eq(monitors.id, monitor.id))

  broadcast({
    type: "monitor.update",
    monitorId: monitor.id,
    status: result.status,
    checkedAt: new Date().toISOString(),
  })
}

const runChecks = async () => {
  const allActive = await db.select().from(monitors).where(eq(monitors.active, true))
  const now = Date.now()
  const dueMonitors = allActive.filter(item => {
    if (!item.lastCheckedAt) {
      return true
    }

    const nextRunAt = item.lastCheckedAt.getTime() + item.intervalSeconds * 1000
    return nextRunAt <= now
  })

  for (const monitor of dueMonitors) {
    await runSingleMonitor(monitor)
  }
}

const cleanupOldResults = async () => {
  const cutoff = new Date(Date.now() - MAX_RETENTION_DAYS * 24 * 60 * 60 * 1000)
  await db.delete(checkResults).where(lte(checkResults.checkedAt, cutoff))
}

const main = async () => {
  console.log(`[worker] started poll every ${WORKER_POLL_INTERVAL_MS}ms`)
  console.log(`[worker] websocket on :${WS_PORT}`)

  while (true) {
    try {
      await runChecks()
      await cleanupOldResults()
    } catch (error) {
      console.error("[worker] cycle failed", error)
    }

    await new Promise(resolve => setTimeout(resolve, WORKER_POLL_INTERVAL_MS))
  }
}

void main()
