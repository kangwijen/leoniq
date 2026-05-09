"use client"

import { useMemo, useState } from "react"
import { MonitorChart } from "@/components/dashboard/monitor-chart"
import { RANGE_MS, type MonitorDetailPoint, type RangeOption } from "@/lib/types"
import { buildIncidentsForMonitorTimeline } from "@/lib/monitor/incidents-summary"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

type MonitorDetailAnalyticsProps = {
  monitorId: string
  monitorName: string
  servedAtMs: number
  points: MonitorDetailPoint[]
}

const RANGE_SUMMARY: Record<RangeOption, string> = {
  "1h": "in the last hour",
  "6h": "in the last 6 hours",
  "24h": "in the last 24 hours",
  "7d": "in the last 7 days",
}

export const MonitorDetailAnalytics = ({
  monitorId,
  monitorName,
  servedAtMs,
  points,
}: MonitorDetailAnalyticsProps) => {
  const [range, setRange] = useState<RangeOption>("24h")

  const referenceTimeMs = useMemo(() => {
    const latestPointMs = points.reduce((latest, point) => {
      const t = new Date(point.checkedAt).getTime()
      return t > latest ? t : latest
    }, 0)
    return Math.max(servedAtMs, latestPointMs)
  }, [points, servedAtMs])

  const filteredPoints = useMemo(() => {
    const cutoff = referenceTimeMs - RANGE_MS[range]
    return points
      .filter(point => new Date(point.checkedAt).getTime() >= cutoff)
      .sort((a, b) => new Date(a.checkedAt).getTime() - new Date(b.checkedAt).getTime())
  }, [points, range, referenceTimeMs])

  const uptimePercent = useMemo(() => {
    const total = filteredPoints.length
    if (total === 0) {
      return "0.00"
    }
    const up = filteredPoints.filter(point => point.status === "up").length
    return ((up / total) * 100).toFixed(2)
  }, [filteredPoints])

  const avgLatency = useMemo(() => {
    const latencies = filteredPoints
      .map(point => point.latencyMs)
      .filter((value): value is number => typeof value === "number" && Number.isFinite(value))
    if (latencies.length === 0) {
      return 0
    }
    return Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
  }, [filteredPoints])

  const incidentTimeline = useMemo(
    () =>
      buildIncidentsForMonitorTimeline(
        filteredPoints.map(point => ({
          monitorId,
          monitorName,
          checkedAt: point.checkedAt,
          status: point.status,
          errorMessage: point.errorMessage,
        })),
        monitorName
      ),
    [filteredPoints, monitorId, monitorName]
  )

  const chartData = filteredPoints.map(point => ({
    checkedAt: point.checkedAt,
    latencyMs: point.latencyMs,
    status: point.status,
  }))

  return (
    <>
      <div className="flex flex-col gap-3 rounded-2xl border border-zinc-800 bg-zinc-950/70 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <p className="text-sm text-zinc-400 sm:text-base">
          Uptime {uptimePercent}% {RANGE_SUMMARY[range]}. Average latency {avgLatency} ms.
        </p>
        <div className="w-full sm:w-48">
          <Select value={range} onValueChange={value => setRange(value as RangeOption)}>
            <SelectTrigger className="h-11 cursor-pointer border-zinc-700 bg-zinc-900 text-zinc-100 sm:h-10">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1h">Last 1 hour</SelectItem>
              <SelectItem value="6h">Last 6 hours</SelectItem>
              <SelectItem value="24h">Last 24 hours</SelectItem>
              <SelectItem value="7d">Last 7 days</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <MonitorChart
        title="Latency Over Time"
        data={chartData}
        timeRange={range}
      />
      <MonitorChart
        title="Uptime Timeline"
        mode="uptime"
        data={chartData}
        timeRange={range}
      />
      <section className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-4 sm:p-5">
        <h2 className="text-lg font-semibold text-zinc-100">Incident Timeline</h2>
        <p className="mt-1 text-sm text-zinc-400">Outage windows for the selected range.</p>
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
                      <p>Started {new Date(incident.openedAt).toLocaleString()}</p>
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
    </>
  )
}
