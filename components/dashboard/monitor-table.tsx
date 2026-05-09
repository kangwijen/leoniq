import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { MonitorActions } from "@/components/dashboard/monitor-actions"
import { LatencySparkline } from "@/components/dashboard/latency-sparkline"
import { UptimeSparkline } from "@/components/dashboard/uptime-sparkline"
import type { DashboardMonitor, RangeOption } from "@/lib/types"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

type MonitorTableProps = {
  monitors: DashboardMonitor[]
}

const RANGE_SECONDS: Record<RangeOption, number> = {
  "1h": 60 * 60,
  "6h": 6 * 60 * 60,
  "24h": 24 * 60 * 60,
  "7d": 7 * 24 * 60 * 60,
}

const SPARKLINE_RANGE: RangeOption = "24h"

const toRangeSeries = (values: number[], intervalSeconds: number, range: RangeOption) => {
  const maxPoints = Math.max(1, Math.floor(RANGE_SECONDS[range] / Math.max(1, intervalSeconds)))
  return values.slice(-maxPoints)
}

export const MonitorTable = ({ monitors }: MonitorTableProps) => (
  <div className="space-y-3">
    <div className="space-y-3 md:hidden">
      {monitors.map(monitor => {
        const tags = monitor.tags ?? []

        return (
        <article
          key={monitor.id}
          className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-4 shadow-[0_0_0_1px_rgba(24,24,27,0.7)]"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 space-y-1">
              <Link
                href={`/dashboard/monitors/${monitor.id}`}
                className="block truncate text-base font-semibold text-zinc-100 transition-colors duration-200 hover:text-emerald-400"
              >
                {monitor.name}
              </Link>
              <p className="text-xs uppercase tracking-[0.08em] text-zinc-500">{monitor.type}</p>
              {tags.length > 0 ? (
                <div className="flex flex-wrap gap-1 pt-1">
                  {tags.slice(0, 4).map(tag => (
                    <Badge key={`${monitor.id}-${tag}`} variant="outline" className="border-zinc-700 text-zinc-300">
                      {tag}
                    </Badge>
                  ))}
                </div>
              ) : null}
            </div>
            {!monitor.active ? (
              <Badge variant="outline" className="border-zinc-700 text-zinc-300">
                paused
              </Badge>
            ) : monitor.lastStatus === "up" ? (
              <Badge className="bg-emerald-500/20 text-emerald-300">up</Badge>
            ) : monitor.lastStatus === "down" ? (
              <Badge className="bg-red-500/20 text-red-300">down</Badge>
            ) : (
              <Badge variant="outline" className="border-zinc-700 text-zinc-300">
                unknown
              </Badge>
            )}
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
            <div>
              <p className="text-xs text-zinc-500">Interval</p>
              <p className="font-medium text-zinc-200">{monitor.intervalSeconds}s</p>
            </div>
            <div>
              <p className="text-xs text-zinc-500">Last Check</p>
              <p className="text-zinc-300 sm:truncate">
                {monitor.lastCheckedAt
                  ? new Date(monitor.lastCheckedAt).toLocaleString()
                  : "No checks yet"}
              </p>
            </div>
            <div className="col-span-2 grid grid-cols-2 gap-3">
              <div className="min-w-0">
                <p className="mb-1 text-xs text-zinc-500">Uptime (24h)</p>
                <UptimeSparkline
                  values={toRangeSeries(monitor.uptimeSeries, monitor.intervalSeconds, SPARKLINE_RANGE)}
                />
              </div>
              <div className="min-w-0">
                <p className="mb-1 text-xs text-zinc-500">Latency (24h)</p>
                <LatencySparkline
                  values={toRangeSeries(monitor.latencySeries, monitor.intervalSeconds, SPARKLINE_RANGE)}
                />
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-lg border border-zinc-800 bg-zinc-900/40 p-2">
            <MonitorActions monitorId={monitor.id} active={monitor.active} compact />
          </div>
        </article>
      )})}
    </div>

    <div className="hidden overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950/70 shadow-[0_0_0_1px_rgba(24,24,27,0.7)] md:block">
      <Table>
        <TableHeader>
          <TableRow className="border-zinc-800/80 bg-zinc-900/60 hover:bg-zinc-900/60">
            <TableHead className="text-zinc-300">Name</TableHead>
            <TableHead className="text-zinc-300">Type</TableHead>
            <TableHead className="text-zinc-300">Status</TableHead>
            <TableHead className="text-zinc-300">Interval</TableHead>
            <TableHead className="text-zinc-300">Uptime (24h)</TableHead>
            <TableHead className="text-zinc-300">Latency (24h)</TableHead>
            <TableHead className="text-zinc-300">Last Check</TableHead>
            <TableHead className="text-right text-zinc-300">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {monitors.map(monitor => {
            const tags = monitor.tags ?? []

            return (
            <TableRow
              key={monitor.id}
              className="border-zinc-800/80 transition-colors duration-200 hover:bg-zinc-900/80"
            >
              <TableCell>
                <Link
                  href={`/dashboard/monitors/${monitor.id}`}
                  className="cursor-pointer font-medium text-zinc-100 transition-colors duration-200 hover:text-emerald-400"
                >
                  {monitor.name}
                </Link>
                <p className="mt-0.5 text-xs text-zinc-500">
                  {monitor.type === "http" ? "Website monitor" : "Socket monitor"}
                </p>
                {tags.length > 0 ? (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {tags.slice(0, 3).map(tag => (
                      <Badge key={`${monitor.id}-table-${tag}`} variant="outline" className="border-zinc-700 text-zinc-300">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                ) : null}
              </TableCell>
              <TableCell className="uppercase text-zinc-300">{monitor.type}</TableCell>
              <TableCell>
                {!monitor.active ? (
                  <Badge variant="outline" className="border-zinc-700 text-zinc-300">
                    paused
                  </Badge>
                ) : monitor.lastStatus === "up" ? (
                  <Badge className="bg-emerald-500/20 text-emerald-300">up</Badge>
                ) : monitor.lastStatus === "down" ? (
                  <Badge className="bg-red-500/20 text-red-300">down</Badge>
                ) : (
                  <Badge variant="outline" className="border-zinc-700 text-zinc-300">
                    unknown
                  </Badge>
                )}
              </TableCell>
              <TableCell className="text-zinc-200">{monitor.intervalSeconds}s</TableCell>
              <TableCell>
                <div className="flex justify-start">
                  <UptimeSparkline
                    values={toRangeSeries(monitor.uptimeSeries, monitor.intervalSeconds, SPARKLINE_RANGE)}
                  />
                </div>
              </TableCell>
              <TableCell>
                <div className="flex justify-start">
                  <LatencySparkline
                    values={toRangeSeries(monitor.latencySeries, monitor.intervalSeconds, SPARKLINE_RANGE)}
                  />
                </div>
              </TableCell>
              <TableCell className="text-zinc-400">
                {monitor.lastCheckedAt
                  ? new Date(monitor.lastCheckedAt).toLocaleString()
                  : "No checks yet"}
              </TableCell>
              <TableCell className="text-right">
                <div className="inline-flex justify-end">
                  <MonitorActions monitorId={monitor.id} active={monitor.active} />
                </div>
              </TableCell>
            </TableRow>
          )})}
        </TableBody>
      </Table>
    </div>
  </div>
)
