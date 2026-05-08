export type IncidentSummaryInput = {
  monitorId: string
  monitorName: string
  checkedAt: Date | string
  status: "up" | "down"
  errorMessage: string | null
}

export type RecentIncidentSummary = {
  monitorId: string
  monitorName: string
  openedAt: string
  closedAt: string | null
  durationMinutes: number
  reason: string | null
}

export const buildIncidentsForMonitorTimeline = (
  rows: IncidentSummaryInput[],
  monitorName: string
): RecentIncidentSummary[] => {
  if (rows.length === 0) {
    return []
  }

  const sorted = [...rows].sort(
    (a, b) => new Date(a.checkedAt).getTime() - new Date(b.checkedAt).getTime()
  )

  const out: RecentIncidentSummary[] = []
  let active: { openedAt: Date; reason: string | null } | null = null
  const monitorId = sorted[0].monitorId

  for (const point of sorted) {
    const at = new Date(point.checkedAt)
    if (point.status === "down") {
      if (!active) {
        active = { openedAt: at, reason: point.errorMessage ?? null }
      }
      continue
    }

    if (active) {
      const durationMinutes = Math.max(
        1,
        Math.round((at.getTime() - active.openedAt.getTime()) / 60000)
      )
      out.push({
        monitorId,
        monitorName,
        openedAt: active.openedAt.toISOString(),
        closedAt: at.toISOString(),
        durationMinutes,
        reason: active.reason,
      })
      active = null
    }
  }

  if (active) {
    const now = new Date()
    const durationMinutes = Math.max(
      1,
      Math.round((now.getTime() - active.openedAt.getTime()) / 60000)
    )
    out.push({
      monitorId,
      monitorName,
      openedAt: active.openedAt.toISOString(),
      closedAt: null,
      durationMinutes,
      reason: active.reason,
    })
  }

  return out
}

export const summarizeRecentIncidentsFromSamples = (
  samples: IncidentSummaryInput[],
  limit: number
): RecentIncidentSummary[] => {
  if (samples.length === 0 || limit <= 0) {
    return []
  }

  const byMonitor = new Map<string, IncidentSummaryInput[]>()
  for (const s of samples) {
    const list = byMonitor.get(s.monitorId) ?? []
    list.push(s)
    byMonitor.set(s.monitorId, list)
  }

  const incidents: RecentIncidentSummary[] = []

  for (const [, rows] of byMonitor) {
    const monitorName = rows[0].monitorName
    incidents.push(...buildIncidentsForMonitorTimeline(rows, monitorName))
  }

  return incidents
    .sort((a, b) => new Date(b.openedAt).getTime() - new Date(a.openedAt).getTime())
    .slice(0, limit)
}
