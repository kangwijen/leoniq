import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { MonitorActions } from "@/components/dashboard/monitor-actions"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

type Monitor = {
  id: string
  name: string
  type: "http" | "tcp"
  active: boolean
  lastStatus: "up" | "down" | null
  intervalSeconds: number
  lastCheckedAt: string | Date | null
}

type MonitorTableProps = {
  monitors: Monitor[]
}

export const MonitorTable = ({ monitors }: MonitorTableProps) => (
  <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950/70 shadow-[0_0_0_1px_rgba(24,24,27,0.7)]">
    <Table>
      <TableHeader>
        <TableRow className="border-zinc-800/80 bg-zinc-900/40 hover:bg-zinc-900/40">
          <TableHead className="text-zinc-300">Name</TableHead>
          <TableHead className="text-zinc-300">Type</TableHead>
          <TableHead className="text-zinc-300">Status</TableHead>
          <TableHead className="text-zinc-300">Interval</TableHead>
          <TableHead className="text-zinc-300">Last check</TableHead>
          <TableHead className="text-right text-zinc-300">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {monitors.map(monitor => (
          <TableRow
            key={monitor.id}
            className="border-zinc-800/80 transition-colors duration-200 hover:bg-zinc-900/60"
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
        ))}
      </TableBody>
    </Table>
  </div>
)
