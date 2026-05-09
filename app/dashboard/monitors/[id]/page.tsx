import Link from "next/link"
import { notFound } from "next/navigation"
import { checkResultsRepository, monitorRepository } from "@/lib/monitor/repository"
import { requireSession } from "@/lib/session"
import { MonitorDetailAnalytics } from "@/components/dashboard/monitor-detail-analytics"
import { MonitorActions } from "@/components/dashboard/monitor-actions"
import { RealtimeRefresh } from "@/components/dashboard/realtime-refresh"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { MonitorCheckStatus } from "@/lib/types"

export default async function MonitorDetailPage(segmentData: {
  params: Promise<{ id: string }>
}) {
  const session = await requireSession()
  const monitorId = (await segmentData.params).id
  const monitor = await monitorRepository.getById(monitorId, session.user.id)

  if (!monitor) {
    notFound()
  }

  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
  const points = await checkResultsRepository.listByMonitorRecentSince(monitor.id, sevenDaysAgo, 6000)
  const pointsPayload = points.map(point => ({
    checkedAt: point.checkedAt.toISOString(),
    latencyMs: point.latencyMs,
    status: point.status as MonitorCheckStatus,
    errorMessage: point.errorMessage ?? null,
  }))
  const servedAtMs = new Date().getTime()

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
      </header>

      <MonitorDetailAnalytics
        monitorId={monitor.id}
        monitorName={monitor.name}
        servedAtMs={servedAtMs}
        points={pointsPayload}
      />
    </main>
  )
}
