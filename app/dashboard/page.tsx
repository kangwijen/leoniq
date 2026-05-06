import Link from "next/link"
import { monitorRepository } from "@/lib/monitor/repository"
import { requireSession } from "@/lib/session"
import { Button } from "@/components/ui/button"
import { RealtimeRefresh } from "@/components/dashboard/realtime-refresh"
import { DashboardKpis } from "@/components/dashboard/dashboard-kpis"
import { MonitorTable } from "@/components/dashboard/monitor-table"

export default async function DashboardPage() {
  const session = await requireSession()
  const monitors = await monitorRepository.list({ userId: session.user.id })

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-10 md:px-8">
      <RealtimeRefresh />
      <header className="relative overflow-hidden rounded-2xl border border-zinc-800 bg-gradient-to-br from-zinc-950 via-zinc-950 to-zinc-900/70 p-6 shadow-2xl">
        <div className="absolute -top-16 -right-16 size-56 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Operations</p>
            <h1 className="text-3xl font-semibold text-zinc-100 sm:text-4xl">
              Monitoring Dashboard
            </h1>
            <p className="max-w-2xl text-zinc-400">
              Live status, uptime, and latency across all website and socket monitors.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="rounded-full border border-zinc-700 bg-zinc-900/80 px-3 py-1 text-xs text-zinc-300">
              Signed in as {session.user.email}
            </div>
          </div>
        </div>
      </header>

      <div className="flex flex-wrap justify-end">
        <Button
          asChild
          className="cursor-pointer bg-emerald-500 text-black transition-colors duration-200 hover:bg-emerald-400"
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
          }))}
        />
      )}
    </main>
  )
}
