import Link from "next/link"
import { checkResultsRepository, monitorRepository } from "@/lib/monitor/repository"
import { requireSession } from "@/lib/session"
import { Button } from "@/components/ui/button"
import { RealtimeRefresh } from "@/components/dashboard/realtime-refresh"
import { DashboardKpis } from "@/components/dashboard/dashboard-kpis"
import { MonitorTable } from "@/components/dashboard/monitor-table"

export default async function DashboardPage() {
  const session = await requireSession()
  const monitors = await monitorRepository.list({ userId: session.user.id })
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
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 py-6 sm:gap-6 sm:py-8 md:px-8 md:py-10">
      <RealtimeRefresh />
      <header className="relative overflow-hidden rounded-2xl border border-zinc-800 bg-gradient-to-br from-zinc-950 via-zinc-950 to-zinc-900/70 p-5 shadow-2xl sm:p-6">
        <div className="absolute -top-16 -right-16 size-56 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Operations</p>
            <h1 className="text-2xl font-semibold text-zinc-100 sm:text-4xl">
              Monitoring Dashboard
            </h1>
            <p className="max-w-2xl text-sm text-zinc-400 sm:text-base">
              Live status, uptime, and latency across all website and socket monitors.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="max-w-full truncate rounded-full border border-zinc-700 bg-zinc-900/80 px-3 py-1 text-xs text-zinc-300">
              Signed in as {session.user.name}
            </div>
          </div>
        </div>
      </header>

      <div className="flex flex-wrap justify-stretch sm:justify-end">
        <Button
          asChild
          className="h-11 w-full cursor-pointer bg-emerald-500 text-black transition-colors duration-200 hover:bg-emerald-400 sm:h-10 sm:w-auto"
        >
          <Link href="/dashboard/monitors/new">Add monitor</Link>
        </Button>
      </div>

      <DashboardKpis
        monitors={monitors.map(item => ({
          active: item.active,
          lastStatus: (item.lastStatus as "up" | "down" | null) ?? null,
        }))}
      />

      {monitors.length === 0 ? (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-8 text-zinc-300">
          No monitors yet. Create your first website or socket check.
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
    </main>
  )
}
