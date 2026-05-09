import Link from "next/link"
import { notFound } from "next/navigation"
import { MonitorEditForm } from "@/components/dashboard/monitor-edit-form"
import { Button } from "@/components/ui/button"
import { monitorRepository } from "@/lib/monitor/repository"
import { requireSession } from "@/lib/session"
import type { MonitorKind } from "@/lib/types"

export default async function EditMonitorPage(segmentData: {
  params: Promise<{ id: string }>
}) {
  const session = await requireSession()
  const monitorId = (await segmentData.params).id
  const monitor = await monitorRepository.getById(monitorId, session.user.id)

  if (!monitor) {
    notFound()
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 py-6 sm:gap-6 sm:py-8 md:px-8 md:py-10">
      <div className="space-y-2">
        <Button asChild variant="outline" className="w-fit border-zinc-700 text-zinc-200 hover:bg-zinc-800">
          <Link href={`/dashboard/monitors/${monitor.id}`}>Back to monitor</Link>
        </Button>
        <h1 className="text-2xl font-semibold text-zinc-100 sm:text-3xl">Edit Monitor</h1>
        <p className="text-sm text-zinc-400 sm:text-base">Update monitored target settings and intervals.</p>
      </div>
      <MonitorEditForm
        monitor={{
          id: monitor.id,
          name: monitor.name,
          type: monitor.type as MonitorKind,
          url: monitor.url,
          host: monitor.host,
          port: monitor.port,
          intervalSeconds: monitor.intervalSeconds,
          timeoutMs: monitor.timeoutMs,
          active: monitor.active,
          tags: monitor.tags ?? [],
        }}
      />
    </main>
  )
}
