import { and, desc, eq, gte, lte } from "drizzle-orm"
import type { WebSocketServer } from "ws"
import { db } from "../lib/db/client"
import { checkResults, monitors, user, webhookAttempts } from "../lib/db/schema"
import { executeAndPersistMonitorCheck } from "../lib/monitor/executor"
import {
  DEFAULT_SEVERITY_POLICIES,
  dedupKeyForAlert,
  severityFromDownStreak,
  shouldSuppressForCooldown,
  type AlertSeverity,
} from "../lib/alerts/notification-policy"
import type { MonitorKind } from "../lib/types"

export const WORKER_POLL_INTERVAL_MS = Number(process.env.WORKER_POLL_INTERVAL_MS ?? 10000)
export const MAX_RETENTION_DAYS = Number(process.env.MONITOR_RETENTION_DAYS ?? 30)
export const WS_PORT = Number(process.env.WS_PORT ?? 4001)
export const WEBHOOK_SUMMARY_INTERVAL_MS = Number(process.env.WEBHOOK_SUMMARY_INTERVAL_MS ?? 300000)
export const WEBHOOK_TIMEOUT_MS = Number(process.env.WEBHOOK_TIMEOUT_MS ?? 10000)
export const MAX_POLICY_COOLDOWN_MS = Math.max(
  DEFAULT_SEVERITY_POLICIES.info.cooldownMs,
  DEFAULT_SEVERITY_POLICIES.warning.cooldownMs,
  DEFAULT_SEVERITY_POLICIES.critical.cooldownMs
)

export const broadcast = (wss: WebSocketServer, payload: Record<string, unknown>) => {
  const message = JSON.stringify(payload)

  for (const client of wss.clients) {
    if (client.readyState === client.OPEN) {
      client.send(message)
    }
  }
}

export const runSingleMonitor = async (
  wss: WebSocketServer,
  monitor: typeof monitors.$inferSelect
) => {
  const result = await executeAndPersistMonitorCheck(monitor, "worker")
  broadcast(wss, {
    type: "monitor.update",
    monitorId: monitor.id,
    status: result.status,
    checkedAt: new Date().toISOString(),
  })
}

export const runChecks = async (wss: WebSocketServer) => {
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
    await runSingleMonitor(wss, monitor)
  }
}

export const cleanupOldResults = async () => {
  const cutoff = new Date(Date.now() - MAX_RETENTION_DAYS * 24 * 60 * 60 * 1000)
  await db.delete(checkResults).where(lte(checkResults.checkedAt, cutoff))
}

export const isDiscordWebhookUrl = (value: string) => {
  try {
    const url = new URL(value)
    const isDiscordHost = url.hostname === "discord.com" || url.hostname === "discordapp.com"
    return isDiscordHost && url.pathname.includes("/api/webhooks/")
  } catch {
    return false
  }
}

type DownAlert = {
  id: string
  name: string
  type: MonitorKind
  errorMessage: string | null
  lastCheckedAt: string | null
  downStreak: number
  severity: AlertSeverity
  dedupKey: string
}

export const getDownStreakAndError = async (monitorId: string) => {
  const recent = await db
    .select()
    .from(checkResults)
    .where(eq(checkResults.monitorId, monitorId))
    .orderBy(desc(checkResults.checkedAt))
    .limit(20)

  let downStreak = 0
  let errorMessage: string | null = null
  for (const row of recent) {
    if (row.status !== "down") {
      break
    }
    downStreak += 1
    if (!errorMessage && row.errorMessage) {
      errorMessage = row.errorMessage
    }
  }

  return {
    downStreak,
    errorMessage,
  }
}

export const sendWebhookSummaries = async () => {
  const webhookUsers = await db.select().from(user)
  const targetUsers = webhookUsers.filter(item => item.webhookUrl && item.webhookUrl.trim().length > 0)

  for (const item of targetUsers) {
    const allMonitors = await db.select().from(monitors).where(eq(monitors.userId, item.id))
    const downMonitors = allMonitors.filter(monitor => monitor.lastStatus === "down")
    if (downMonitors.length === 0) {
      continue
    }

    const recentAttempts = await db
      .select({
        createdAt: webhookAttempts.createdAt,
        payload: webhookAttempts.payload,
      })
      .from(webhookAttempts)
      .where(
        and(
          eq(webhookAttempts.userId, item.id),
          eq(webhookAttempts.success, true),
          gte(webhookAttempts.createdAt, new Date(Date.now() - MAX_POLICY_COOLDOWN_MS))
        )
      )
      .orderBy(desc(webhookAttempts.createdAt))
      .limit(200)

    const attemptRecords = recentAttempts
      .map(attempt => {
        const payload =
          attempt.payload && typeof attempt.payload === "object"
            ? (attempt.payload as { alerts?: Array<{ dedupKey?: unknown }> })
            : null
        const dedupKey = payload?.alerts?.[0]?.dedupKey
        return {
          createdAt: attempt.createdAt,
          dedupKey: typeof dedupKey === "string" ? dedupKey : null,
        }
      })
      .filter(record => record.dedupKey !== null)

    const downAlerts: DownAlert[] = []
    for (const monitor of downMonitors) {
      const detail = await getDownStreakAndError(monitor.id)
      const severity = severityFromDownStreak(Math.max(1, detail.downStreak))
      const dedupKey = dedupKeyForAlert({
        monitorId: monitor.id,
        errorMessage: detail.errorMessage,
        downStreak: Math.max(1, detail.downStreak),
        severity,
      })
      downAlerts.push({
        id: monitor.id,
        name: monitor.name,
        type: monitor.type,
        errorMessage: detail.errorMessage,
        lastCheckedAt: monitor.lastCheckedAt ? monitor.lastCheckedAt.toISOString() : null,
        downStreak: Math.max(1, detail.downStreak),
        severity,
        dedupKey,
      })
    }

    const alertsToSend = downAlerts.filter(alert => {
      return !shouldSuppressForCooldown(
        {
          monitorId: alert.id,
          errorMessage: alert.errorMessage,
          downStreak: alert.downStreak,
          severity: alert.severity,
        },
        attemptRecords,
        new Date(),
        DEFAULT_SEVERITY_POLICIES
      )
    })

    if (alertsToSend.length === 0) {
      continue
    }

    const services = allMonitors.map(monitor => ({
      id: monitor.id,
      name: monitor.name,
      type: monitor.type,
      active: monitor.active,
      status: monitor.lastStatus ?? "unknown",
      lastCheckedAt: monitor.lastCheckedAt ? monitor.lastCheckedAt.toISOString() : null,
    }))

    const payload = {
      type: "monitor.alerts.v2",
      userId: item.id,
      checkedAt: new Date().toISOString(),
      policy: DEFAULT_SEVERITY_POLICIES,
      overall: {
        total: services.length,
        up: services.filter(entry => entry.status === "up").length,
        down: downAlerts.length,
      },
      alerts: alertsToSend,
      suppressedCount: downAlerts.length - alertsToSend.length,
    }
    const discordPayload = {
      content: `Monitor alert: ${alertsToSend.length} service(s) need attention`,
      embeds: [
        {
          title: "Monitoring Alerts",
          description: `Total: ${payload.overall.total} | Up: ${payload.overall.up} | Down: ${payload.overall.down} | Sent: ${alertsToSend.length}`,
          color: 15158332,
          fields: alertsToSend.map(alert => ({
            name: `[${alert.severity.toUpperCase()}] ${alert.name} (${alert.type.toUpperCase()})`,
            value: `${alert.errorMessage ?? "No error details"}\nDown streak: ${alert.downStreak}`,
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
      `[worker] webhook attempt user=${item.id} url=${item.webhookUrl} send=${alertsToSend.length} suppressed=${payload.suppressedCount}`
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

export async function runOneWorkerCycle(
  wss: WebSocketServer,
  summaryState: { lastAt: number }
) {
  await runChecks(wss)
  await cleanupOldResults()
  const now = Date.now()
  if (now - summaryState.lastAt >= WEBHOOK_SUMMARY_INTERVAL_MS) {
    await sendWebhookSummaries()
    summaryState.lastAt = now
  }
}

export const runForever = async (wss: WebSocketServer) => {
  console.log(`[worker] started poll every ${WORKER_POLL_INTERVAL_MS}ms`)
  console.log(`[worker] websocket on :${WS_PORT}`)
  console.log(`[worker] webhook summary every ${WEBHOOK_SUMMARY_INTERVAL_MS}ms`)
  const summaryState = { lastAt: 0 }

  while (true) {
    try {
      await runOneWorkerCycle(wss, summaryState)
    } catch (error) {
      console.error("[worker] cycle failed", error)
    }

    await new Promise(resolve => setTimeout(resolve, WORKER_POLL_INTERVAL_MS))
  }
}
