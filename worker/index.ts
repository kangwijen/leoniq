import "dotenv/config"
import { and, desc, eq, lte } from "drizzle-orm"
import { WebSocketServer } from "ws"
import { db } from "../lib/db/client"
import { checkResults, monitors, user, webhookAttempts } from "../lib/db/schema"
import { executeAndPersistMonitorCheck } from "../lib/monitor/executor"

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

const runSingleMonitor = async (monitor: typeof monitors.$inferSelect) => {
  const result = await executeAndPersistMonitorCheck(monitor, "worker")
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

const isDiscordWebhookUrl = (value: string) => {
  try {
    const url = new URL(value)
    const isDiscordHost = url.hostname === "discord.com" || url.hostname === "discordapp.com"
    return isDiscordHost && url.pathname.includes("/api/webhooks/")
  } catch {
    return false
  }
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
    const discordPayload = {
      content: `Monitor alert: ${downServices.length} service(s) down`,
      embeds: [
        {
          title: "Monitoring Summary",
          description: `Total: ${payload.overall.total} | Up: ${payload.overall.up} | Down: ${payload.overall.down}`,
          color: 15158332,
          fields: downServices.map(service => ({
            name: `${service.name} (${service.type.toUpperCase()})`,
            value: service.errorMessage ?? "No error details",
            inline: false,
          })),
          timestamp: payload.checkedAt,
        },
      ],
      allowed_mentions: {
        parse: [],
      },
    }

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS)
    let success = false
    let statusCode: number | null = null
    let errorMessage: string | null = null
    console.log(
      `[worker] webhook attempt user=${item.id} url=${item.webhookUrl} down=${downServices.length}`
    )
    try {
      const requestBody = isDiscordWebhookUrl(item.webhookUrl as string) ? discordPayload : payload
      const response = await fetch(item.webhookUrl as string, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      })
      statusCode = response.status
      success = response.ok
      if (!response.ok) {
        const responseBody = await response.text()
        errorMessage =
          responseBody.trim().length > 0
            ? `Webhook returned status ${response.status}: ${responseBody}`
            : `Webhook returned status ${response.status}`
      }
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : "Webhook request failed"
      console.error(`[worker] webhook send failed for user ${item.id}`, errorMessage)
    } finally {
      clearTimeout(timeoutId)
    }

    await db.insert(webhookAttempts).values({
      userId: item.id,
      webhookUrl: item.webhookUrl as string,
      success,
      statusCode,
      errorMessage,
      payload,
    })

    console.log(
      `[worker] webhook attempt logged user=${item.id} success=${success} statusCode=${statusCode ?? "none"}`
    )
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
