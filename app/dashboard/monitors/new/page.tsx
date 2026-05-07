import Link from "next/link"
import { MonitorForm } from "@/components/dashboard/monitor-form"
import { Button } from "@/components/ui/button"
import { requireSession } from "@/lib/session"

export default async function NewMonitorPage() {
  await requireSession()

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 py-6 sm:gap-6 sm:py-8 md:px-8 md:py-10">
      <div className="space-y-2">
        <Button asChild variant="outline" className="w-fit border-zinc-700 text-zinc-200 hover:bg-zinc-800">
          <Link href="/dashboard">Back to dashboard</Link>
        </Button>
        <h1 className="text-2xl font-semibold text-zinc-100 sm:text-3xl">Add Monitor</h1>
        <p className="text-sm text-zinc-400 sm:text-base">
          Enter the target you want to monitor. Use HTTP for websites and TCP for sockets.
        </p>
      </div>
      <MonitorForm />
    </main>
  )
}
