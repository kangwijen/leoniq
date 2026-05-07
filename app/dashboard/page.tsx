import Link from "next/link"
import { checkResultsRepository, monitorRepository } from "@/lib/monitor/repository"
import { requireSession } from "@/lib/session"
import { Button } from "@/components/ui/button"
import { RealtimeRefresh } from "@/components/dashboard/realtime-refresh"
import { DashboardKpis } from "@/components/dashboard/dashboard-kpis"
import { MonitorTable } from "@/components/dashboard/monitor-table"
import { WebhookSettings } from "@/components/dashboard/webhook-settings"
import { userRepository } from "@/lib/user/repository"
import { NeonOperationsWall } from "@/components/dashboard/neon-operations-wall"

export default async function DashboardPage() {
  const session = await requireSession()
  const user = await userRepository.getById(session.user.id)
  const monitors = await monitorRepository.list({ userId: session.user.id })
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const operationSamples = await checkResultsRepository.listByUserSince(session.user.id, sevenDaysAgo)
  const monitorSeries = await Promise.all(
    monitors.map(async monitor => {
      const points = await checkResultsRepository.listByMonitor(monitor.id, undefined, 20)
      return {
        monitorId: monitor.id,
        series: points.map(point => (point.status === "up" ? 1 : 0)),
      }
    })
  )
  const seriesByMonitorId = new Map(monitorSeries.map(item => [item.monitorId, item.series]))

  return (
    <main className="min-h-screen w-full bg-zinc-950 px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
      <RealtimeRefresh />
      <div className="mx-auto flex w-full max-w-[1680px] flex-col gap-5">
      <header className="relative overflow-hidden rounded-2xl border border-zinc-800 bg-gradient-to-br from-zinc-950 via-zinc-950 to-zinc-900/80 p-5 shadow-2xl sm:p-6">
        <div className="absolute -top-16 -right-16 size-56 rounded-full bg-cyan-500/10 blur-3xl" />
        <div className="absolute -bottom-24 -left-20 size-64 rounded-full bg-violet-500/10 blur-3xl" />
        <div className="relative flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Operations Center</p>
            <h1 className="text-2xl font-semibold text-zinc-100 sm:text-3xl xl:text-4xl">
              Monitoring Dashboard
            </h1>
            <p className="max-w-3xl text-sm text-zinc-400 sm:text-base">
              Live status, latency, and failure trends for every monitor in this workspace.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 xl:justify-end">
            <div className="max-w-full truncate rounded-full border border-zinc-700 bg-zinc-900/90 px-3 py-1 text-xs text-zinc-300">
              Account: {session.user.name}
            </div>
            <WebhookSettings initialWebhookUrl={user?.webhookUrl ?? null} />
            <Button
              asChild
              className="h-10 cursor-pointer bg-emerald-500 text-black transition-colors duration-200 hover:bg-emerald-400"
            >
              <Link href="/dashboard/monitors/new">Add monitor</Link>
            </Button>
          </div>
        </div>
      </header>

      <DashboardKpis
        monitors={monitors.map(item => ({
          active: item.active,
          lastStatus: (item.lastStatus as "up" | "down" | null) ?? null,
        }))}
      />
      <NeonOperationsWall
        samples={operationSamples.map(sample => ({
          monitorId: sample.monitorId,
          monitorName: sample.monitorName,
          monitorType: sample.monitorType as "http" | "tcp",
          checkedAt: sample.checkedAt.toISOString(),
          status: sample.status as "up" | "down",
          latencyMs: sample.latencyMs,
          statusCode: sample.statusCode,
          errorMessage: sample.errorMessage,
          meta: sample.meta as Record<string, unknown> | null,
        }))}
      />

      {monitors.length === 0 ? (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-8 text-zinc-300">
          No monitors configured yet. Add an HTTP or TCP monitor to begin collecting checks.
        </div>
      ) : (
        <MonitorTable
          monitors={monitors.map(item => ({
            ...item,
            type: item.type as "http" | "tcp",
            lastStatus: (item.lastStatus as "up" | "down" | null) ?? null,
            uptimeSeries: seriesByMonitorId.get(item.id) ?? [],
          }))}
        />
      )}
      </div>
    </main>
  )
}
