"use client"

import { useState } from "react"
import { MonitorTable } from "@/components/dashboard/monitor-table"
import { NeonOperationsWall, type RangeOption } from "@/components/dashboard/neon-operations-wall"

type Sample = {
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

type Monitor = {
  id: string
  name: string
  type: "http" | "tcp"
  active: boolean
  lastStatus: "up" | "down" | null
  intervalSeconds: number
  lastCheckedAt: string | Date | null
  uptimeSeries: number[]
}

type DashboardLiveSectionsProps = {
  samples: Sample[]
  monitors: Monitor[]
}

export const DashboardLiveSections = ({ samples, monitors }: DashboardLiveSectionsProps) => {
  const [range, setRange] = useState<RangeOption>("24h")

  return (
    <>
      <NeonOperationsWall samples={samples} range={range} onRangeChange={setRange} />
      {monitors.length === 0 ? (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-8 text-zinc-300">
          No monitors configured yet. Add an HTTP or TCP monitor to begin collecting checks.
        </div>
      ) : (
        <MonitorTable monitors={monitors} range={range} />
      )}
    </>
  )
}
