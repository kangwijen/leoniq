import { eq } from "drizzle-orm"
import { db } from "../db/client"
import { checkResults, monitors } from "../db/schema"
import { runHttpCheck, type CheckResult } from "./http-check"
import { runTcpCheck } from "./tcp-check"

const withRetries = async <T>(
  retries: number,
  fn: () => Promise<T>,
  isSuccess: (value: T) => boolean,
  onAttempt?: (attempt: number, value: T) => void
) => {
  let currentAttempt = 0
  let lastValue = await fn()
  onAttempt?.(currentAttempt, lastValue)

  for (let attempt = 1; attempt <= retries; attempt += 1) {
    if (isSuccess(lastValue)) {
      return lastValue
    }
    currentAttempt = attempt
    lastValue = await fn()
    onAttempt?.(currentAttempt, lastValue)
  }

  return lastValue
}

const runMonitorCheckOnce = async (monitor: typeof monitors.$inferSelect): Promise<CheckResult> =>
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

export const executeAndPersistMonitorCheck = async (
  monitor: typeof monitors.$inferSelect,
  source: "worker" | "api"
) => {
  console.log(`[${source}] monitor ${monitor.id} check started`)
  const result = await withRetries(
    Math.max(0, monitor.retries),
    () => runMonitorCheckOnce(monitor),
    value => value.status === "up",
    (attempt, value) => {
      console.log(
        `[${source}] monitor ${monitor.id} attempt ${attempt + 1} status=${value.status} latency=${value.latencyMs}`
      )
    }
  )

  await db.insert(checkResults).values({
    monitorId: monitor.id,
    status: result.status,
    latencyMs: result.latencyMs,
    statusCode: result.statusCode ?? null,
    errorMessage: result.errorMessage ?? null,
    meta: result.meta ?? null,
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

  console.log(`[${source}] monitor ${monitor.id} check completed status=${result.status}`)
  return result
}
