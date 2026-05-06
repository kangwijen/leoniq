import { NextResponse } from "next/server"
import { checkResultsRepository, monitorRepository } from "@/lib/monitor/repository"
import { requireSession } from "@/lib/session"

export async function GET(
  request: Request,
  segmentData: {
    params: Promise<{ id: string }>
  }
) {
  const session = await requireSession()
  const monitorId = (await segmentData.params).id
  const monitor = await monitorRepository.getById(monitorId, session.user.id)

  if (!monitor) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const url = new URL(request.url)
  const hours = Math.max(1, Math.min(168, Number(url.searchParams.get("hours") || "24")))
  const from = new Date(Date.now() - hours * 60 * 60 * 1000)
  const rows = await checkResultsRepository.listByMonitor(monitor.id, from, 1000)
  const stats = await checkResultsRepository.statsByMonitor(monitor.id)

  return NextResponse.json({
    data: rows,
    stats: {
      totalChecks: Number(stats?.totalChecks ?? 0),
      upChecks: Number(stats?.upChecks ?? 0),
      avgLatency: Number(stats?.avgLatency ?? 0),
      uptimePercent:
        Number(stats?.totalChecks ?? 0) > 0
          ? Math.round((Number(stats?.upChecks ?? 0) / Number(stats?.totalChecks ?? 1)) * 10000) /
            100
          : 0,
    },
  })
}
