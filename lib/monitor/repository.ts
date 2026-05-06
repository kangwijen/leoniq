import { and, asc, desc, eq, gte, sql } from "drizzle-orm"
import { db } from "@/lib/db/client"
import { checkResults, monitors } from "@/lib/db/schema"

type ListMonitorInput = {
  userId: string
}

type CreateMonitorInput = {
  userId: string
  name: string
  type: "http" | "tcp"
  url?: string | null
  host?: string | null
  port?: number | null
  method?: string
  expectedStatusMin?: number
  expectedStatusMax?: number
  intervalSeconds?: number
  timeoutMs?: number
  retries?: number
}

export const monitorRepository = {
  list: async ({ userId }: ListMonitorInput) =>
    db
      .select()
      .from(monitors)
      .where(eq(monitors.userId, userId))
      .orderBy(desc(monitors.createdAt)),

  getById: async (id: string, userId: string) => {
    const rows = await db
      .select()
      .from(monitors)
      .where(and(eq(monitors.id, id), eq(monitors.userId, userId)))
      .limit(1)

    return rows[0] ?? null
  },

  create: async (input: CreateMonitorInput) => {
    const rows = await db
      .insert(monitors)
      .values({
        userId: input.userId,
        name: input.name,
        type: input.type,
        url: input.url ?? null,
        host: input.host ?? null,
        port: input.port ?? null,
        method: input.method ?? "GET",
        expectedStatusMin: input.expectedStatusMin ?? 200,
        expectedStatusMax: input.expectedStatusMax ?? 399,
        intervalSeconds: input.intervalSeconds ?? 60,
        timeoutMs: input.timeoutMs ?? 5000,
        retries: input.retries ?? 1,
      })
      .returning()

    return rows[0]
  },

  update: async (
    id: string,
    userId: string,
    update: Partial<CreateMonitorInput> & {
      active?: boolean
    }
  ) => {
    const rows = await db
      .update(monitors)
      .set({
        ...update,
        updatedAt: new Date(),
      })
      .where(and(eq(monitors.id, id), eq(monitors.userId, userId)))
      .returning()

    return rows[0] ?? null
  },

  delete: async (id: string, userId: string) => {
    const rows = await db
      .delete(monitors)
      .where(and(eq(monitors.id, id), eq(monitors.userId, userId)))
      .returning()

    return rows[0] ?? null
  },
}

export const checkResultsRepository = {
  create: async (input: {
    monitorId: string
    status: "up" | "down"
    latencyMs: number
    statusCode?: number
    errorMessage?: string
    meta?: Record<string, unknown>
  }) =>
    db.insert(checkResults).values({
      monitorId: input.monitorId,
      status: input.status,
      latencyMs: input.latencyMs,
      statusCode: input.statusCode ?? null,
      errorMessage: input.errorMessage ?? null,
      meta: input.meta ?? null,
    }),

  listByMonitor: async (monitorId: string, from?: Date, limit = 300) => {
    const filters = [eq(checkResults.monitorId, monitorId)]

    if (from) {
      filters.push(gte(checkResults.checkedAt, from))
    }

    return db
      .select()
      .from(checkResults)
      .where(and(...filters))
      .orderBy(asc(checkResults.checkedAt))
      .limit(limit)
  },

  statsByMonitor: async (monitorId: string) => {
    const rows = await db
      .select({
        totalChecks: sql<number>`count(*)`,
        upChecks: sql<number>`count(*) filter (where ${checkResults.status} = 'up')`,
        avgLatency: sql<number>`coalesce(avg(${checkResults.latencyMs}), 0)`,
      })
      .from(checkResults)
      .where(eq(checkResults.monitorId, monitorId))

    return rows[0]
  },
}
