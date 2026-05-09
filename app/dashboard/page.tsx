import Link from "next/link"
import { checkResultsRepository, monitorRepository } from "@/lib/monitor/repository"
import { requireSession } from "@/lib/session"
import { Button } from "@/components/ui/button"
import { RealtimeRefresh } from "@/components/dashboard/realtime-refresh"
import { DashboardKpis } from "@/components/dashboard/dashboard-kpis"
import { WebhookSettings } from "@/components/dashboard/webhook-settings"
import { userRepository } from "@/lib/user/repository"
import { summarizeRecentIncidentsFromSamples } from "@/lib/monitor/incidents-summary"
import { DashboardLiveSections } from "@/components/dashboard/dashboard-live-sections"
import { RANGE_MS, type MonitorCheckStatus, type MonitorKind } from "@/lib/types"

const SPARKLINE_RANGE_MS = RANGE_MS["24h"]

function sparklineSampleLimit(intervalSeconds: number) {
  const periodMs = Math.max(1, intervalSeconds) * 1000
  const maxChecksInWindow = Math.ceil(SPARKLINE_RANGE_MS / periodMs)
  return Math.min(6000, Math.max(1, maxChecksInWindow) + 100)
}

export default async function DashboardPage() {
  const session = await requireSession()
  const user = await userRepository.getById(session.user.id)
  const monitors = await monitorRepository.list({ userId: session.user.id })
  const servedAt = new Date()
  const sevenDaysAgo = new Date(servedAt)
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
  const operationSamples = await checkResultsRepository.listByUserSince(session.user.id, sevenDaysAgo)
  const sparklineSince = new Date(servedAt.getTime() - SPARKLINE_RANGE_MS)
  const monitorSeries = await Promise.all(
    monitors.map(async monitor => {
      const limit = sparklineSampleLimit(monitor.intervalSeconds)
      const points = await checkResultsRepository.listByMonitorRecentSince(
        monitor.id,
        sparklineSince,
        limit
      )
      return {
        monitorId: monitor.id,
        series: points.map(point => (point.status === "up" ? 1 : 0)),
        latencySeries: points
          .map(point => point.latencyMs)
          .filter((value): value is number => typeof value === "number" && Number.isFinite(value)),
      }
    })
  )
  const seriesByMonitorId = new Map(monitorSeries.map(item => [item.monitorId, item.series]))
  const latencySeriesByMonitorId = new Map(monitorSeries.map(item => [item.monitorId, item.latencySeries]))

  const recentIncidents = summarizeRecentIncidentsFromSamples(
    operationSamples.map(sample => ({
      monitorId: sample.monitorId,
      monitorName: sample.monitorName,
      checkedAt: sample.checkedAt,
      status: sample.status as MonitorCheckStatus,
      errorMessage: sample.errorMessage,
    })),
    15
  )

  return (
    <main className="min-h-screen w-full bg-zinc-950 px-3 py-4 sm:px-6 sm:py-6 lg:px-8">
      <RealtimeRefresh />
      <div className="mx-auto flex w-full max-w-[1680px] flex-col gap-4 sm:gap-5">
      <header className="rounded-2xl border border-zinc-800 bg-zinc-950/80 shadow-[0_0_0_1px_rgba(24,24,27,0.8)]">
        <div className="flex flex-col gap-4 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">Leoniq Monitor</p>
            <h1 className="truncate text-xl font-semibold text-zinc-100 sm:text-2xl">Monitoring Dashboard</h1>
          </div>
          <div className="grid w-full gap-2 sm:w-auto sm:grid-cols-[auto_auto] sm:items-center">
            <div className="max-w-full truncate rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs text-zinc-300">
              Account: {session.user.name}
            </div>
            <div className="grid grid-cols-1 gap-2 sm:flex">
              <WebhookSettings initialWebhookUrl={user?.webhookUrl ?? null} />
              <Button
                asChild
                className="h-11 w-full cursor-pointer bg-emerald-500 text-black transition-colors duration-200 hover:bg-emerald-400 sm:h-10 sm:w-auto"
              >
                <Link href="/dashboard/monitors/new">Add monitor</Link>
              </Button>
            </div>
          </div>
        </div>
      </header>

      <DashboardKpis
        monitors={monitors.map(item => ({
          active: item.active,
          lastStatus: (item.lastStatus as MonitorCheckStatus | null) ?? null,
        }))}
      />
      {/* Operation samples load server-side and feed NeonOperationsWall, including range-bound anomaly heuristics on the client */}
      <DashboardLiveSections
        samples={operationSamples.map(sample => ({
          monitorId: sample.monitorId,
          monitorName: sample.monitorName,
          monitorType: sample.monitorType as MonitorKind,
          checkedAt: sample.checkedAt.toISOString(),
          status: sample.status as MonitorCheckStatus,
          latencyMs: sample.latencyMs,
          statusCode: sample.statusCode,
          errorMessage: sample.errorMessage,
          meta: sample.meta as Record<string, unknown> | null,
        }))}
        monitors={monitors.map(item => ({
          ...item,
          type: item.type as MonitorKind,
          lastStatus: (item.lastStatus as MonitorCheckStatus | null) ?? null,
          uptimeSeries: seriesByMonitorId.get(item.id) as number[],
          latencySeries: latencySeriesByMonitorId.get(item.id) as number[],
          tags: item.tags ?? [],
        }))}
        recentIncidents={recentIncidents}
      />
      </div>
    </main>
  )
}
