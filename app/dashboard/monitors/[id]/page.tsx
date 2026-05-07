import Link from "next/link"
import { notFound } from "next/navigation"
import { checkResultsRepository, monitorRepository } from "@/lib/monitor/repository"
import { requireSession } from "@/lib/session"
import { MonitorChart } from "@/components/dashboard/monitor-chart"
import { MonitorActions } from "@/components/dashboard/monitor-actions"
import { RealtimeRefresh } from "@/components/dashboard/realtime-refresh"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

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
  const incidentTimeline: Array<{
    openedAt: string
    closedAt: string | null
    durationMinutes: number
    reason: string | null
  }> = []
  let activeIncident: {
    openedAt: Date
    reason: string | null
  } | null = null

  for (const point of points) {
    if (point.status === "down") {
      if (!activeIncident) {
        activeIncident = {
          openedAt: point.checkedAt,
          reason: point.errorMessage ?? null,
        }
      }
      continue
    }

    if (activeIncident) {
      const durationMinutes = Math.max(1, Math.round((point.checkedAt.getTime() - activeIncident.openedAt.getTime()) / 60000))
      incidentTimeline.push({
        openedAt: activeIncident.openedAt.toISOString(),
        closedAt: point.checkedAt.toISOString(),
        durationMinutes,
        reason: activeIncident.reason,
      })
      activeIncident = null
    }
  }

  if (activeIncident) {
    const now = new Date()
    const durationMinutes = Math.max(1, Math.round((now.getTime() - activeIncident.openedAt.getTime()) / 60000))
    incidentTimeline.push({
      openedAt: activeIncident.openedAt.toISOString(),
      closedAt: null,
      durationMinutes,
      reason: activeIncident.reason,
    })
  }

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 py-6 sm:gap-6 sm:py-8 md:px-8 md:py-10">
      <RealtimeRefresh />
      <header className="space-y-3 rounded-2xl border border-zinc-800 bg-zinc-950/70 p-4 sm:p-5">
        <Button asChild variant="outline" className="w-fit border-zinc-700 text-zinc-200 hover:bg-zinc-800">
          <Link href="/dashboard">Back to dashboard</Link>
        </Button>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold text-zinc-100 sm:text-3xl">{monitor.name}</h1>
            {monitor.lastStatus === "up" ? (
              <Badge className="bg-emerald-500/20 text-emerald-300">up</Badge>
            ) : monitor.lastStatus === "down" ? (
              <Badge className="bg-red-500/20 text-red-300">down</Badge>
            ) : (
              <Badge variant="outline">unknown</Badge>
            )}
          </div>
          <div className="w-full sm:w-auto">
            <MonitorActions monitorId={monitor.id} active={monitor.active} compact />
          </div>
        </div>
        <p className="text-sm text-zinc-400 sm:text-base">
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
      <section className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-4 sm:p-5">
        <h2 className="text-lg font-semibold text-zinc-100">Incident Timeline</h2>
        <p className="mt-1 text-sm text-zinc-400">Recent outage windows for this monitor.</p>
        {incidentTimeline.length === 0 ? (
          <p className="mt-4 text-sm text-zinc-400">No incidents recorded in this data window.</p>
        ) : (
          <div className="mt-4 space-y-3">
            {incidentTimeline
              .slice()
              .reverse()
              .slice(0, 10)
              .map(incident => (
                <article
                  key={`${incident.openedAt}-${incident.closedAt ?? "open"}`}
                  className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="text-sm text-zinc-200">
                      <p>
                        Started {new Date(incident.openedAt).toLocaleString()}
                      </p>
                      <p>
                        {incident.closedAt
                          ? `Recovered ${new Date(incident.closedAt).toLocaleString()}`
                          : "Still open"}
                      </p>
                    </div>
                    <div className="text-sm font-medium text-amber-300">{incident.durationMinutes} min</div>
                  </div>
                  {incident.reason ? (
                    <p className="mt-2 text-sm text-zinc-400">{incident.reason}</p>
                  ) : null}
                </article>
              ))}
          </div>
        )}
      </section>
    </main>
  )
}
