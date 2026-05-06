import "dotenv/config"
import { and, desc, eq, lte } from "drizzle-orm"
import { WebSocketServer } from "ws"
import { db } from "../lib/db/client"
import { checkResults, monitors, user } from "../lib/db/schema"
import { runHttpCheck } from "../lib/monitor/http-check"
import type { CheckResult } from "../lib/monitor/http-check"
import { runTcpCheck } from "../lib/monitor/tcp-check"

const WORKER_POLL_INTERVAL_MS = Number(process.env.WORKER_POLL_INTERVAL_MS ?? 10000)
const MAX_RETENTION_DAYS = Number(process.env.MONITOR_RETENTION_DAYS ?? 30)
const WS_PORT = Number(process.env.WS_PORT ?? 4001)
const WEBHOOK_SUMMARY_INTERVAL_MS = Number(process.env.WEBHOOK_SUMMARY_INTERVAL_MS ?? 300000)
const WEBHOOK_TIMEOUT_MS = Number(process.env.WEBHOOK_TIMEOUT_MS ?? 10000)

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

const sendWebhookSummaries = async () => {
  const webhookUsers = await db.select().from(user)
  const targetUsers = webhookUsers.filter(item => item.webhookUrl && item.webhookUrl.trim().length > 0)

  for (const item of targetUsers) {
    const allMonitors = await db.select().from(monitors).where(eq(monitors.userId, item.id))
    const services = allMonitors.map(monitor => ({
      id: monitor.id,
      name: monitor.name,
      type: monitor.type,
      active: monitor.active,
      status: monitor.lastStatus ?? "unknown",
      errorMessage: null as string | null,
      lastCheckedAt: monitor.lastCheckedAt ? monitor.lastCheckedAt.toISOString() : null,
    }))

    const downMonitorIds = allMonitors.filter(monitor => monitor.lastStatus === "down").map(monitor => monitor.id)
    if (downMonitorIds.length === 0) {
      continue
    }

    for (const monitorId of downMonitorIds) {
      const lastDownResult = await db
        .select()
        .from(checkResults)
        .where(and(eq(checkResults.monitorId, monitorId), eq(checkResults.status, "down")))
        .orderBy(desc(checkResults.checkedAt))
        .limit(1)
      const errorMessage = lastDownResult[0]?.errorMessage ?? null
      const service = services.find(entry => entry.id === monitorId)
      if (service) {
        service.errorMessage = errorMessage
      }
    }

    const downServices = services.filter(entry => entry.status === "down")
    const payload = {
      type: "monitor.summary.down_only",
      userId: item.id,
      checkedAt: new Date().toISOString(),
      overall: {
        total: services.length,
        up: services.filter(entry => entry.status === "up").length,
        down: downServices.length,
      },
      services,
      downServices,
    }

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS)
    try {
      await fetch(item.webhookUrl as string, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      })
    } catch (error) {
      console.error(`[worker] webhook send failed for user ${item.id}`, error)
    } finally {
      clearTimeout(timeoutId)
    }
  }
}

const main = async () => {
  console.log(`[worker] started poll every ${WORKER_POLL_INTERVAL_MS}ms`)
  console.log(`[worker] websocket on :${WS_PORT}`)
  console.log(`[worker] webhook summary every ${WEBHOOK_SUMMARY_INTERVAL_MS}ms`)
  let lastWebhookSummaryAt = 0

  while (true) {
    try {
      await runChecks()
      await cleanupOldResults()
      if (Date.now() - lastWebhookSummaryAt >= WEBHOOK_SUMMARY_INTERVAL_MS) {
        await sendWebhookSummaries()
        lastWebhookSummaryAt = Date.now()
      }
    } catch (error) {
      console.error("[worker] cycle failed", error)
    }

    await new Promise(resolve => setTimeout(resolve, WORKER_POLL_INTERVAL_MS))
  }
}

void main()
