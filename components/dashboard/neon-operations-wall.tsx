"use client"

import { useMemo, useState } from "react"
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

type MonitorSample = {
  monitorId: string
  monitorName: string
  monitorType: "http" | "tcp"
  checkedAt: string
  status: "up" | "down"
  latencyMs: number | null
  statusCode: number | null
  errorMessage: string | null
  meta: Record<string, unknown> | null
}

type NeonOperationsWallProps = {
  samples: MonitorSample[]
  range?: RangeOption
  onRangeChange?: (value: RangeOption) => void
}

export type RangeOption = "1h" | "6h" | "24h" | "7d"

const RANGE_MS: Record<RangeOption, number> = {
  "1h": 1 * 60 * 60 * 1000,
  "6h": 6 * 60 * 60 * 1000,
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
}

const percentile = (values: number[], target: number) => {
  if (values.length === 0) {
    return 0
  }

  const sorted = [...values].sort((a, b) => a - b)
  const index = Math.min(sorted.length - 1, Math.ceil((target / 100) * sorted.length) - 1)
  return sorted[Math.max(0, index)]
}

const asTimeLabel = (timestamp: number, range: RangeOption) =>
  new Date(timestamp).toLocaleString(undefined, {
    month: range === "7d" ? "short" : undefined,
    day: range === "7d" ? "numeric" : undefined,
    hour: "2-digit",
    minute: "2-digit",
  })

export const NeonOperationsWall = ({ samples, range: rangeProp, onRangeChange }: NeonOperationsWallProps) => {
  const [internalRange, setInternalRange] = useState<RangeOption>("24h")
  const range = rangeProp ?? internalRange

  const setRange = (value: RangeOption) => {
    if (rangeProp === undefined) {
      setInternalRange(value)
    }
    onRangeChange?.(value)
  }

  const filteredSamples = useMemo(() => {
    const rangeMs = RANGE_MS[range]
    const cutoff = Date.now() - rangeMs
    return samples
      .filter(item => new Date(item.checkedAt).getTime() >= cutoff)
      .sort((a, b) => new Date(a.checkedAt).getTime() - new Date(b.checkedAt).getTime())
  }, [range, samples])

  const bucketed = useMemo(() => {
    const bucketCount = range === "1h" ? 12 : range === "6h" ? 24 : range === "24h" ? 48 : 56
    const rangeMs = RANGE_MS[range]
    const now = Date.now()
    const start = now - rangeMs
    const bucketSize = Math.max(1, Math.floor(rangeMs / bucketCount))
    const buckets = Array.from({ length: bucketCount }, (_, index) => ({
      timestamp: start + index * bucketSize,
      latencies: [] as number[],
      total: 0,
      up: 0,
    }))

    for (const sample of filteredSamples) {
      const at = new Date(sample.checkedAt).getTime()
      const normalizedIndex = Math.floor((at - start) / bucketSize)
      const index = Math.max(0, Math.min(bucketCount - 1, normalizedIndex))
      const bucket = buckets[index]
      bucket.total += 1
      if (sample.status === "up") {
        bucket.up += 1
      }
      if (typeof sample.latencyMs === "number" && Number.isFinite(sample.latencyMs)) {
        bucket.latencies.push(sample.latencyMs)
      }
    }

    return buckets.map(bucket => {
      const p50 = percentile(bucket.latencies, 50)
      const p95 = percentile(bucket.latencies, 95)
      const p99 = percentile(bucket.latencies, 99)
      const uptime = bucket.total > 0 ? (bucket.up / bucket.total) * 100 : 0
      return {
        timestamp: bucket.timestamp,
        label: asTimeLabel(bucket.timestamp, range),
        p50,
        p95,
        p99,
        uptime,
      }
    })
  }, [filteredSamples, range])

  const statusCodeData = useMemo(() => {
    const groups = new Map<string, number>()
    for (const sample of filteredSamples) {
      if (sample.statusCode === null || sample.statusCode === undefined) {
        continue
      }
      const classLabel = `${Math.floor(sample.statusCode / 100)}xx`
      groups.set(classLabel, (groups.get(classLabel) ?? 0) + 1)
    }
    return Array.from(groups.entries())
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => a.label.localeCompare(b.label))
  }, [filteredSamples])

  const responseBytesTrend = useMemo(() => {
    const toBytes = (value: unknown) => {
      if (typeof value === "number" && Number.isFinite(value)) {
        return value
      }
      if (typeof value === "string" && value.trim() !== "") {
        const parsed = Number(value)
        return Number.isFinite(parsed) ? parsed : null
      }
      return null
    }

    return filteredSamples
      .map(sample => {
        const responseBytes = toBytes(sample.meta?.responseBytes)
        return {
          label: asTimeLabel(new Date(sample.checkedAt).getTime(), range),
          bytes: responseBytes,
        }
      })
      .filter(item => item.bytes !== null)
  }, [filteredSamples, range])

  const protocolLatencySplit = useMemo(() => {
    const grouped = {
      http: [] as number[],
      tcp: [] as number[],
    }

    for (const sample of filteredSamples) {
      if (typeof sample.latencyMs !== "number") {
        continue
      }
      grouped[sample.monitorType].push(sample.latencyMs)
    }

    return [
      {
        protocol: "HTTP",
        p95: Math.round(percentile(grouped.http, 95)),
      },
      {
        protocol: "TCP",
        p95: Math.round(percentile(grouped.tcp, 95)),
      },
    ]
  }, [filteredSamples])

  const topFailureReasons = useMemo(() => {
    const grouped = new Map<string, number>()
    for (const sample of filteredSamples) {
      if (!sample.errorMessage) {
        continue
      }
      const short =
        sample.errorMessage.length > 42
          ? `${sample.errorMessage.slice(0, 39)}...`
          : sample.errorMessage
      grouped.set(short, (grouped.get(short) ?? 0) + 1)
    }
    return Array.from(grouped.entries())
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6)
  }, [filteredSamples])

  const checksPerMinute = useMemo(() => {
    if (filteredSamples.length < 2) {
      return 0
    }
    const first = new Date(filteredSamples[0].checkedAt).getTime()
    const last = new Date(filteredSamples[filteredSamples.length - 1].checkedAt).getTime()
    const spanMinutes = Math.max(1, (last - first) / 60000)
    return Math.round((filteredSamples.length / spanMinutes) * 10) / 10
  }, [filteredSamples])

  const incidentSignals = useMemo(
    () => filteredSamples.filter(item => item.status === "down").length,
    [filteredSamples]
  )
  const latestP95 = Math.round(bucketed[bucketed.length - 1].p95)

  return (
    <section className="space-y-4 rounded-2xl border border-zinc-800 bg-zinc-950/80 p-4 shadow-[0_0_0_1px_rgba(24,24,27,0.8)] sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.14em] text-emerald-300/80">Operations Trends</p>
          <h2 className="mt-1 text-xl font-semibold text-zinc-100 sm:text-2xl">Health and latency trends</h2>
        </div>
        <div className="w-full sm:w-44">
          <Select value={range} onValueChange={value => setRange(value as RangeOption)}>
            <SelectTrigger className="cursor-pointer border-zinc-700 bg-zinc-900 text-zinc-100">
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

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3">
          <p className="text-xs text-emerald-200">Checks in range</p>
          <p className="mt-1 text-2xl font-semibold text-emerald-100">{filteredSamples.length}</p>
        </article>
        <article className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 p-3">
          <p className="text-xs text-cyan-200">Checks per minute</p>
          <p className="mt-1 text-2xl font-semibold text-cyan-100">{checksPerMinute}</p>
        </article>
        <article className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
          <p className="text-xs text-amber-200">Latest p95 latency</p>
          <p className="mt-1 text-2xl font-semibold text-zinc-100">{latestP95} ms</p>
        </article>
        <article className="rounded-xl border border-red-500/30 bg-red-500/10 p-3">
          <p className="text-xs text-red-200">Failed checks</p>
          <p className="mt-1 text-2xl font-semibold text-red-100">{incidentSignals}</p>
        </article>
      </div>

      <Card className="border-zinc-800 bg-zinc-950/70">
        <CardHeader>
          <CardTitle className="text-zinc-100">Latency Percentiles</CardTitle>
        </CardHeader>
        <CardContent className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={bucketed}>
              <CartesianGrid stroke="#27272a" strokeDasharray="3 3" />
              <XAxis dataKey="label" tick={{ fill: "#a1a1aa", fontSize: 11 }} minTickGap={20} />
              <YAxis tick={{ fill: "#a1a1aa", fontSize: 11 }} />
              <Tooltip
                contentStyle={{ background: "#09090b", border: "1px solid #27272a", borderRadius: "0.75rem" }}
              />
              <Line type="monotone" dataKey="p50" stroke="#22d3ee" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="p95" stroke="#f59e0b" strokeWidth={2.5} dot={false} />
              <Line type="monotone" dataKey="p99" stroke="#f97316" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="border-zinc-800 bg-zinc-950/70">
          <CardHeader>
            <CardTitle className="text-zinc-100">Uptime Timeline</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={bucketed}>
                <CartesianGrid stroke="#27272a" strokeDasharray="3 3" />
                <XAxis dataKey="label" tick={{ fill: "#a1a1aa", fontSize: 11 }} minTickGap={20} />
                <YAxis domain={[0, 100]} tick={{ fill: "#a1a1aa", fontSize: 11 }} />
                <Tooltip
                  formatter={value => `${Number(value).toFixed(2)}%`}
                  contentStyle={{
                    background: "#09090b",
                    border: "1px solid #27272a",
                    borderRadius: "0.75rem",
                  }}
                />
                <Area type="monotone" dataKey="uptime" stroke="#4ade80" fill="#22c55e33" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-zinc-800 bg-zinc-950/70">
          <CardHeader>
            <CardTitle className="text-zinc-100">Status Code Distribution</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={statusCodeData}>
                <CartesianGrid stroke="#27272a" strokeDasharray="3 3" />
                <XAxis dataKey="label" tick={{ fill: "#a1a1aa", fontSize: 11 }} />
                <YAxis tick={{ fill: "#a1a1aa", fontSize: 11 }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ background: "#09090b", border: "1px solid #27272a", borderRadius: "0.75rem" }}
                />
                <Bar dataKey="count" fill="#38bdf8" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="border-zinc-800 bg-zinc-950/70">
          <CardHeader>
            <CardTitle className="text-zinc-100">Response Size Trend</CardTitle>
          </CardHeader>
          <CardContent className="h-56">
            {responseBytesTrend.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={responseBytesTrend}>
                  <CartesianGrid stroke="#27272a" strokeDasharray="3 3" />
                  <XAxis dataKey="label" tick={{ fill: "#a1a1aa", fontSize: 11 }} minTickGap={24} />
                  <YAxis tick={{ fill: "#a1a1aa", fontSize: 11 }} />
                  <Tooltip
                    formatter={value => `${Number(value).toLocaleString()} bytes`}
                    contentStyle={{
                      background: "#09090b",
                      border: "1px solid #27272a",
                      borderRadius: "0.75rem",
                    }}
                  />
                  <Area type="monotone" dataKey="bytes" stroke="#14b8a6" fill="#14b8a633" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-zinc-700 text-center text-sm text-zinc-400">
                No response size samples yet
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-zinc-800 bg-zinc-950/70">
          <CardHeader>
            <CardTitle className="text-zinc-100">P95 by Protocol</CardTitle>
          </CardHeader>
          <CardContent className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={protocolLatencySplit}>
                <CartesianGrid stroke="#27272a" strokeDasharray="3 3" />
                <XAxis dataKey="protocol" tick={{ fill: "#a1a1aa", fontSize: 11 }} />
                <YAxis tick={{ fill: "#a1a1aa", fontSize: 11 }} />
                <Tooltip
                  formatter={value => `${value} ms`}
                  contentStyle={{
                    background: "#09090b",
                    border: "1px solid #27272a",
                    borderRadius: "0.75rem",
                  }}
                />
                <Bar dataKey="p95" fill="#f59e0b" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-zinc-800 bg-zinc-950/70">
          <CardHeader>
            <CardTitle className="text-zinc-100">Top Failure Reasons</CardTitle>
          </CardHeader>
          <CardContent className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topFailureReasons} layout="vertical" margin={{ left: 12, right: 12 }}>
                <CartesianGrid stroke="#27272a" strokeDasharray="3 3" />
                <XAxis type="number" tick={{ fill: "#a1a1aa", fontSize: 11 }} allowDecimals={false} />
                <YAxis
                  type="category"
                  dataKey="reason"
                  width={140}
                  tick={{ fill: "#a1a1aa", fontSize: 10 }}
                />
                <Tooltip
                  contentStyle={{
                    background: "#09090b",
                    border: "1px solid #27272a",
                    borderRadius: "0.75rem",
                  }}
                />
                <Bar dataKey="count" fill="#f97316" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </section>
  )
}
