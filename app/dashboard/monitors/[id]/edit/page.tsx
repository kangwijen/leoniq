import { notFound } from "next/navigation"
import { MonitorEditForm } from "@/components/dashboard/monitor-edit-form"
import { monitorRepository } from "@/lib/monitor/repository"
import { requireSession } from "@/lib/session"

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
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-10 md:px-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold text-zinc-100">Edit Monitor</h1>
        <p className="text-zinc-400">Update monitored target settings and intervals.</p>
      </div>
      <MonitorEditForm
        monitor={{
          id: monitor.id,
          name: monitor.name,
          type: monitor.type as "http" | "tcp",
          url: monitor.url,
          host: monitor.host,
          port: monitor.port,
          intervalSeconds: monitor.intervalSeconds,
          timeoutMs: monitor.timeoutMs,
          active: monitor.active,
        }}
      />
    </main>
  )
}
