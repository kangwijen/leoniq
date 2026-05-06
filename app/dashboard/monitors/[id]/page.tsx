import { notFound } from "next/navigation"
import { checkResultsRepository, monitorRepository } from "@/lib/monitor/repository"
import { requireSession } from "@/lib/session"
import { MonitorChart } from "@/components/dashboard/monitor-chart"
import { MonitorActions } from "@/components/dashboard/monitor-actions"
import { RealtimeRefresh } from "@/components/dashboard/realtime-refresh"
import { Badge } from "@/components/ui/badge"

export default async function MonitorDetailPage(segmentData: {
  params: Promise<{ id: string }>
}) {
  const session = await requireSession()
  const monitorId = (await segmentData.params).id
  const monitor = await monitorRepository.getById(monitorId, session.user.id)

  if (!monitor) {
    notFound()
  }

  const points = await checkResultsRepository.listByMonitor(monitor.id, undefined, 500)
  const stats = await checkResultsRepository.statsByMonitor(monitor.id)
  const totalChecks = Number(stats?.totalChecks ?? 0)
  const upChecks = Number(stats?.upChecks ?? 0)
  const uptimePercent = totalChecks > 0 ? ((upChecks / totalChecks) * 100).toFixed(2) : "0.00"

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-10 md:px-8">
      <RealtimeRefresh />
      <header className="space-y-3 rounded-2xl border border-zinc-800 bg-zinc-950/70 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-semibold text-zinc-100">{monitor.name}</h1>
            {monitor.lastStatus === "up" ? (
              <Badge className="bg-emerald-500/20 text-emerald-300">up</Badge>
            ) : monitor.lastStatus === "down" ? (
              <Badge className="bg-red-500/20 text-red-300">down</Badge>
            ) : (
              <Badge variant="outline">unknown</Badge>
            )}
          </div>
          <MonitorActions monitorId={monitor.id} active={monitor.active} compact />
        </div>
        <p className="text-zinc-400">
          Uptime {uptimePercent}% in the last 24 hours. Average latency{" "}
          {Math.round(Number(stats?.avgLatency ?? 0))} ms.
        </p>
      </header>

      <MonitorChart
        title="Latency Over Time"
        data={points.map(point => ({
          checkedAt: point.checkedAt.toISOString(),
          latencyMs: point.latencyMs,
          status: point.status as "up" | "down",
        }))}
      />
      <MonitorChart
        title="Uptime Timeline"
        mode="uptime"
        data={points.map(point => ({
          checkedAt: point.checkedAt.toISOString(),
          latencyMs: point.latencyMs,
          status: point.status as "up" | "down",
        }))}
      />
    </main>
  )
}
