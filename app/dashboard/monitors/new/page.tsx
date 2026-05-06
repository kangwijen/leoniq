import { MonitorForm } from "@/components/dashboard/monitor-form"
import { requireSession } from "@/lib/session"

export default async function NewMonitorPage() {
  await requireSession()

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-10 md:px-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold text-zinc-100">Add Monitor</h1>
        <p className="text-zinc-400">
          Enter the target you want to monitor. Use HTTP for websites and TCP for sockets.
        </p>
      </div>
      <MonitorForm />
    </main>
  )
}
